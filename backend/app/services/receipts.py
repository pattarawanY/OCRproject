"""กระบวนการ OCR -> แปลภาษา -> ดึงข้อมูล -> ตรวจตามเกณฑ์ ที่ใช้ร่วมกันทั้งโหมด live-check และ upload"""

from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DocumentSample, HotelStay, Receipt, ReceiptIssue, TravelRequest, Trip
from app.services.extraction import extract_fields, tag_words
from app.services.ocr import OCRError, OCRResult, OCRUnreadable, run_ocr
from app.services.translation import TranslationError, detect_and_translate
from app.services.validation import validate


def find_sample(db: Session, document_type: str) -> DocumentSample | None:
    return db.scalars(
        select(DocumentSample).where(DocumentSample.document_type == document_type).order_by(DocumentSample.sample_id)
    ).first()


def _norm_flight(code: str | None) -> str:
    return (code or "").replace(" ", "").upper()


def link_travel_documents(req: TravelRequest) -> None:
    """ผูกไฟล์ e-ticket / boarding pass / folio เข้ากับการเดินทางและการเข้าพักของคำขอ
    ถ้ายังไม่มีรายการที่ตรงกัน ระบบสร้างให้จากข้อมูล OCR (กรอกแบบฟอร์มอัตโนมัติ)"""
    for r in req.receipts:
        f = (r.ocr_data or {}).get("fields") or {}
        doc_type = f.get("document_type")
        if doc_type in ("itinerary_receipt", "boarding_pass"):
            column = "e_ticket_file" if doc_type == "itinerary_receipt" else "boarding_pass_file"
            for code in f.get("flight_numbers") or []:
                trip = next((t for t in req.trips if _norm_flight(t.flight_number) == _norm_flight(code)), None)
                if trip is None:
                    trip = Trip(flight_number=code, airline=f.get("payee_name") if doc_type == "itinerary_receipt" else None)
                    req.trips.append(trip)
                setattr(trip, column, r.image_file)
        elif doc_type == "hotel_folio":
            check_in = date.fromisoformat(f["check_in"]) if f.get("check_in") else None
            stay = next((s for s in req.hotel_stays if check_in and s.check_in_date == check_in), None)
            if stay is None and len(req.hotel_stays) == 1 and not req.hotel_stays[0].folio_file:
                stay = req.hotel_stays[0]
            if stay is None:
                stay = HotelStay(hotel_name=f.get("payee_name"), check_in_date=check_in)
                req.hotel_stays.append(stay)
            if f.get("check_out") and stay.check_out_date is None:
                stay.check_out_date = date.fromisoformat(f["check_out"])
            stay.folio_file = r.image_file


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
    ocr_failed: str | None = None
    try:
        ocr = run_ocr(content, mime, filename)
    except (OCRUnreadable, OCRError) as exc:
        # live-check ให้ถ่ายใหม่ ส่วนโหมด upload เก็บไฟล์ไว้แล้วให้อาจารย์กรอกข้อมูลเอง
        if mode != "upload":
            code = status.HTTP_422_UNPROCESSABLE_ENTITY if isinstance(exc, OCRUnreadable) else status.HTTP_503_SERVICE_UNAVAILABLE
            raise HTTPException(code, str(exc))
        ocr, ocr_failed = OCRResult(""), f"{exc} — หรือกดแก้ไขข้อมูลเพื่อกรอกข้อมูลเอง"

    text = ocr.text
    source_lang, translated = None, None
    if text:
        try:
            source_lang, translated = detect_and_translate(text)
        except TranslationError:
            pass

    # ใช้ข้อความต้นฉบับในการดึงข้อมูล (ตัวเลข/วันที่) และใช้คำแปลประกอบการแสดงผล
    fields = extract_fields(text)

    sample = db.get(DocumentSample, sample_id) if sample_id else find_sample(db, fields["document_type"])
    issues = validate(
        fields,
        required_elements=sample.required_elements if sample else None,
        approved_at=request.approved_at if request else None,
    )
    if ocr_failed:
        issues.insert(0, ("ocr_failed", ocr_failed))

    receipt = Receipt(
        request_id=request.request_id if request else None,
        user_id=user_id,
        sample_id=sample.sample_id if sample else None,
        mode=mode,
        image_file=image_file,
        ocr_data={
            "raw_text": text,
            "fields": fields,
            "words": tag_words(ocr.words, fields),
            "demo_image": ocr.demo_image,
        },
        translated_text=translated,
        source_language=source_lang,
        status="flagged" if issues else "valid",
    )
    receipt.issues = [ReceiptIssue(issue_type=t, description=d) for t, d in issues]
    db.add(receipt)
    db.flush()
    return receipt
