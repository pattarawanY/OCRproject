"""ตัวอย่างเอกสาร: อาจารย์ดู, เจ้าหน้าที่เพิ่ม/แก้ไข/ลบ"""

import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db import get_db
from app.models import DocumentSample, Role, User
from app.schemas import DocumentSampleOut
from app.services.storage import delete_file, save_upload

router = APIRouter(prefix="/samples", tags=["document samples"])
staff_only = require_roles(Role.STAFF)


def _parse_elements(raw: str) -> list[str]:
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        value = [x.strip() for x in raw.split(",") if x.strip()]
    if not isinstance(value, list) or not value:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "กรุณาระบุองค์ประกอบที่เอกสารต้องมีอย่างน้อย 1 รายการ")
    return value


@router.get("", response_model=list[DocumentSampleOut])
def list_samples(
    document_type: str | None = None, _: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    stmt = select(DocumentSample).order_by(DocumentSample.document_type, DocumentSample.sample_id)
    if document_type:
        stmt = stmt.where(DocumentSample.document_type == document_type)
    return db.scalars(stmt).all()


@router.post("", response_model=DocumentSampleOut, status_code=201)
async def create_sample(
    document_type: str = Form(...),
    description: str = Form(""),
    required_elements: str = Form(..., description='JSON array เช่น ["receipt_number","date"]'),
    file: UploadFile | None = File(None),
    staff: User = Depends(staff_only),
    db: Session = Depends(get_db),
):
    sample = DocumentSample(
        managed_by=staff.user_id,
        document_type=document_type,
        description=description,
        required_elements=_parse_elements(required_elements),
    )
    if file is not None and file.filename:
        sample.file, _, _ = await save_upload(file, "samples")
    db.add(sample)
    db.commit()
    db.refresh(sample)
    return sample


@router.put("/{sample_id}", response_model=DocumentSampleOut)
async def update_sample(
    sample_id: int,
    document_type: str = Form(...),
    description: str = Form(""),
    required_elements: str = Form(...),
    file: UploadFile | None = File(None),
    staff: User = Depends(staff_only),
    db: Session = Depends(get_db),
):
    sample = db.get(DocumentSample, sample_id)
    if sample is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ไม่พบตัวอย่างเอกสาร")
    sample.document_type = document_type
    sample.description = description
    sample.required_elements = _parse_elements(required_elements)
    sample.managed_by = staff.user_id
    if file is not None and file.filename:
        new_path, _, _ = await save_upload(file, "samples")
        delete_file(sample.file)
        sample.file = new_path
    db.commit()
    db.refresh(sample)
    return sample


@router.delete("/{sample_id}", status_code=204)
def delete_sample(sample_id: int, _: User = Depends(staff_only), db: Session = Depends(get_db)):
    sample = db.get(DocumentSample, sample_id)
    if sample is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ไม่พบตัวอย่างเอกสาร")
    delete_file(sample.file)
    db.delete(sample)
    db.commit()
