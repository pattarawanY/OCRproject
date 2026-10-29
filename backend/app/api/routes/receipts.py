"""สแกนใบเสร็จ (live-check) และจัดการข้อมูลที่ดึงได้จาก OCR"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.routes.requests import get_request_for
from app.core.deps import get_current_user, get_optional_user, require_roles
from app.db import get_db
from app.models import Receipt, ReceiptIssue, RequestStatus as S, Role, User
from app.schemas import OCRCheckResult, ReceiptOut
from app.services.extraction import DOC_TYPES
from app.services.receipts import process_document
from app.services.storage import ALLOWED_TYPES, save_upload
from app.services.validation import element_options, validate

router = APIRouter(prefix="/receipts", tags=["receipts / OCR"])


def _result(receipt: Receipt) -> OCRCheckResult:
    return OCRCheckResult(
        receipt=receipt,
        passed=not any(not i.resolved for i in receipt.issues),
        warnings=[i.description for i in receipt.issues if not i.resolved],
    )


@router.post("/live-check", response_model=OCRCheckResult)
async def live_check(
    file: UploadFile = File(...),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """สแกนตรวจสอบเบื้องต้นโดยไม่ต้องเข้าสู่ระบบ ถ้าเข้าสู่ระบบอยู่จะเก็บไฟล์ไว้ให้อัปโหลดต่อได้"""
    if user is not None:
        path, content, mime = await save_upload(file, f"live/{user.user_id}")
    else:
        mime = file.content_type or ""
        if mime not in ALLOWED_TYPES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "ชนิดไฟล์ไม่รองรับ (รองรับเฉพาะ JPG, PNG และ PDF)")
        path, content = None, await file.read()
    receipt = process_document(
        db, content=content, mime=mime, filename=file.filename or "", mode="live",
        image_file=path, user_id=user.user_id if user else None,
    )
    db.commit()
    db.refresh(receipt)
    return _result(receipt)


class AttachIn(BaseModel):
    request_id: int


@router.post("/{receipt_id}/attach", response_model=OCRCheckResult)
def attach_to_request(
    receipt_id: int,
    data: AttachIn,
    user: User = Depends(require_roles(Role.TEACHER)),
    db: Session = Depends(get_db),
):
    """อัปโหลดใบเสร็จที่สแกนแล้ว (live) เข้าคำขอที่ได้รับอนุมัติ"""
    receipt = db.get(Receipt, receipt_id)
    if receipt is None or receipt.user_id != user.user_id or not receipt.image_file:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ไม่พบใบเสร็จ")
    req = get_request_for(db, data.request_id, user)
    if req.status not in (S.APPROVED, S.RECEIPT_REJECTED):
        raise HTTPException(status.HTTP_409_CONFLICT, "คำขอนี้ยังไม่อยู่ในสถานะที่ส่งใบเสร็จได้")
    receipt.mode = "upload"
    receipt.request_id = req.request_id
    _revalidate(receipt, req.approved_at)
    db.commit()
    db.refresh(receipt)
    return _result(receipt)


class FieldsIn(BaseModel):
    fields: dict


def _revalidate(receipt: Receipt, approved_at) -> None:
    fields = (receipt.ocr_data or {}).get("fields", {})
    required = receipt.sample.required_elements if receipt.sample else None
    issues = validate(fields, required_elements=required, approved_at=approved_at)
    # คงปัญหาที่เจ้าหน้าที่ระบุไว้ แทนที่เฉพาะปัญหาที่ AI ตรวจพบ
    receipt.issues = [i for i in receipt.issues if i.reported_by is not None] + [
        ReceiptIssue(issue_type=t, description=d) for t, d in issues
    ]
    receipt.status = "flagged" if receipt.issues else "valid"


@router.put("/{receipt_id}/fields", response_model=OCRCheckResult)
def update_fields(
    receipt_id: int, data: FieldsIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """อาจารย์แก้ไขข้อมูลที่ระบบกรอกให้ก่อนยืนยัน แล้วตรวจตามเกณฑ์ใหม่"""
    receipt = db.get(Receipt, receipt_id)
    if receipt is None or receipt.user_id != user.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ไม่พบใบเสร็จ")
    ocr = dict(receipt.ocr_data or {})
    ocr["fields"] = {**ocr.get("fields", {}), **data.fields, "edited_by_user": True}
    receipt.ocr_data = ocr
    _revalidate(receipt, receipt.request.approved_at if receipt.request else None)
    db.commit()
    db.refresh(receipt)
    return _result(receipt)


@router.get("/{receipt_id}", response_model=ReceiptOut)
def get_receipt(receipt_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    receipt = db.get(Receipt, receipt_id)
    if receipt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ไม่พบใบเสร็จ")
    if user.role == Role.TEACHER and receipt.user_id != user.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "ไม่มีสิทธิ์เข้าถึง")
    return receipt


@router.get("/meta/options")
def options():
    return {
        "document_types": [{"key": k, "label": v} for k, v in DOC_TYPES.items()],
        "elements": element_options(),
    }
