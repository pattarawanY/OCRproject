from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

RoleName = Literal["teacher", "staff", "admin"]
Continent = Literal["Asia", "Europe", "America"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth / Users ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class TeacherProfileOut(ORM):
    budget_total: Decimal
    budget_used: Decimal
    budget_remaining: Decimal


class UserOut(ORM):
    user_id: int
    full_name: str
    email: str
    phone: str | None
    department: str | None
    role: str
    is_active: bool
    created_at: datetime
    teacher_profile: TeacherProfileOut | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


def _check_password_rule(v: str) -> str:
    if len(v) < 8 or not any(c.isdigit() for c in v) or not any(c.isalpha() for c in v):
        raise ValueError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีทั้งตัวอักษรและตัวเลข")
    return v


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1)
    email: EmailStr | None = None
    phone: str | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    _rule = field_validator("new_password")(_check_password_rule)

    @model_validator(mode="after")
    def match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("ยืนยันรหัสผ่านไม่ตรงกับรหัสผ่านใหม่")
        return self


class UserCreate(BaseModel):
    full_name: str = Field(min_length=1)
    email: EmailStr
    phone: str | None = None
    department: str | None = "วิทยาการคอมพิวเตอร์และสารสนเทศ"
    role: RoleName
    budget_total: Decimal | None = None
    password: str | None = None  # ถ้าไม่ระบุ ระบบสุ่มให้และส่งทางอีเมล


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    department: str | None = None
    role: RoleName | None = None
    budget_total: Decimal | None = None


class UserAdminResult(BaseModel):
    user: UserOut
    temporary_password: str | None = None
    email_sent: bool


# ---------- Travel requests ----------
class ExpenseItemIn(BaseModel):
    category: str
    description: str | None = None
    estimated_amount: Decimal = Decimal(0)


class ExpenseItemOut(ORM):
    item_id: int
    category: str
    description: str | None
    estimated_amount: Decimal
    actual_amount: Decimal | None


class TripIn(BaseModel):
    flight_number: str | None = None
    airline: str | None = None
    airline_id: int | None = None
    departure_location: str | None = None
    departure_datetime: datetime | None = None
    arrival_location: str | None = None
    arrival_datetime: datetime | None = None


class TripOut(TripIn, ORM):
    trip_id: int
    boarding_pass_file: str | None
    e_ticket_file: str | None


class HotelStayIn(BaseModel):
    hotel_id: int | None = None
    hotel_name: str | None = None
    city: str | None = None
    country: str | None = None
    check_in_date: date | None = None
    check_out_date: date | None = None


class HotelStayOut(HotelStayIn, ORM):
    stay_id: int
    folio_file: str | None
    invoice_file: str | None


class TravelRequestIn(BaseModel):
    request_type: Literal["reimburse", "no_reimburse"]
    activity_type: str = Field(min_length=1)
    event_name: str = Field(min_length=1)
    location: str = Field(min_length=1)
    start_date: date
    end_date: date
    event_url: str | None = None
    expense_items: list[ExpenseItemIn] = []
    trips: list[TripIn] = []
    hotel_stays: list[HotelStayIn] = []
    submit: bool = False  # True = ยื่นคำขอ, False = บันทึกฉบับร่าง

    @model_validator(mode="after")
    def check_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มต้น")
        return self


class StatusHistoryOut(ORM):
    history_id: int
    status: str
    note: str | None
    changed_at: datetime
    changed_by: int | None


class UserBrief(ORM):
    user_id: int
    full_name: str
    email: str
    department: str | None


class ReceiptIssueOut(ORM):
    issue_id: int
    issue_type: str
    description: str
    resolved: bool
    reported_by: int | None


class ReceiptOut(ORM):
    receipt_id: int
    request_id: int | None
    sample_id: int | None
    mode: str
    image_file: str | None
    ocr_data: dict
    translated_text: str | None
    source_language: str | None
    status: str
    created_at: datetime
    issues: list[ReceiptIssueOut] = []


class TravelRequestSummary(ORM):
    request_id: int
    request_type: str
    activity_type: str
    event_name: str
    location: str
    start_date: date
    end_date: date
    status: str
    estimated_amount: Decimal
    actual_amount: Decimal | None
    submitted_at: datetime | None
    updated_at: datetime
    user: UserBrief


class TravelRequestOut(TravelRequestSummary):
    event_url: str | None
    attachment_file: str | None
    approved_at: datetime | None
    expense_items: list[ExpenseItemOut]
    trips: list[TripOut]
    hotel_stays: list[HotelStayOut]
    history: list[StatusHistoryOut]
    receipts: list[ReceiptOut]


class RequestActionResult(BaseModel):
    request: TravelRequestOut
    warnings: list[str] = []


class ReasonIn(BaseModel):
    reason: str = Field(min_length=1, description="เหตุผล/คำแนะนำในการแก้ไข")


class VerifyIn(BaseModel):
    passed: bool
    note: str | None = None

    @model_validator(mode="after")
    def need_reason(self):
        if not self.passed and not (self.note and self.note.strip()):
            raise ValueError("กรุณากรอกเหตุผลกรณีใบเสร็จไม่ผ่าน")
        return self


class ActualAmountIn(BaseModel):
    item_id: int
    actual_amount: Decimal


class SubmitReceiptsIn(BaseModel):
    receipt_ids: list[int]
    actual_amounts: list[ActualAmountIn]


# ---------- OCR ----------
class OCRCheckResult(BaseModel):
    receipt: ReceiptOut
    passed: bool
    warnings: list[str]


# ---------- Samples / Recommendations ----------
class DocumentSampleOut(ORM):
    sample_id: int
    document_type: str
    description: str | None
    file: str | None
    required_elements: list
    managed_by: int | None


class HotelOut(ORM):
    hotel_id: int
    name: str
    city: str | None
    country: str | None
    continent: str
    sample_folio_file: str | None
    sample_receipt_file: str | None
    notes: str | None


class AirlineOut(ORM):
    airline_id: int
    name: str
    code: str | None
    country: str | None
    continent: str
    notes: str | None


# ---------- Notifications ----------
class NotificationOut(ORM):
    notification_id: int
    related_request_id: int | None
    related_receipt_id: int | None
    type: str
    subject: str
    message: str | None
    is_read: bool
    sent_at: datetime
