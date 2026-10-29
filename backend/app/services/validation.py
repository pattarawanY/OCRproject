"""ตรวจสอบความครบถ้วนของเอกสารตามเกณฑ์การเบิกจ่าย (หัวข้อ 2.1.1)

- องค์ประกอบ 6 รายการของใบเสร็จ ตามระเบียบ มจพ. ว่าด้วยการเบิกจ่ายเงินรายได้ พ.ศ. 2551 หมวด 3 ข้อ 16
- วันที่ในใบเสร็จต้องไม่ก่อนวันที่คำขอได้รับอนุมัติ
- ใบเสร็จค่าโดยสารที่ชำระผ่านเคาน์เตอร์เซอร์วิสไม่สามารถใช้เบิกได้
- ใบเสร็จค่าที่พักต้องระบุชื่อผู้เข้าพักและวันที่เข้า-ออก
ผลการตรวจเป็นคำเตือนแบบ non-blocking เท่านั้น
"""

from datetime import date, datetime

# key -> (ชื่อแสดงผล, ฟังก์ชันตรวจว่ามีในข้อมูลที่ดึงได้หรือไม่)
ELEMENTS: dict[str, tuple[str, callable]] = {
    "receipt_number": ("เล่มที่หรือรหัส และเลขที่", lambda f: bool(f.get("receipt_no") or f.get("book_no"))),
    "payee_name_address": ("ชื่อและที่อยู่หรือที่ทำการของผู้รับเงิน", lambda f: bool(f.get("payee_name") and f.get("payee_address"))),
    "date": ("วัน เดือน ปี ที่รับเงิน", lambda f: bool(f.get("date"))),
    "description": ("รายการที่ระบุว่าเป็นค่าอะไร", lambda f: bool(f.get("description"))),
    "amount_numeric_and_words": ("จำนวนเงินทั้งตัวเลขและตัวอักษร", lambda f: bool(f.get("amount") and f.get("amount_in_words"))),
    "payee_signature": ("ลายมือชื่อผู้รับเงิน", lambda f: bool(f.get("has_signature"))),
    "tax_id": ("เลขประจำตัวผู้เสียภาษีของผู้ขาย", lambda f: bool(f.get("tax_id"))),
    "guest_name": ("ชื่อผู้เข้าพัก", lambda f: bool(f.get("guest_name"))),
    "check_in_out": ("วันที่เข้า-ออกที่พัก", lambda f: bool(f.get("check_in") and f.get("check_out"))),
    "flight_info": ("รายละเอียดเที่ยวบิน", lambda f: bool(f.get("flight_numbers"))),
}

SIX_ELEMENTS = [
    "receipt_number",
    "payee_name_address",
    "date",
    "description",
    "amount_numeric_and_words",
    "payee_signature",
]

DEFAULT_REQUIRED = {
    "receipt": SIX_ELEMENTS,
    "registration_receipt": SIX_ELEMENTS,
    "tax_invoice": SIX_ELEMENTS + ["tax_id"],
    "hotel_folio": SIX_ELEMENTS + ["guest_name", "check_in_out"],
    "itinerary_receipt": ["receipt_number", "payee_name_address", "date", "amount_numeric_and_words", "flight_info"],
    "boarding_pass": ["flight_info"],
    "substitute_receipt": ["date", "description", "amount_numeric_and_words", "payee_signature"],
}


def element_options() -> list[dict]:
    return [{"key": k, "label": v[0]} for k, v in ELEMENTS.items()]


def validate(
    fields: dict,
    required_elements: list[str] | None = None,
    approved_at: datetime | None = None,
) -> list[tuple[str, str]]:
    """คืนรายการปัญหา (issue_type, description) — ว่างแปลว่าผ่านเกณฑ์"""
    doc_type = fields.get("document_type", "receipt")
    required = required_elements or DEFAULT_REQUIRED.get(doc_type, SIX_ELEMENTS)
    issues: list[tuple[str, str]] = []

    for key in required:
        spec = ELEMENTS.get(key)
        if spec and not spec[1](fields):
            issues.append(("missing_element", f"ไม่พบ: {spec[0]}"))

    if approved_at and fields.get("date"):
        receipt_date = date.fromisoformat(fields["date"])
        if receipt_date < approved_at.date():
            issues.append((
                "date_before_approval",
                f"วันที่ในใบเสร็จ ({receipt_date:%d/%m/%Y}) อยู่ก่อนวันที่คำขอได้รับอนุมัติ "
                f"({approved_at:%d/%m/%Y}) อาจไม่สามารถใช้เบิกได้",
            ))

    if doc_type in ("itinerary_receipt", "boarding_pass", "receipt") and fields.get("paid_at_counter_service"):
        issues.append((
            "counter_service",
            "ใบเสร็จค่าโดยสารที่ชำระผ่านเคาน์เตอร์เซอร์วิสไม่สามารถใช้เบิกได้",
        ))

    return issues
