"""แปลข้อความจากเอกสารภาษาต่างประเทศเป็นภาษาไทยด้วย Google Cloud Translation API"""

import logging
import re

from app.core.config import settings

log = logging.getLogger(__name__)

_THAI = re.compile(r"[฀-๿]")


class TranslationError(Exception):
    pass


def detect_and_translate(text: str) -> tuple[str, str | None]:
    """คืน (ภาษาต้นฉบับ, ข้อความแปลเป็นไทย หรือ None ถ้าเป็นภาษาไทยอยู่แล้ว)"""
    if settings.translate_provider == "google":
        return _google(text)
    return _mock(text)


def _google(text: str) -> tuple[str, str | None]:
    try:
        from google.cloud import translate_v2

        client = translate_v2.Client()
        detected = client.detect_language(text)
        lang = detected.get("language", "und")
        if lang == "th":
            return lang, None
        result = client.translate(text, target_language="th", format_="text")
        return lang, result["translatedText"]
    except Exception as exc:
        log.exception("Google Translation failed")
        raise TranslationError("ระบบแปลภาษาไม่ตอบสนอง กรุณาลองใหม่อีกครั้งภายหลัง") from exc


def _mock(text: str) -> tuple[str, str | None]:
    letters = [c for c in text if c.isalpha()]
    thai_ratio = sum(1 for c in letters if _THAI.match(c)) / max(len(letters), 1)
    if thai_ratio > 0.3:
        return "th", None
    return "en", "[คำแปลจำลอง — ตั้งค่า TRANSLATE_PROVIDER=google เพื่อแปลจริง]\n" + text
