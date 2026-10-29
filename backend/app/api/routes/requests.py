"""คำขออนุมัติไปราชการ: ยื่นคำขอ, พิจารณา, ส่งใบเสร็จ, ตรวจสอบใบเสร็จ, ดาวน์โหลด PDF"""

from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, require_roles
from app.db import get_db
from app.models import (
    ExpenseItem,
    GeneratedDocument,
    HotelStay,
    Receipt,
    RequestStatus as S,
    RequestType,
    Role,
    TravelRequest,
    Trip,
    User,
)
from app.schemas import (
    OCRCheckResult,
    ReasonIn,
    RequestActionResult,
    SubmitReceiptsIn,
    TravelRequestIn,
    TravelRequestOut,
    TravelRequestSummary,
    VerifyIn,
)
from app.services.notify import notify, notify_staff
from app.services.pdf import STATUS_TH, build_request_pdf
from app.services.receipts import process_document
from app.services.storage import delete_file, save_upload
from app.services.workflow import change_status, ensure_status

router = APIRouter(prefix="/requests", tags=["travel requests"])
teacher_only = require_roles(Role.TEACHER)
staff_only = require_roles(Role.STAFF)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def get_request_for(db: Session, request_id: int, user: User) -> TravelRequest:
    req = db.get(TravelRequest, request_id)
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ไม่พบข้อมูลคำขอ")
    if user.role == Role.TEACHER and req.user_id != user.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "ไม่มีสิทธิ์เข้าถึงคำขอนี้")
    return req


def _owned(db: Session, request_id: int, user: User) -> TravelRequest:
    req = get_request_for(db, request_id, user)
    if req.user_id != user.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "เฉพาะเจ้าของคำขอเท่านั้น")
    return req


def _budget_warning(user: User, amount: Decimal) -> list[str]:
    profile = user.teacher_profile
    if profile and amount > profile.budget_remaining:
        return [
            f"ยอดเงิน {amount:,.2f} บาท เกินวงเงินคงเหลือ ({profile.budget_remaining:,.2f} บาท)"
        ]
    return []


def _apply_payload(req: TravelRequest, data: TravelRequestIn) -> None:
    req.request_type = data.request_type
    req.activity_type = data.activity_type
    req.event_name = data.event_name
    req.location = data.location
    req.start_date = data.start_date
    req.end_date = data.end_date
    req.event_url = data.event_url
    if data.request_type == RequestType.REIMBURSE:
        req.expense_items = [ExpenseItem(**i.model_dump()) for i in data.expense_items]
    else:
        req.expense_items = []
    req.trips = [Trip(**t.model_dump()) for t in data.trips]
    req.hotel_stays = [HotelStay(**h.model_dump()) for h in data.hotel_stays]
    req.estimated_amount = sum((i.estimated_amount for i in req.expense_items), Decimal(0))


def _submit(db: Session, req: TravelRequest, user: User) -> list[str]:
    warnings: list[str] = []
    if req.request_type == RequestType.REIMBURSE:
        if not req.expense_items:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "กรุณากรอกประมาณการค่าใช้จ่ายอย่างน้อย 1 รายการ")
        warnings += _budget_warning(user, req.estimated_amount)
    if req.start_date < date.today():
        warnings.append("วันที่เริ่มต้นผ่านมาแล้ว กรุณาตรวจสอบกรอบเวลาการยื่นขออนุมัติ")
    req.submitted_at = _now()
    change_status(req, S.PENDING_APPROVAL, user, "ยื่นคำขออนุมัติไปราชการ")
    db.flush()
    notify(db, user, "ยื่นคำขอสำเร็จ",
           f"คำขอ #{req.request_id} '{req.event_name}' ถูกส่งให้เจ้าหน้าที่พิจารณาแล้ว", request_id=req.request_id)
    notify_staff(db, "มีคำขออนุมัติไปราชการใหม่รอพิจารณา",
                 f"{user.full_name} ยื่นคำขอ #{req.request_id} '{req.event_name}'", request_id=req.request_id)
    return warnings


@router.get("", response_model=list[TravelRequestSummary])
def list_requests(
    status_: str | None = Query(None, alias="status"),
    teacher: str | None = Query(None, description="ค้นหาจากชื่ออาจารย์"),
    date_from: date | None = None,
    date_to: date | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(TravelRequest).join(TravelRequest.user).order_by(TravelRequest.updated_at.desc())
    if user.role == Role.TEACHER:
        stmt = stmt.where(TravelRequest.user_id == user.user_id)
    else:
        # เจ้าหน้าที่ไม่เห็นฉบับร่างของอาจารย์
        stmt = stmt.where(TravelRequest.status != S.DRAFT)
    if status_:
        stmt = stmt.where(TravelRequest.status.in_(status_.split(",")))
    if teacher:
        stmt = stmt.where(User.full_name.ilike(f"%{teacher}%"))
    if date_from:
        stmt = stmt.where(TravelRequest.submitted_at >= date_from)
    if date_to:
        stmt = stmt.where(TravelRequest.submitted_at < datetime.combine(date_to, datetime.max.time()))
    return db.scalars(stmt).all()


@router.post("", response_model=RequestActionResult, status_code=201)
def create_request(data: TravelRequestIn, user: User = Depends(teacher_only), db: Session = Depends(get_db)):
    req = TravelRequest(user_id=user.user_id, status=S.DRAFT)
    req.user = user
    _apply_payload(req, data)
    db.add(req)
    change_status(req, S.DRAFT, user, "สร้างฉบับร่าง")
    db.flush()
    warnings = _submit(db, req, user) if data.submit else []
    db.commit()
    db.refresh(req)
    return RequestActionResult(request=req, warnings=warnings)


@router.get("/{request_id}", response_model=TravelRequestOut)
def get_request(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_request_for(db, request_id, user)


@router.put("/{request_id}", response_model=RequestActionResult)
def update_request(
    request_id: int, data: TravelRequestIn, user: User = Depends(teacher_only), db: Session = Depends(get_db)
):
    req = _owned(db, request_id, user)
    ensure_status(req, S.DRAFT, S.REJECTED)
    _apply_payload(req, data)
    warnings = _submit(db, req, user) if data.submit else []
    db.commit()
    db.refresh(req)
    return RequestActionResult(request=req, warnings=warnings)


@router.delete("/{request_id}", status_code=204)
def delete_draft(request_id: int, user: User = Depends(teacher_only), db: Session = Depends(get_db)):
    req = _owned(db, request_id, user)
    ensure_status(req, S.DRAFT)
    delete_file(req.attachment_file)
    db.delete(req)
    db.commit()


@router.post("/{request_id}/attachment", response_model=TravelRequestOut)
async def upload_attachment(
    request_id: int,
    file: UploadFile = File(...),
    user: User = Depends(teacher_only),
    db: Session = Depends(get_db),
):
    """แนบเอกสารประกอบคำขอ เช่น เอกสาร/กำหนดการจัดงาน"""
    req = _owned(db, request_id, user)
    ensure_status(req, S.DRAFT, S.REJECTED, S.PENDING_APPROVAL)
    path, _, _ = await save_upload(file, f"requests/{req.request_id}")
    delete_file(req.attachment_file)
    req.attachment_file = path
    db.commit()
    db.refresh(req)
    return req


# ---------- เจ้าหน้าที่พิจารณาคำขอ ----------
@router.post("/{request_id}/approve", response_model=TravelRequestOut)
def approve(request_id: int, staff: User = Depends(staff_only), db: Session = Depends(get_db)):
    req = get_request_for(db, request_id, staff)
    ensure_status(req, S.PENDING_APPROVAL)
    req.approved_at = _now()
    if req.request_type == RequestType.NO_REIMBURSE:
        change_status(req, S.COMPLETED, staff, "อนุมัติ (ไม่เบิกค่าใช้จ่าย)")
        msg = f"คำขอ #{req.request_id} '{req.event_name}' ได้รับการอนุมัติแล้ว (ไม่เบิกค่าใช้จ่าย)"
    else:
        change_status(req, S.APPROVED, staff, "อนุมัติ รอส่งใบเสร็จ")
        msg = (f"คำขอ #{req.request_id} '{req.event_name}' ได้รับการอนุมัติแล้ว "
               "หลังเดินทางกลับกรุณาส่งใบเสร็จเพื่อเบิกจ่าย (ใบเสร็จต้องลงวันที่หลังวันที่อนุมัติ)")
    notify(db, req.user, "ผลการพิจารณา: อนุมัติ", msg, request_id=req.request_id)
    db.commit()
    db.refresh(req)
    return req


@router.post("/{request_id}/reject", response_model=TravelRequestOut)
def reject(request_id: int, data: ReasonIn, staff: User = Depends(staff_only), db: Session = Depends(get_db)):
    req = get_request_for(db, request_id, staff)
    ensure_status(req, S.PENDING_APPROVAL)
    change_status(req, S.REJECTED, staff, data.reason)
    notify(db, req.user, "ผลการพิจารณา: ไม่อนุมัติ",
           f"คำขอ #{req.request_id} '{req.event_name}' ไม่ได้รับการอนุมัติ\nเหตุผล/คำแนะนำ: {data.reason}",
           request_id=req.request_id)
    db.commit()
    db.refresh(req)
    return req


# ---------- อาจารย์ส่งใบเสร็จหลังเดินทาง ----------
@router.post("/{request_id}/receipts", response_model=OCRCheckResult)
async def upload_receipt(
    request_id: int,
    file: UploadFile = File(...),
    sample_id: int | None = None,
    user: User = Depends(teacher_only),
    db: Session = Depends(get_db),
):
    req = _owned(db, request_id, user)
    ensure_status(req, S.APPROVED, S.RECEIPT_REJECTED)
    path, content, mime = await save_upload(file, f"receipts/{req.request_id}")
    receipt = process_document(
        db, content=content, mime=mime, filename=file.filename or "", mode="upload",
        image_file=path, user_id=user.user_id, request=req, sample_id=sample_id,
    )
    db.commit()
    db.refresh(receipt)
    return OCRCheckResult(
        receipt=receipt, passed=not receipt.issues, warnings=[i.description for i in receipt.issues]
    )


@router.delete("/{request_id}/receipts/{receipt_id}", status_code=204)
def remove_receipt(request_id: int, receipt_id: int, user: User = Depends(teacher_only), db: Session = Depends(get_db)):
    req = _owned(db, request_id, user)
    ensure_status(req, S.APPROVED, S.RECEIPT_REJECTED)
    receipt = db.get(Receipt, receipt_id)
    if receipt is None or receipt.request_id != req.request_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ไม่พบใบเสร็จ")
    delete_file(receipt.image_file)
    db.delete(receipt)
    db.commit()


@router.post("/{request_id}/submit-receipts", response_model=RequestActionResult)
def submit_receipts(
    request_id: int, data: SubmitReceiptsIn, user: User = Depends(teacher_only), db: Session = Depends(get_db)
):
    req = _owned(db, request_id, user)
    ensure_status(req, S.APPROVED, S.RECEIPT_REJECTED)
    if req.request_type != RequestType.REIMBURSE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "คำขอแบบไม่เบิกค่าใช้จ่ายไม่ต้องส่งใบเสร็จ")

    receipts = [r for r in req.receipts if r.receipt_id in set(data.receipt_ids)]
    if not receipts:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "กรุณาแนบใบเสร็จอย่างน้อย 1 ใบ")

    items = {i.item_id: i for i in req.expense_items}
    for a in data.actual_amounts:
        if a.item_id in items:
            items[a.item_id].actual_amount = a.actual_amount
    req.actual_amount = sum((i.actual_amount or Decimal(0) for i in req.expense_items), Decimal(0))

    warnings = [f"ใบเสร็จ #{r.receipt_id}: {i.description}" for r in receipts for i in r.issues if not i.resolved]
    warnings += _budget_warning(user, req.actual_amount)

    change_status(req, S.RECEIPT_SUBMITTED, user, "ส่งใบเสร็จเพื่อเบิกจ่าย")
    notify_staff(db, "มีใบเสร็จรอตรวจสอบ",
                 f"{user.full_name} ส่งใบเสร็จของคำขอ #{req.request_id} '{req.event_name}' "
                 f"ยอดรวม {req.actual_amount:,.2f} บาท", request_id=req.request_id)
    db.commit()
    db.refresh(req)
    return RequestActionResult(request=req, warnings=warnings)


# ---------- เจ้าหน้าที่ตรวจสอบใบเสร็จ ----------
def _generate_pdf(db: Session, req: TravelRequest, by: User | None) -> GeneratedDocument:
    pdf = build_request_pdf(req)
    rel = f"generated/request_{req.request_id}_{datetime.now():%Y%m%d%H%M%S}.pdf"
    dest = settings.upload_dir / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(pdf)
    doc = GeneratedDocument(
        request_id=req.request_id,
        generated_by=by.user_id if by else None,
        document_type="claim_summary",
        file_path=rel,
    )
    db.add(doc)
    return doc


@router.post("/{request_id}/verify", response_model=TravelRequestOut)
def verify_receipts(request_id: int, data: VerifyIn, staff: User = Depends(staff_only), db: Session = Depends(get_db)):
    req = get_request_for(db, request_id, staff)
    ensure_status(req, S.RECEIPT_SUBMITTED)
    if data.passed:
        change_status(req, S.COMPLETED, staff, data.note or "ใบเสร็จผ่านการตรวจสอบ")
        for r in req.receipts:
            r.status = "valid"
        profile = req.user.teacher_profile
        if profile:
            profile.budget_used = (profile.budget_used or 0) + (req.actual_amount or 0)
        db.flush()
        _generate_pdf(db, req, None)
        notify(db, req.user, "ผลการตรวจสอบใบเสร็จ: ผ่าน",
               f"ใบเสร็จของคำขอ #{req.request_id} ผ่านการตรวจสอบ ดาวน์โหลดเอกสารเบิกจ่าย PDF ได้ในระบบ",
               request_id=req.request_id)
    else:
        change_status(req, S.RECEIPT_REJECTED, staff, data.note)
        for r in req.receipts:
            if r.status != "valid":
                r.status = "invalid"
        notify(db, req.user, "ผลการตรวจสอบใบเสร็จ: ไม่ผ่าน",
               f"ใบเสร็จของคำขอ #{req.request_id} ไม่ผ่านการตรวจสอบ\nเหตุผล: {data.note}\n"
               "กรุณาแก้ไขหรือส่งใบเสร็จใหม่", type_="warning", request_id=req.request_id)
    db.commit()
    db.refresh(req)
    return req


@router.get("/{request_id}/pdf")
def download_pdf(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = get_request_for(db, request_id, user)
    if req.status == S.DRAFT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "ยังไม่ได้ยื่นคำขอ")
    latest = max(req.generated_documents, key=lambda d: d.generated_at, default=None)
    path = settings.upload_dir / latest.file_path if latest else None
    if latest is None or latest.generated_at < req.updated_at or not path.exists():
        latest = _generate_pdf(db, req, user)
        db.commit()
        path = settings.upload_dir / latest.file_path
    filename = f"smartclaim_request_{req.request_id}.pdf"
    return Response(
        path.read_bytes(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/meta/statuses")
def statuses():
    return [{"key": k, "label": v} for k, v in STATUS_TH.items()]


