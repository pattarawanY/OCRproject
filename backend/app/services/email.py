import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

log = logging.getLogger(__name__)


def send_email(to: str, subject: str, body: str) -> bool:
    """ส่งอีเมลผ่าน SMTP; ถ้าไม่ได้ตั้งค่า SMTP จะเขียนลง log แทน คืน True เมื่อส่งสำเร็จ"""
    if not settings.smtp_host:
        log.info("[email disabled] to=%s subject=%s\n%s", to, subject, body)
        return False

    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = f"[CS SmartClaim] {subject}"
    msg.set_content(body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password or "")
            smtp.send_message(msg)
        return True
    except Exception:
        log.exception("SMTP send failed to %s", to)
        return False
