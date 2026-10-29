"""สร้างข้อมูลเริ่มต้นสำหรับพัฒนา: บัญชีทดสอบ 3 บทบาท, ตัวอย่างเอกสาร, โรงแรมและสายการบินแนะนำ

รัน: python -m app.seed
บัญชีทดสอบ (สำหรับเครื่องพัฒนาเท่านั้น — เปลี่ยนรหัสผ่านก่อนใช้งานจริง):
    admin@smartclaim.local   / Admin1234
    staff@smartclaim.local   / Staff1234
    teacher@smartclaim.local / Teacher1234
"""

from decimal import Decimal

from sqlalchemy import select

from app.core.security import hash_password
from app.db import Base, SessionLocal, engine
from app.models import Airline, DocumentSample, Hotel, Role, TeacherProfile, User
from app.services.validation import DEFAULT_REQUIRED

USERS = [
    ("ผู้ดูแลระบบ", "admin@smartclaim.local", "Admin1234", Role.ADMIN, None),
    ("เจ้าหน้าที่ภาควิชา", "staff@smartclaim.local", "Staff1234", Role.STAFF, None),
    ("อาจารย์ ตัวอย่าง ใจดี", "teacher@smartclaim.local", "Teacher1234", Role.TEACHER, Decimal("50000")),
]

SAMPLES = [
    ("receipt", "ใบเสร็จรับเงินทั่วไป ต้องมีองค์ประกอบครบ 6 รายการตามระเบียบ มจพ. พ.ศ. 2551 หมวด 3 ข้อ 16"),
    ("registration_receipt", "ใบเสร็จค่าลงทะเบียน แนบพร้อมเอกสารและกำหนดการของงาน"),
    ("tax_invoice", "ใบกำกับภาษี ต้องระบุเลขประจำตัวผู้เสียภาษีของผู้ขาย"),
    ("hotel_folio", "ใบเสร็จ/ใบกำกับภาษีค่าที่พัก พร้อม Folio ระบุชื่อผู้เข้าพักและวันที่เข้า-ออก"),
    ("itinerary_receipt", "ใบเสร็จค่าโดยสารเครื่องบินที่ออกโดยสายการบิน พร้อม Itinerary Receipt (ห้ามชำระผ่านเคาน์เตอร์เซอร์วิส)"),
    ("boarding_pass", "บัตรผ่านขึ้นเครื่อง ใช้ยืนยันการเดินทางจริง"),
    ("substitute_receipt", "ใบรับรองแทนใบเสร็จรับเงิน สำหรับรายจ่ายที่เรียกใบเสร็จไม่ได้ เช่น ค่าแท็กซี่"),
]

HOTELS = [
    ("Novotel Tokyo Shinjuku", "Tokyo", "Japan", "Asia", "ใกล้สถานีชินจูกุ ออกใบเสร็จและ Folio ภาษาอังกฤษได้"),
    ("Marina Bay Sands", "Singapore", "Singapore", "Asia", "ใกล้ศูนย์ประชุม Suntec / Sands Expo"),
    ("Lotte Hotel Seoul", "Seoul", "South Korea", "Asia", "ใกล้ COEX ระยะเดินทางสะดวก"),
    ("Hilton London Metropole", "London", "United Kingdom", "Europe", "ใกล้ ExCeL / Paddington"),
    ("Pullman Paris Tour Eiffel", "Paris", "France", "Europe", "ขอ Invoice ชื่อผู้เข้าพักได้"),
    ("Hyatt Regency San Francisco", "San Francisco", "United States", "America", "ใกล้ Moscone Center"),
    ("Sheraton Vancouver Wall Centre", "Vancouver", "Canada", "America", "ใกล้ Vancouver Convention Centre"),
]

AIRLINES = [
    ("Thai Airways International", "TG", "Thailand", "Asia", "ออก Itinerary Receipt ได้จากเว็บไซต์"),
    ("Singapore Airlines", "SQ", "Singapore", "Asia", None),
    ("Japan Airlines", "JL", "Japan", "Asia", None),
    ("Lufthansa", "LH", "Germany", "Europe", "ต่อเครื่องที่แฟรงก์เฟิร์ต/มิวนิก"),
    ("Qatar Airways", "QR", "Qatar", "Europe", "ต่อเครื่องที่โดฮา เส้นทางไปยุโรป"),
    ("EVA Air", "BR", "Taiwan", "America", "ต่อเครื่องที่ไทเป เส้นทางไปอเมริกาเหนือ"),
    ("United Airlines", "UA", "United States", "America", None),
]


def run() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        staff_id = None
        for name, email, pw, role, budget in USERS:
            user = db.scalar(select(User).where(User.email == email))
            if user is None:
                user = User(full_name=name, email=email, password_hash=hash_password(pw), role=role,
                            department="วิทยาการคอมพิวเตอร์และสารสนเทศ")
                if role == Role.TEACHER:
                    user.teacher_profile = TeacherProfile(budget_total=budget, budget_used=0)
                db.add(user)
                db.flush()
            if role == Role.STAFF:
                staff_id = user.user_id

        if not db.scalar(select(DocumentSample.sample_id).limit(1)):
            for doc_type, desc in SAMPLES:
                db.add(DocumentSample(managed_by=staff_id, document_type=doc_type, description=desc,
                                      required_elements=DEFAULT_REQUIRED[doc_type]))
        if not db.scalar(select(Hotel.hotel_id).limit(1)):
            db.add_all(Hotel(name=n, city=c, country=co, continent=ct, notes=nt) for n, c, co, ct, nt in HOTELS)
        if not db.scalar(select(Airline.airline_id).limit(1)):
            db.add_all(Airline(name=n, code=c, country=co, continent=ct, notes=nt) for n, c, co, ct, nt in AIRLINES)
        db.commit()
    print("Seed เสร็จสิ้น")


if __name__ == "__main__":
    run()
