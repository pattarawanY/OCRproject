"""การรู้จำอักขระด้วยแสง (OCR) ผ่าน Google Cloud Vision API

ตั้งค่า OCR_PROVIDER=google และ GOOGLE_APPLICATION_CREDENTIALS เพื่อใช้บริการจริง
ถ้าเป็น mock ระบบจะคืนข้อความตัวอย่าง เพื่อให้พัฒนาหน้าจอได้โดยไม่ต้องมีบัญชี Google Cloud
"""

import logging

from app.core.config import settings

log = logging.getLogger(__name__)


class OCRError(Exception):
    """บริการ OCR ไม่ตอบสนอง"""


class OCRUnreadable(Exception):
    """อ่านข้อความจากภาพไม่ได้ (ภาพไม่ชัด)"""


def run_ocr(content: bytes, mime: str, filename: str = "") -> str:
    if settings.ocr_provider == "google":
        text = _google_ocr(content, mime)
    else:
        text = _mock_ocr(filename)
    if not text or len(text.strip()) < 5:
        raise OCRUnreadable("ภาพไม่ชัดหรืออ่านข้อความไม่ได้ กรุณาถ่ายภาพใหม่อีกครั้ง")
    return text


def _google_ocr(content: bytes, mime: str) -> str:
    try:
        from google.cloud import vision

        client = vision.ImageAnnotatorClient()
        if mime == "application/pdf":
            feature = vision.Feature(type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION)
            req = vision.AnnotateFileRequest(
                input_config=vision.InputConfig(content=content, mime_type="application/pdf"),
                features=[feature],
                pages=[1, 2, 3, 4, 5],
            )
            result = client.batch_annotate_files(requests=[req])
            pages = result.responses[0].responses
            return "\n".join(p.full_text_annotation.text for p in pages)

        response = client.document_text_detection(image=vision.Image(content=content))
        if response.error.message:
            raise OCRError(response.error.message)
        return response.full_text_annotation.text
    except OCRError:
        raise
    except Exception as exc:  # network / auth / quota
        log.exception("Google Vision OCR failed")
        raise OCRError("บริการ OCR ไม่ตอบสนอง กรุณาลองใหม่อีกครั้งภายหลัง") from exc


_MOCK_THAI_RECEIPT = """บริษัท ตัวอย่างสัมมนา จำกัด
1518 ถนนประชาราษฎร์ 1 แขวงวงศ์สว่าง เขตบางซื่อ กรุงเทพฯ 10800
เลขประจำตัวผู้เสียภาษี 0105561234567
ใบเสร็จรับเงิน
เล่มที่ 12 เลขที่ 000345
วันที่ 15/11/2569
ได้รับเงินจาก ผศ.ดร.ตัวอย่าง ใจดี
รายการ ค่าลงทะเบียนเข้าร่วมประชุมวิชาการ NCCIT 2026  3,500.00
รวมเงิน 3,500.00
(สามพันห้าร้อยบาทถ้วน)
ลงชื่อ ผู้รับเงิน
"""

_MOCK_HOTEL_FOLIO = """Grand Example Hotel Tokyo
1-2-3 Shinjuku, Shinjuku-ku, Tokyo 160-0022 Japan
GUEST FOLIO / RECEIPT
Folio No: F-88213
Guest Name: Dr. Example Jaidee
Arrival: 10/12/2026  Departure: 13/12/2026
Date: 13/12/2026
Description: Room Charge 3 nights   JPY 54,000
Total JPY 54,000
Amount in words: Fifty four thousand yen only
Cashier signature: K. Sato
"""

_MOCK_ITINERARY = """Thai Example Airways
Itinerary Receipt / e-Ticket
Ticket Number: 217-2400123456
Booking Reference: ABC123
Passenger: JAIDEE/EXAMPLE DR
Flight TG 642  BKK - NRT  10DEC2026 23:45
Flight TG 643  NRT - BKK  13DEC2026 17:30
Date of issue: 20/11/2026
Fare Total THB 28,450.00
Twenty eight thousand four hundred fifty baht only
Payment: Credit card
Issued by: Thai Example Airways, 89 Vibhavadi Rangsit Road, Bangkok 10900
"""


def _mock_ocr(filename: str) -> str:
    name = filename.lower()
    if any(k in name for k in ("hotel", "folio", "โรงแรม")):
        return _MOCK_HOTEL_FOLIO
    if any(k in name for k in ("ticket", "boarding", "flight", "itinerary", "ตั๋ว")):
        return _MOCK_ITINERARY
    return _MOCK_THAI_RECEIPT
