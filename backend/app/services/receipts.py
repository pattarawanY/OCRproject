"""กระบวนการ OCR -> แปลภาษา -> ดึงข้อมูล -> ตรวจตามเกณฑ์ ที่ใช้ร่วมกันทั้งโหมด live-check และ upload"""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DocumentSample, Receipt, ReceiptIssue, TravelRequest
from app.services.extraction import extract_fields
from app.services.ocr import OCRError, OCRUnreadable, run_ocr
from app.services.translation import TranslationError, detect_and_translate
from app.services.validation import validate


def find_sample(db: Session, document_type: str) -> DocumentSample | None:
    return db.scalars(
        select(DocumentSample).where(DocumentSample.document_type == document_type).order_by(DocumentSample.sample_id)
    ).first()


def process_document(
    db: Session,
    *,
    content: bytes,
    mime: str,
    filename: str,
    mode: str,
    image_file: str | None,
    user_id: int | None,
    request: TravelRequest | None = None,
    sample_id: int | None = None,
) -> Receipt:
    try:
        text = run_ocr(content, mime, filename)
    except OCRUnreadable as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    except OCRError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))

    try:
        source_lang, translated = detect_and_translate(text)
    except TranslationError:
        source_lang, translated = None, None

    # ใช้ข้อความต้นฉบับในการดึงข้อมูล (ตัวเลข/วันที่) และใช้คำแปลประกอบการแสดงผล
    fields = extract_fields(text)

    sample = db.get(DocumentSample, sample_id) if sample_id else find_sample(db, fields["document_type"])
    issues = validate(
        fields,
        required_elements=sample.required_elements if sample else None,
        approved_at=request.approved_at if request else None,
    )

    receipt = Receipt(
        request_id=request.request_id if request else None,
        user_id=user_id,
        sample_id=sample.sample_id if sample else None,
        mode=mode,
        image_file=image_file,
        ocr_data={"raw_text": text, "fields": fields},
        translated_text=translated,
        source_language=source_lang,
        status="flagged" if issues else "valid",
    )
    receipt.issues = [ReceiptIssue(issue_type=t, description=d) for t, d in issues]
    db.add(receipt)
    db.flush()
    return receipt
