"""จัดการบัญชีผู้ใช้ (ผู้ดูแลระบบ)"""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_roles
from app.core.security import generate_password, hash_password
from app.db import get_db
from app.models import Role, TeacherProfile, User
from app.schemas import UserAdminResult, UserCreate, UserOut, UserUpdate
from app.services.email import send_email

router = APIRouter(prefix="/admin/users", tags=["admin: users"])
admin_only = require_roles(Role.ADMIN)


def _get(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ไม่พบผู้ใช้")
    return user


def _ensure_teacher_profile(user: User, budget: Decimal | None) -> None:
    if user.role == Role.TEACHER:
        if user.teacher_profile is None:
            user.teacher_profile = TeacherProfile(budget_total=budget or 0, budget_used=0)
        elif budget is not None:
            user.teacher_profile.budget_total = budget


def _send_credentials(user: User, password: str, reset: bool) -> bool:
    head = "รีเซ็ตรหัสผ่าน" if reset else "สร้างบัญชีผู้ใช้"
    body = (
        f"เรียน {user.full_name}\n\n{head}ในระบบ CS SmartClaim เรียบร้อยแล้ว\n"
        f"อีเมล: {user.email}\nรหัสผ่านชั่วคราว: {password}\n\n"
        f"กรุณาเข้าสู่ระบบที่ {settings.frontend_url}/login และเปลี่ยนรหัสผ่านในหน้าโปรไฟล์"
    )
    return send_email(user.email, head, body)


@router.get("", response_model=list[UserOut])
def list_users(
    q: str | None = Query(None, description="ค้นหาจากชื่อหรืออีเมล"),
    role: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    stmt = select(User).order_by(User.user_id)
    if q:
        stmt = stmt.where(or_(User.full_name.ilike(f"%{q}%"), User.email.ilike(f"%{q}%")))
    if role:
        stmt = stmt.where(User.role == role)
    return db.scalars(stmt).all()


@router.post("", response_model=UserAdminResult, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "มีบัญชีอีเมลนี้อยู่แล้ว")
    password = data.password or generate_password()
    user = User(
        full_name=data.full_name,
        email=email,
        phone=data.phone,
        department=data.department,
        role=data.role,
        password_hash=hash_password(password),
    )
    _ensure_teacher_profile(user, data.budget_total)
    db.add(user)
    db.commit()
    db.refresh(user)
    sent = _send_credentials(user, password, reset=False)
    return UserAdminResult(user=user, email_sent=sent, temporary_password=None if sent else password)


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    user = _get(db, user_id)
    if data.email and data.email.lower() != user.email:
        if db.scalar(select(User).where(User.email == data.email.lower())):
            raise HTTPException(status.HTTP_409_CONFLICT, "มีบัญชีอีเมลนี้อยู่แล้ว")
        user.email = data.email.lower()
    for field in ("full_name", "phone", "department", "role"):
        value = getattr(data, field)
        if value is not None:
            setattr(user, field, value)
    _ensure_teacher_profile(user, data.budget_total)
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/toggle-active", response_model=UserOut)
def toggle_active(user_id: int, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    user = _get(db, user_id)
    if user.user_id == admin.user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "ไม่สามารถระงับบัญชีของตนเองได้")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/reset-password", response_model=UserAdminResult)
def reset_password(user_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    user = _get(db, user_id)
    password = generate_password()
    user.password_hash = hash_password(password)
    db.commit()
    sent = _send_credentials(user, password, reset=True)
    return UserAdminResult(user=user, email_sent=sent, temporary_password=None if sent else password)
