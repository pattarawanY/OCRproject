from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Notification, Role, User
from app.services.email import send_email


def notify(
    db: Session,
    user: User,
    subject: str,
    message: str,
    *,
    type_: str = "status_update",
    request_id: int | None = None,
    receipt_id: int | None = None,
    email: bool = True,
) -> bool:
    """สร้างการแจ้งเตือนภายในเว็บ และส่งอีเมล (ถ้าอีเมลล้มเหลว ยังคงมีแจ้งเตือนในเว็บ)"""
    db.add(Notification(
        user_id=user.user_id,
        related_request_id=request_id,
        related_receipt_id=receipt_id,
        type=type_,
        subject=subject,
        message=message,
    ))
    if not email:
        return False
    link = f"\n\nดูรายละเอียด: {settings.frontend_url}" + (f"/requests/{request_id}" if request_id else "")
    return send_email(user.email, subject, message + link)


def notify_staff(db: Session, subject: str, message: str, **kwargs) -> None:
    staff = db.scalars(select(User).where(User.role == Role.STAFF, User.is_active.is_(True))).all()
    for s in staff:
        notify(db, s, subject, message, **kwargs)
