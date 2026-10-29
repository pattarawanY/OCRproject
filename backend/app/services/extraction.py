"""ดึงข้อมูลแบบมีโครงสร้างจากข้อความ OCR ด้วย regex/คีย์เวิร์ด"""

import re
from datetime import date

THAI_MONTHS = {
    "มกราคม": 1, "ม.ค.": 1, "กุมภาพันธ์": 2, "ก.พ.": 2, "มีนาคม": 3, "มี.ค.": 3,
    "เมษายน": 4, "เม.ย.": 4, "พฤษภาคม": 5, "พ.ค.": 5, "มิถุนายน": 6, "มิ.ย.": 6,
    "กรกฎาคม": 7, "ก.ค.": 7, "สิงหาคม": 8, "ส.ค.": 8, "กันยายน": 9, "ก.ย.": 9,
    "ตุลาคม": 10, "ต.ค.": 10, "พฤศจิกายน": 11, "พ.ย.": 11, "ธันวาคม": 12, "ธ.ค.": 12,
}
EN_MONTHS = {m: i for i, m in enumerate(
    ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"], start=1
)}

DOC_TYPES = {
    "itinerary_receipt": "Itinerary Receipt / e-ticket",
    "boarding_pass": "Boarding pass",
    "hotel_folio": "ใบเสร็จค่าที่พัก / Folio",
    "tax_invoice": "ใบกำกับภาษี",
    "registration_receipt": "ใบเสร็จค่าลงทะเบียน",
    "substitute_receipt": "ใบรับรองแทนใบเสร็จรับเงิน",
    "receipt": "ใบเสร็จรับเงินทั่วไป",
}

# ประเภทเอกสาร -> หมวดค่าใช้จ่าย สำหรับกรอกยอดจริงอัตโนมัติ
DOC_TYPE_CATEGORY = {
    "itinerary_receipt": "ค่าเดินทาง",
    "boarding_pass": "ค่าเดินทาง",
    "hotel_folio": "ค่าที่พัก",
    "registration_receipt": "ค่าลงทะเบียน",
}


def _year(y: int) -> int:
    if y > 2400:  # พ.ศ.
        return y - 543
    if y < 100:
        return 2000 + y
    return y


def _safe_date(y: int, m: int, d: int) -> date | None:
    try:
        return date(_year(y), m, d)
    except ValueError:
        return None


def parse_dates(text: str) -> list[date]:
    found: list[tuple[int, date]] = []
    for m in re.finditer(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b", text):
        d = _safe_date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        if d:
            found.append((m.start(), d))
    for m in re.finditer(r"\b(\d{4})-(\d{2})-(\d{2})\b", text):
        d = _safe_date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        if d:
            found.append((m.start(), d))
    for m in re.finditer(r"\b(\d{1,2})\s*([A-Za-z]{3})[A-Za-z]*\.?\s*(\d{2,4})\b", text):
        mon = EN_MONTHS.get(m.group(2).upper())
        if mon:
            d = _safe_date(int(m.group(3)), mon, int(m.group(1)))
            if d:
                found.append((m.start(), d))
    thai = "|".join(re.escape(k) for k in THAI_MONTHS)
    for m in re.finditer(rf"(\d{{1,2}})\s*({thai})\s*(\d{{4}})", text):
        d = _safe_date(int(m.group(3)), THAI_MONTHS[m.group(2)], int(m.group(1)))
        if d:
            found.append((m.start(), d))
    return [d for _, d in sorted(found, key=lambda x: x[0])]


def _labeled_date(text: str, labels: str) -> date | None:
    m = re.search(rf"(?:{labels})\s*[:：]?\s*([^\n]{{0,30}})", text, re.IGNORECASE)
    if m:
        dates = parse_dates(m.group(1))
        if dates:
            return dates[0]
    return None


def _amount(s: str) -> float | None:
    try:
        return float(s.replace(",", ""))
    except ValueError:
        return None


def classify(text: str) -> str:
    t = text.lower()
    if "boarding pass" in t:
        return "boarding_pass"
    if any(k in t for k in ("itinerary", "e-ticket", "eticket", "ticket number")):
        return "itinerary_receipt"
    if any(k in t for k in ("folio", "guest name", "check-in", "arrival", "ผู้เข้าพัก")):
        return "hotel_folio"
    if "ใบรับรองแทนใบเสร็จ" in t:
        return "substitute_receipt"
    if any(k in t for k in ("registration", "ลงทะเบียน")):
        return "registration_receipt"
    if any(k in t for k in ("ใบกำกับภาษี", "tax invoice")):
        return "tax_invoice"
    return "receipt"


def extract_fields(text: str) -> dict:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    doc_type = classify(text)
    f: dict = {"document_type": doc_type, "document_type_label": DOC_TYPES[doc_type]}

    book = re.search(r"เล่มที่\s*[:]?\s*([A-Za-z0-9\-/]+)", text)
    number = re.search(
        r"(?:เลขที่|Receipt\s*No\.?|Invoice\s*No\.?|Folio\s*No\.?|Ticket\s*Number|No\.)\s*[:#]?\s*([A-Za-z0-9\-/]{3,})",
        text,
        re.IGNORECASE,
    )
    f["book_no"] = book.group(1) if book else None
    f["receipt_no"] = number.group(1) if number else None

    f["payee_name"] = lines[0] if lines else None
    addr = next(
        (ln for ln in lines if re.search(r"ถนน|แขวง|เขต|ตำบล|อำเภอ|จังหวัด|Road|Street|\bSt\.|-ku|\b\d{5}\b", ln, re.I)),
        None,
    )
    f["payee_address"] = addr

    issue_date = _labeled_date(text, r"วันที่|Date of issue|Date")
    all_dates = parse_dates(text)
    f["date"] = (issue_date or (all_dates[0] if all_dates else None))

    amounts = []
    for m in re.finditer(
        r"(?:รวมเงิน|รวมทั้งสิ้น|ยอดรวม|จำนวนเงิน|Grand\s*Total|Total|Amount)[^\d\n]{0,15}([\d,]+(?:\.\d{2})?)",
        text,
        re.IGNORECASE,
    ):
        v = _amount(m.group(1))
        if v:
            amounts.append(v)
    f["amount"] = max(amounts) if amounts else None

    cur = re.search(r"\b(THB|USD|EUR|JPY|GBP|SGD|CNY|KRW)\b|฿|บาท", text)
    f["currency"] = (cur.group(1) or "THB") if cur else None
    if cur and cur.group(0) in ("฿", "บาท"):
        f["currency"] = "THB"

    words = re.search(r"\(?([ก-๙]+บาท(?:ถ้วน)?[ก-๙]*)\)?", text) or re.search(
        r"([A-Za-z][A-Za-z\s\-]+\b(?:only|ONLY))", text
    )
    f["amount_in_words"] = words.group(1).strip() if words else None

    desc = re.search(r"(?:รายการ|Description|Item)\s*[:]?\s*([^\n]+)", text, re.IGNORECASE)
    f["description"] = desc.group(1).strip() if desc else None

    f["has_signature"] = bool(
        re.search(r"ผู้รับเงิน|ลงชื่อ|ลายมือชื่อ|signature|authorized|cashier|received by|issued by", text, re.I)
    )
    tax = re.search(r"\b(\d{13})\b|\b(\d-\d{4}-\d{5}-\d{2}-\d)\b", text)
    f["tax_id"] = (tax.group(1) or tax.group(2)) if tax else None
    f["paid_at_counter_service"] = bool(
        re.search(r"counter\s*service|เคาน์เตอร์\s*เซอร์วิส|7-?eleven|เซเว่น", text, re.I)
    )

    guest = re.search(r"(?:Guest(?:\s*Name)?|ชื่อผู้เข้าพัก|Passenger)\s*[:]?\s*([^\n]+)", text, re.I)
    f["guest_name"] = guest.group(1).strip() if guest else None
    f["check_in"] = _labeled_date(text, r"Arrival|Check[- ]?in|วันเข้าพัก")
    f["check_out"] = _labeled_date(text, r"Departure|Check[- ]?out|วันออก")
    flights = re.findall(r"Flight\s*:?\s*([A-Z0-9]{2})\s?(\d{2,4})", text, re.I)
    f["flight_numbers"] = [f"{a.upper()}{b}" for a, b in flights]

    f["category"] = DOC_TYPE_CATEGORY.get(doc_type)
    # JSON-serializable
    for k in ("date", "check_in", "check_out"):
        if isinstance(f[k], date):
            f[k] = f[k].isoformat()
    return f
