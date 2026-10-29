from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.db import get_db
from app.models import TravelRequest, User
from app.schemas import PasswordChange, ProfileUpdate, TravelRequestSummary, UserOut

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=UserOut)
def get_profile(user: User = Depends(get_current_user)):
    return user


@router.put("", response_model=UserOut)
def update_profile(data: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.email and data.email.lower() != user.email:
        if db.scalar(select(User).where(User.email == data.email.lower())):
            raise HTTPException(status.HTTP_409_CONFLICT, "อีเมลนี้มีผู้ใช้งานแล้ว")
        user.email = data.email.lower()
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.phone is not None:
        user.phone = data.phone
    db.commit()
    db.refresh(user)
    return user


@router.put("/password")
def change_password(data: PasswordChange, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "รหัสผ่านปัจจุบันไม่ถูกต้อง")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "บันทึกสำเร็จ"}


@router.get("/history", response_model=list[TravelRequestSummary])
def claim_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """ประวัติการเบิกของอาจารย์"""
    return db.scalars(
        select(TravelRequest).where(TravelRequest.user_id == user.user_id).order_by(TravelRequest.updated_at.desc())
    ).all()
