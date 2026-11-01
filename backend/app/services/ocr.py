"""การรู้จำอักขระด้วยแสง (OCR) ผ่าน Google Cloud Vision API

ตั้งค่า OCR_PROVIDER=google และ GOOGLE_APPLICATION_CREDENTIALS เพื่อใช้บริการจริง
ถ้าเป็น mock ระบบจะคืนข้อความตัวอย่าง เพื่อให้พัฒนาหน้าจอได้โดยไม่ต้องมีบัญชี Google Cloud
"""

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

from app.core.config import BASE_DIR, settings

log = logging.getLogger(__name__)

# ใบเสร็จตัวอย่างสำหรับสาธิตโหมด mock (ไฟล์ภาพ + ผล OCR พร้อมกรอบคำ) — ไม่เก็บใน git
DEMO_DIR = BASE_DIR / "demo"


class OCRError(Exception):
    """บริการ OCR ไม่ตอบสนอง"""


class OCRUnreadable(Exception):
    """อ่านข้อความจากภาพไม่ได้ (ภาพไม่ชัด)"""


@dataclass
class OCRResult:
    text: str
    # แต่ละคำ: {"text": str, "box": [x0, y0, x1, y1]} พิกัดเป็นสัดส่วน 0-1 ของขนาดภาพ
    words: list[dict] = field(default_factory=list)
    # โหมด mock: ชื่อไฟล์ภาพใบเสร็จสาธิตที่หน้าเว็บควรแสดงแทนภาพที่ถ่าย
    demo_image: str | None = None


def run_ocr(content: bytes, mime: str, filename: str = "") -> OCRResult:
    if settings.ocr_provider == "google":
        result = _google_ocr(content, mime)
    else:
        result = _demo_fixture() or OCRResult(_mock_ocr(filename))
    if not result.text or len(result.text.strip()) < 5:
        raise OCRUnreadable("ภาพไม่ชัดหรืออ่านข้อความไม่ได้ กรุณาถ่ายภาพใหม่อีกครั้ง")
    return result


def _google_words(annotation) -> list[dict]:
    words = []
    for page in annotation.pages:
        w, h = page.width or 1, page.height or 1
        for block in page.blocks:
            for para in block.paragraphs:
                for word in para.words:
                    xs = [v.x for v in word.bounding_box.vertices]
                    ys = [v.y for v in word.bounding_box.vertices]
                    words.append({
                        "text": "".join(s.text for s in word.symbols),
                        "box": [round(min(xs) / w, 4), round(min(ys) / h, 4), round(max(xs) / w, 4), round(max(ys) / h, 4)],
                    })
        break  # วาดกรอบเฉพาะหน้าแรก
    return words


def _google_ocr(content: bytes, mime: str) -> OCRResult:
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
            return OCRResult("\n".join(p.full_text_annotation.text for p in pages))

        response = client.document_text_detection(image=vision.Image(content=content))
        if response.error.message:
            raise OCRError(response.error.message)
        annotation = response.full_text_annotation
        return OCRResult(annotation.text, _google_words(annotation))
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


def demo_image_path(name: str) -> Path | None:
    path = (DEMO_DIR / name).resolve()
    if path.parent == DEMO_DIR.resolve() and path.suffix.lower() in (".webp", ".png", ".jpg", ".jpeg") and path.exists():
        return path
    return None


def _demo_fixture() -> OCRResult | None:
    """โหมด mock: ไม่ว่าจะถ่ายภาพอะไร คืนผล OCR ของใบเสร็จสาธิตใน backend/demo/ พร้อมกรอบคำ"""
    if not DEMO_DIR.exists():
        return None
    for path in sorted(DEMO_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        image = next((p.name for p in DEMO_DIR.glob(f"{path.stem}.*") if demo_image_path(p.name)), None)
        return OCRResult(data["raw_text"], data["words"], image)
    return None


def _mock_ocr(filename: str) -> str:
    name = filename.lower()
    if any(k in name for k in ("hotel", "folio", "โรงแรม")):
        return _MOCK_HOTEL_FOLIO
    if any(k in name for k in ("ticket", "boarding", "flight", "itinerary", "ตั๋ว")):
        return _MOCK_ITINERARY
    return _MOCK_THAI_RECEIPT
