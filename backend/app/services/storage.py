import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/pdf": ".pdf",
}


async def save_upload(file: UploadFile, subdir: str) -> tuple[str, bytes, str]:
    """บันทึกไฟล์ลง File Storage แล้วคืน (path แบบ relative, เนื้อไฟล์, mime type)"""
    mime = file.content_type or ""
    if mime not in ALLOWED_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "ชนิดไฟล์ไม่รองรับ (รองรับเฉพาะ JPG, PNG และ PDF)"
        )
    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"ขนาดไฟล์เกิน {settings.max_upload_mb} MB"
        )
    if not content:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "ไฟล์ว่างเปล่า")

    rel = Path(subdir) / f"{uuid.uuid4().hex}{ALLOWED_TYPES[mime]}"
    dest = settings.upload_dir / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    return rel.as_posix(), content, mime


def absolute_path(rel_path: str) -> Path:
    path = (settings.upload_dir / rel_path).resolve()
    if settings.upload_dir.resolve() not in path.parents:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "path ไม่ถูกต้อง")
    if not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ไม่พบไฟล์")
    return path


def delete_file(rel_path: str | None) -> None:
    if not rel_path:
        return
    path = settings.upload_dir / rel_path
    if path.exists():
        path.unlink()
