"""ตารางทั้ง 14 ตารางตาม ER Diagram (บทที่ 3.4) ของระบบ CS SmartClaim"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

Money = Numeric(12, 2)


class Role:
    TEACHER = "teacher"
    STAFF = "staff"
    ADMIN = "admin"
    ALL = (TEACHER, STAFF, ADMIN)


class RequestStatus:
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    REJECTED = "rejected"
    APPROVED = "approved"
    RECEIPT_SUBMITTED = "receipt_submitted"
    RECEIPT_REJECTED = "receipt_rejected"
    COMPLETED = "completed"
    ALL = (
        DRAFT,
        PENDING_APPROVAL,
        REJECTED,
        APPROVED,
        RECEIPT_SUBMITTED,
        RECEIPT_REJECTED,
        COMPLETED,
    )


class RequestType:
    REIMBURSE = "reimburse"
    NO_REIMBURSE = "no_reimburse"


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    department: Mapped[str | None] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    teacher_profile: Mapped["TeacherProfile | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    travel_requests: Mapped[list["TravelRequest"]] = relationship(back_populates="user")


class TeacherProfile(Base):
    __tablename__ = "teacher_profiles"

    profile_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), unique=True)
    budget_total: Mapped[Decimal] = mapped_column(Money, default=0)
    budget_used: Mapped[Decimal] = mapped_column(Money, default=0)

    user: Mapped[User] = relationship(back_populates="teacher_profile")

    @property
    def budget_remaining(self) -> Decimal:
        return (self.budget_total or 0) - (self.budget_used or 0)


class TravelRequest(Base):
    __tablename__ = "travel_requests"

    request_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"), index=True)
    request_type: Mapped[str] = mapped_column(String(20))
    activity_type: Mapped[str] = mapped_column(String(100))
    event_name: Mapped[str] = mapped_column(String(300))
    location: Mapped[str] = mapped_column(String(300))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(30), default=RequestStatus.DRAFT, index=True)
    estimated_amount: Mapped[Decimal] = mapped_column(Money, default=0)
    actual_amount: Mapped[Decimal | None] = mapped_column(Money)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # ฟิลด์เสริมนอกเหนือ ER: ลิงก์/ไฟล์เอกสารการจัดงาน และวันที่อนุมัติ (ใช้ตรวจวันที่ในใบเสร็จ)
    event_url: Mapped[str | None] = mapped_column(String(500))
    attachment_file: Mapped[str | None] = mapped_column(String(500))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="travel_requests")
    expense_items: Mapped[list["ExpenseItem"]] = relationship(
        back_populates="request", cascade="all, delete-orphan", order_by="ExpenseItem.item_id"
    )
    trips: Mapped[list["Trip"]] = relationship(
        back_populates="request", cascade="all, delete-orphan", order_by="Trip.trip_id"
    )
    hotel_stays: Mapped[list["HotelStay"]] = relationship(
        back_populates="request", cascade="all, delete-orphan", order_by="HotelStay.stay_id"
    )
    history: Mapped[list["RequestStatusHistory"]] = relationship(
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="RequestStatusHistory.changed_at",
    )
    receipts: Mapped[list["Receipt"]] = relationship(back_populates="request")
    generated_documents: Mapped[list["GeneratedDocument"]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )


class ExpenseItem(Base):
    __tablename__ = "expense_items"

    item_id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("travel_requests.request_id", ondelete="CASCADE"))
    category: Mapped[str] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(String(500))
    estimated_amount: Mapped[Decimal] = mapped_column(Money, default=0)
    actual_amount: Mapped[Decimal | None] = mapped_column(Money)

    request: Mapped[TravelRequest] = relationship(back_populates="expense_items")


class RequestStatusHistory(Base):
    __tablename__ = "request_status_history"

    history_id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("travel_requests.request_id", ondelete="CASCADE"))
    changed_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"))
    status: Mapped[str] = mapped_column(String(30))
    note: Mapped[str | None] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    request: Mapped[TravelRequest] = relationship(back_populates="history")
    changed_by_user: Mapped[User | None] = relationship()


class Airline(Base):
    __tablename__ = "airlines"

    airline_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    code: Mapped[str | None] = mapped_column(String(10))
    country: Mapped[str | None] = mapped_column(String(100))
    continent: Mapped[str] = mapped_column(String(20), index=True)
    notes: Mapped[str | None] = mapped_column(Text)


class Trip(Base):
    __tablename__ = "trips"

    trip_id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("travel_requests.request_id", ondelete="CASCADE"))
    flight_number: Mapped[str | None] = mapped_column(String(20))
    airline: Mapped[str | None] = mapped_column(String(200))
    airline_id: Mapped[int | None] = mapped_column(ForeignKey("airlines.airline_id"))
    departure_location: Mapped[str | None] = mapped_column(String(200))
    departure_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    arrival_location: Mapped[str | None] = mapped_column(String(200))
    arrival_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    boarding_pass_file: Mapped[str | None] = mapped_column(String(500))
    e_ticket_file: Mapped[str | None] = mapped_column(String(500))

    request: Mapped[TravelRequest] = relationship(back_populates="trips")


class Hotel(Base):
    __tablename__ = "hotels"

    hotel_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    city: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100))
    continent: Mapped[str] = mapped_column(String(20), index=True)
    sample_folio_file: Mapped[str | None] = mapped_column(String(500))
    sample_receipt_file: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)


class HotelStay(Base):
    __tablename__ = "hotel_stays"

    stay_id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("travel_requests.request_id", ondelete="CASCADE"))
    hotel_id: Mapped[int | None] = mapped_column(ForeignKey("hotels.hotel_id"))
    hotel_name: Mapped[str | None] = mapped_column(String(200))
    city: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100))
    check_in_date: Mapped[date | None] = mapped_column(Date)
    check_out_date: Mapped[date | None] = mapped_column(Date)
    folio_file: Mapped[str | None] = mapped_column(String(500))
    invoice_file: Mapped[str | None] = mapped_column(String(500))

    request: Mapped[TravelRequest] = relationship(back_populates="hotel_stays")


class DocumentSample(Base):
    __tablename__ = "document_samples"

    sample_id: Mapped[int] = mapped_column(primary_key=True)
    managed_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"))
    document_type: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    file: Mapped[str | None] = mapped_column(String(500))
    required_elements: Mapped[list] = mapped_column(JSONB, default=list)


class Receipt(Base):
    __tablename__ = "receipts"

    receipt_id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int | None] = mapped_column(
        ForeignKey("travel_requests.request_id", ondelete="SET NULL"), index=True
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"))
    sample_id: Mapped[int | None] = mapped_column(ForeignKey("document_samples.sample_id", ondelete="SET NULL"))
    mode: Mapped[str] = mapped_column(String(10))  # live / upload
    image_file: Mapped[str | None] = mapped_column(String(500))
    ocr_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    translated_text: Mapped[str | None] = mapped_column(Text)
    source_language: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft / flagged / valid / invalid
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    request: Mapped[TravelRequest | None] = relationship(back_populates="receipts")
    sample: Mapped[DocumentSample | None] = relationship()
    issues: Mapped[list["ReceiptIssue"]] = relationship(
        back_populates="receipt", cascade="all, delete-orphan", order_by="ReceiptIssue.issue_id"
    )


class ReceiptIssue(Base):
    __tablename__ = "receipt_issues"

    issue_id: Mapped[int] = mapped_column(primary_key=True)
    receipt_id: Mapped[int] = mapped_column(ForeignKey("receipts.receipt_id", ondelete="CASCADE"))
    reported_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"))
    issue_type: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(Text)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    receipt: Mapped[Receipt] = relationship(back_populates="issues")


class Notification(Base):
    __tablename__ = "notifications"

    notification_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    related_request_id: Mapped[int | None] = mapped_column(
        ForeignKey("travel_requests.request_id", ondelete="SET NULL")
    )
    related_receipt_id: Mapped[int | None] = mapped_column(ForeignKey("receipts.receipt_id", ondelete="SET NULL"))
    type: Mapped[str] = mapped_column(String(20))  # warning / status_update / reminder
    subject: Mapped[str] = mapped_column(String(300))
    message: Mapped[str | None] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GeneratedDocument(Base):
    __tablename__ = "generated_documents"

    document_id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("travel_requests.request_id", ondelete="CASCADE"))
    generated_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"))
    document_type: Mapped[str] = mapped_column(String(50))
    file_path: Mapped[str] = mapped_column(String(500))
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    request: Mapped[TravelRequest] = relationship(back_populates="generated_documents")
