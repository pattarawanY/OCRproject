"""ดาวน์โหลดไฟล์จาก File Storage ตามสิทธิ์ผู้ใช้"""

import mimetypes

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db import get_db
from app.models import Receipt, Role, TravelRequest, User
from app.services.storage import absolute_path

router = APIRouter(prefix="/files", tags=["files"])


def _teacher_can_read(db: Session, user: User, rel: str) -> bool:
    if rel.startswith(("samples/", "hotels/")):
        return True
    if rel.startswith(f"live/{user.user_id}/"):
        return True
    owns_receipt = db.scalar(
        select(Receipt.receipt_id).where(Receipt.image_file == rel, Receipt.user_id == user.user_id)
    )
    owns_request = db.scalar(
        select(TravelRequest.request_id).where(
            TravelRequest.user_id == user.user_id,
            or_(TravelRequest.attachment_file == rel),
        )
    )
    return bool(owns_receipt or owns_request)


@router.get("/{rel_path:path}")
def get_file(rel_path: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == Role.TEACHER and not _teacher_can_read(db, user, rel_path):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "ไม่มีสิทธิ์เข้าถึงไฟล์นี้")
    path = absolute_path(rel_path)
    media = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return FileResponse(path, media_type=media)
