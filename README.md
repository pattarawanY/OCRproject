# CS SmartClaim

ระบบตรวจสอบเอกสารอนุมัติตัวและใบเสร็จรับเงินอัตโนมัติด้วย AI สำหรับภาควิชาวิทยาการคอมพิวเตอร์และสารสนเทศ มจพ.

| ส่วน | เทคโนโลยี | โฟลเดอร์ |
| --- | --- | --- |
| Backend (REST API) | FastAPI + SQLAlchemy + Pydantic | `backend/` |
| ฐานข้อมูล | PostgreSQL 16 | (Docker) |
| Frontend | Next.js 15 (App Router) + Tailwind CSS | `frontend/` |
| OCR / แปลภาษา | Google Cloud Vision API / Translation API | `backend/app/services/` |

## เริ่มต้นใช้งานด้วย Docker (แนะนำ)

ต้องติดตั้ง [Docker Desktop](https://www.docker.com/products/docker-desktop/) ก่อน

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

- Frontend: http://localhost:3000
- API + Swagger UI: http://localhost:8000/docs

Backend จะสร้างตารางและข้อมูลเริ่มต้น (`python -m app.seed`) ให้อัตโนมัติ

### บัญชีทดสอบ (เครื่องพัฒนาเท่านั้น)

| บทบาท | อีเมล | รหัสผ่าน |
| --- | --- | --- |
| ผู้ดูแลระบบ | admin@smartclaim.local | Admin1234 |
| เจ้าหน้าที่ | staff@smartclaim.local | Staff1234 |
| อาจารย์ | teacher@smartclaim.local | Teacher1234 |

## รันแบบไม่ใช้ Docker

ต้องมี Python 3.12+, Node.js 20+ และ PostgreSQL ที่สร้างฐานข้อมูล `smartclaim` (user/password `smartclaim`) ไว้แล้ว
หรือแก้ `DATABASE_URL` ใน `backend/.env`

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload
```

```bash
# Frontend (อีกหน้าต่าง)
cd frontend
npm install
npm run dev
```

## การตั้งค่า (`backend/.env`)

| ตัวแปร | ความหมาย |
| --- | --- |
| `OCR_PROVIDER` / `TRANSLATE_PROVIDER` | `mock` = ข้อความตัวอย่าง (ไม่ต้องมีบัญชี Google), `google` = ใช้บริการจริง |
| `GOOGLE_APPLICATION_CREDENTIALS` | path ไฟล์ service account JSON (เปิด Vision API และ Translation API) |
| `SMTP_*` | ตั้งค่าส่งอีเมล ถ้าเว้น `SMTP_HOST` ว่างจะเขียนอีเมลลง log แทน |
| `PDF_FONT_PATH` | ฟอนต์ไทยสำหรับ PDF เช่น `C:/Windows/Fonts/tahoma.ttf` (Docker ตั้งให้แล้ว) |
| `JWT_SECRET` | ต้องเปลี่ยนก่อนใช้งานจริง |

โหมด `mock`: ตั้งชื่อไฟล์ให้มีคำว่า `hotel`/`folio` หรือ `ticket`/`boarding` เพื่อทดสอบใบเสร็จโรงแรมหรือตั๋วเครื่องบิน
ชื่อไฟล์อื่นจะได้ใบเสร็จค่าลงทะเบียนภาษาไทย

## โครงสร้างระบบ

```
backend/app/
  models.py            14 ตารางตาม ER Diagram (users, teacher_profiles, travel_requests, ...)
  schemas.py           Pydantic schemas
  api/routes/          auth, profile, admin/users, requests, receipts, samples,
                       recommendations, notifications, admin/dashboard, files
  services/
    ocr.py             Google Cloud Vision (รองรับ JPG, PNG, PDF)
    translation.py     Google Cloud Translation (ตรวจจับภาษา + แปลเป็นไทย)
    extraction.py      ดึงเลขที่ วันที่ ยอดเงิน ผู้รับเงิน ฯลฯ จากข้อความ OCR
    validation.py      เกณฑ์ตรวจ: องค์ประกอบ 6 รายการ, วันที่หลังอนุมัติ, เคาน์เตอร์เซอร์วิส, folio
    workflow.py        เปลี่ยนสถานะ 7 สถานะ + บันทึกประวัติ
    notify.py/email.py แจ้งเตือนในเว็บ + อีเมล (SMTP)
    pdf.py             สร้างเอกสารเบิกจ่ายและรายงาน PDF
frontend/src/app/
  scan, recommendations           ใช้ได้โดยไม่ต้องเข้าสู่ระบบ
  teacher/...                     หน้าหลัก ยื่นคำขอ แก้ไข ส่งใบเสร็จ
  staff/...                       แดชบอร์ด พิจารณาคำขอ ตรวจใบเสร็จ จัดการตัวอย่างเอกสาร
  admin/...                       แดชบอร์ด/รายงาน (PDF, Excel) จัดการบัญชีผู้ใช้
  profile, notifications, samples ฟังก์ชันร่วม
```

### ส่วนที่เพิ่มจาก ER Diagram ในเล่ม

- `travel_requests.event_url`, `attachment_file` — ลิงก์และไฟล์เอกสารการจัดงาน
- `travel_requests.approved_at` — วันที่อนุมัติ ใช้ตรวจว่าใบเสร็จลงวันที่หลังอนุมัติ
- `notifications.message` — เนื้อหาการแจ้งเตือน

ตารางถูกสร้างด้วย `Base.metadata.create_all` ตอนเริ่มระบบ หากเปลี่ยนโครงสร้างตารางภายหลังควรเพิ่ม Alembic สำหรับ migration
