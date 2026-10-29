"""การเปลี่ยนสถานะคำขอ (7 สถานะ) พร้อมบันทึกประวัติ (Audit Trail)"""

from fastapi import HTTPException, status

from app.models import RequestStatusHistory, TravelRequest, User


def change_status(req: TravelRequest, new_status: str, by: User | None, note: str | None = None) -> None:
    req.status = new_status
    req.history.append(RequestStatusHistory(
        status=new_status,
        note=note,
        changed_by=by.user_id if by else None,
    ))


def ensure_status(req: TravelRequest, *allowed: str) -> None:
    if req.status not in allowed:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"ไม่สามารถดำเนินการได้ในสถานะปัจจุบัน ({req.status})",
        )
