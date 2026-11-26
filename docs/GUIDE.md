# คู่มือระบบ CS SmartClaim

คู่มือนี้อธิบายระบบตรวจสอบเอกสารอนุมัติตัวและใบเสร็จรับเงินอัตโนมัติด้วย AI (CS SmartClaim) สำหรับผู้พัฒนา ครอบคลุม:

1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [วิธีรันระบบ](#2-วิธีรันระบบ)
3. [การเชื่อมต่อ Google Cloud Vision และ Translation](#3-การเชื่อมต่อ-google-cloud-vision-และ-translation)
4. [การทำงานของระบบ](#4-การทำงานของระบบ)
5. [โครงสร้างไฟล์](#5-โครงสร้างไฟล์)
6. [API ทั้งหมด](#6-api-ทั้งหมด)
7. [ฐานข้อมูล](#7-ฐานข้อมูล)
8. [แนวทางการเขียนและเพิ่มโค้ด](#8-แนวทางการเขียนและเพิ่มโค้ด)
9. [การตั้งค่า (Environment Variables)](#9-การตั้งค่า-environment-variables)
10. [แก้ปัญหาที่พบบ่อย](#10-แก้ปัญหาที่พบบ่อย)

---

## 1. ภาพรวมระบบ

ผู้ใช้มี 3 บทบาท:

| บทบาท | ทำอะไรได้ |
| --- | --- |
| **อาจารย์** (`teacher`) | ยื่นคำขออนุมัติไปราชการ (เบิก/ไม่เบิกค่าใช้จ่าย), สแกน/อัปโหลดใบเสร็จ, ส่งใบเสร็จเบิกจ่าย, ติดตามสถานะ, ดาวน์โหลด PDF, ดูตัวอย่างเอกสาร, ค้นหาโรงแรม/สายการบิน |
| **เจ้าหน้าที่** (`staff`) | พิจารณาคำขอ (อนุมัติ/ไม่อนุมัติ), ตรวจใบเสร็จ (ผ่าน/ไม่ผ่าน), ระบุและปิดปัญหาของใบเสร็จ, จัดการตัวอย่างเอกสาร |
| **ผู้ดูแลระบบ** (`admin`) | จัดการบัญชีผู้ใช้และวงเงินงบประมาณ, ดูแดชบอร์ด, ดาวน์โหลดรายงาน PDF/Excel |

หน้าที่ใช้ได้โดยไม่ต้องเข้าสู่ระบบ: **สแกนใบเสร็จ (live-check)** และ **ค้นหาโรงแรมและสายการบินที่แนะนำ**

### สถาปัตยกรรม

```
 เบราว์เซอร์ (มือถือ / คอมพิวเตอร์)
        │  http://localhost:3000
        ▼
 ┌─────────────────────────┐
 │ Frontend — Next.js 15   │  หน้าเว็บทั้งหมด (React + Tailwind)
 │ container: frontend     │  /api/* ถูกส่งต่อ (rewrite) ไปที่ backend
 └───────────┬─────────────┘
             │  http://backend:8000/api/*
             ▼
 ┌─────────────────────────┐      ┌──────────────────────────────┐
 │ Backend — FastAPI       │ ───▶ │ Google Cloud Vision (OCR)     │
 │ container: backend      │ ───▶ │ Google Cloud Translation      │
 │                         │ ───▶ │ SMTP (อีเมลแจ้งเตือน)          │
 │  - REST API             │      └──────────────────────────────┘
 │  - สร้าง PDF (ReportLab) │
 │  - File Storage         │ ───▶ volume: uploads  (/app/uploads)
 └───────────┬─────────────┘
             │  SQLAlchemy (psycopg)
             ▼
 ┌─────────────────────────┐
 │ PostgreSQL 16           │  volume: pgdata
 │ container: db           │
 └─────────────────────────┘
```

**ทำไมหน้าเว็บเรียก `/api` ที่โดเมนเดียวกัน:** [frontend/next.config.ts](../frontend/next.config.ts) ตั้ง rewrite ให้ `/api/:path*` วิ่งไปที่ `BACKEND_URL` ทำให้ทั้งระบบใช้ลิงก์เดียว เปิดผ่าน HTTPS บนมือถือได้ (กล้องบนเว็บต้องใช้ HTTPS) และไม่ต้องตั้ง CORS

---

## 2. วิธีรันระบบ

### 2.1 รันด้วย Docker (แนะนำ)

**สิ่งที่ต้องมี:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (เปิดโปรแกรมให้ทำงานก่อนรันคำสั่ง)

**ครั้งแรก:** คัดลอกไฟล์ตั้งค่า แล้ว build และรัน

```bash
cp backend/.env.example backend/.env
```

```bash
docker compose up --build -d
```

เปิดใช้งานได้ที่:

| ส่วน | URL |
| --- | --- |
| หน้าเว็บ | http://localhost:3000 |
| API + Swagger UI (ทดสอบ API) | http://localhost:8000/docs |
| PostgreSQL | `localhost:5432` (user / password / db = `smartclaim`) |

ทุกครั้งที่ backend เริ่มทำงาน จะสร้างตาราง (`Base.metadata.create_all`) และใส่ข้อมูลเริ่มต้น (`python -m app.seed`) ให้อัตโนมัติ ถ้ามีข้อมูลอยู่แล้วจะไม่ใส่ซ้ำ

**บัญชีทดสอบ** (ใช้บนเครื่องพัฒนาเท่านั้น):

| บทบาท | อีเมล | รหัสผ่าน |
| --- | --- | --- |
| ผู้ดูแลระบบ | admin@smartclaim.local | Admin1234 |
| เจ้าหน้าที่ | staff@smartclaim.local | Staff1234 |
| อาจารย์ (วงเงิน 50,000 บาท) | teacher@smartclaim.local | Teacher1234 |

**คำสั่งที่ใช้บ่อย:**

| ต้องการ | คำสั่ง |
| --- | --- |
| รันใหม่หลังแก้โค้ด | `docker compose up --build -d` |
| ดูสถานะ container | `docker compose ps` |
| ดู log ของ backend | `docker compose logs -f backend` |
| หยุดระบบ (เก็บข้อมูลไว้) | `docker compose down` |
| หยุดและ **ลบข้อมูลทั้งหมด** (ฐานข้อมูล + ไฟล์อัปโหลด) | `docker compose down -v` |
| ใช้ค่าใน `backend/.env` ที่แก้ใหม่ | `docker compose up -d --force-recreate backend` |
| เข้า shell ใน backend | `docker compose exec backend sh` |
| เข้าฐานข้อมูล | `docker compose exec db psql -U smartclaim` |

> หมายเหตุ: frontend ถูก build เป็น production (`npm run build`) ใน Docker แก้โค้ด frontend แล้วต้อง `--build` ใหม่ ถ้าต้องการให้หน้าเว็บอัปเดตทันทีขณะแก้ ให้รัน frontend แบบไม่ใช้ Docker (หัวข้อ 2.2)

### 2.2 รันแบบไม่ใช้ Docker (สำหรับพัฒนา)

**สิ่งที่ต้องมี:** Python 3.12+, Node.js 20+, PostgreSQL ที่มีฐานข้อมูล `smartclaim` (user/password `smartclaim`)
หรือใช้เฉพาะฐานข้อมูลจาก Docker: `docker compose up -d db`

**Backend** (หน้าต่างที่ 1):

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload
```

(macOS/Linux ใช้ `source .venv/bin/activate`) — `--reload` ทำให้ backend รีสตาร์ตเองเมื่อแก้โค้ด

**Frontend** (หน้าต่างที่ 2):

```bash
cd frontend
npm install
npm run dev
```

`npm run dev` อ่าน `BACKEND_URL` (ค่าเริ่มต้น `http://localhost:8000`) และอัปเดตหน้าเว็บทันทีเมื่อแก้โค้ด

### 2.3 เปิดบนมือถือ (ใช้กล้องสแกนใบเสร็จ)

กล้องบนเว็บใช้ได้เฉพาะ HTTPS จึงเปิดผ่าน Cloudflare Tunnel (ฟรี ไม่ต้องสมัคร):

```bash
winget install -e --id Cloudflare.cloudflared
```

```bash
cloudflared tunnel --url http://localhost:3000
```

เปิดลิงก์ `https://….trycloudflare.com` ที่แสดงบนมือถือ ลิงก์จะเปลี่ยนทุกครั้งที่เปิดใหม่ และใครมีลิงก์ก็เข้าได้ — กด Ctrl+C เพื่อปิดเมื่อเลิกใช้

---

## 3. การเชื่อมต่อ Google Cloud Vision และ Translation

ค่าเริ่มต้นของระบบคือโหมด **mock** (`OCR_PROVIDER=mock`) ซึ่งไม่ได้อ่านรูปจริง แต่คืนข้อความใบเสร็จตัวอย่างตามชื่อไฟล์:

| ชื่อไฟล์มีคำว่า | ได้ข้อความตัวอย่างของ |
| --- | --- |
| `hotel`, `folio`, `โรงแรม` | ใบเสร็จโรงแรม (ภาษาอังกฤษ, เงินเยน) |
| `ticket`, `boarding`, `flight`, `itinerary`, `ตั๋ว` | Itinerary Receipt ตั๋วเครื่องบิน |
| อื่น ๆ | ใบเสร็จค่าลงทะเบียนภาษาไทย |

ถ้าวางไฟล์ `<ชื่อ>.json` (มี `raw_text` และ `words`) คู่กับภาพ `<ชื่อ>.png/.jpg/.webp` ไว้ใน `backend/demo/` โหมด mock จะคืนใบเสร็จสาธิตนั้นพร้อมกรอบคำแทน

ทำตามขั้นตอนด้านล่างเพื่อใช้ OCR และการแปลภาษาจริง

### ขั้นที่ 1 — สร้างโปรเจกต์และเปิด Billing

1. เข้า [Google Cloud Console](https://console.cloud.google.com/) แล้วสร้างโปรเจกต์ใหม่ (เช่น `cs-smartclaim`)
2. เมนู **Billing** → ผูกบัญชีเรียกเก็บเงิน (Vision API ต้องเปิด Billing แม้จะใช้ไม่เกินโควตาฟรี) — ตรวจราคาและโควตาฟรีล่าสุดที่หน้า Pricing ของ [Vision](https://cloud.google.com/vision/pricing) และ [Translation](https://cloud.google.com/translate/pricing)

### ขั้นที่ 2 — เปิดใช้ API

เมนู **APIs & Services → Library** ค้นหาแล้วกด **Enable** ทั้ง 2 ตัว:

- **Cloud Vision API**
- **Cloud Translation API**

### ขั้นที่ 3 — สร้าง Service Account และไฟล์คีย์

1. เมนู **IAM & Admin → Service Accounts → Create service account** ตั้งชื่อ เช่น `smartclaim-backend`
2. ขั้น Grant access ให้เพิ่ม role **Cloud Translation API User** (Vision API ไม่ต้องใช้ role เพิ่ม แค่เปิด API ในโปรเจกต์ก็พอ)
3. เข้าไปที่ service account ที่สร้าง → แท็บ **Keys → Add key → Create new key → JSON** ระบบจะดาวน์โหลดไฟล์ `.json` มาให้

> ถ้าองค์กรบล็อกการสร้างคีย์ (นโยบาย `iam.disableServiceAccountKeyCreation`) ให้ใช้บัญชี Google ส่วนตัวสร้างโปรเจกต์แทน หรือขอผู้ดูแลองค์กรยกเว้น

### ขั้นที่ 4 — วางไฟล์คีย์ในโปรเจกต์

เปลี่ยนชื่อไฟล์เป็น `google-credentials.json` แล้ววางไว้ที่:

```
backend/secrets/google-credentials.json
```

โฟลเดอร์ `backend/secrets/` ถูกตั้งค่าใน `.gitignore` ไม่ให้ commit ไฟล์ใด ๆ ขึ้น Git และไม่ถูกคัดลอกเข้า Docker image (`.dockerignore`) แต่ `docker-compose.yml` mount โฟลเดอร์นี้เข้า container ที่ `/app/secrets` แบบอ่านอย่างเดียว

> ⚠️ **ห้าม** commit ไฟล์คีย์ หรือส่งให้ผู้อื่นทางแชต ถ้าคีย์หลุด ให้ลบคีย์นั้นในหน้า Keys แล้วสร้างใหม่ทันที

### ขั้นที่ 5 — ตั้งค่า `backend/.env`

**รันด้วย Docker:**

```env
OCR_PROVIDER=google
TRANSLATE_PROVIDER=google
GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/google-credentials.json
```

**รันแบบไม่ใช้ Docker:** ใช้ path เต็มบนเครื่อง เช่น

```env
GOOGLE_APPLICATION_CREDENTIALS=C:/Users/<ชื่อผู้ใช้>/Desktop/OCRproject/backend/secrets/google-credentials.json
```

สามารถเปิดเฉพาะ OCR จริงแต่ใช้การแปลแบบ mock ได้ (`TRANSLATE_PROVIDER=mock`)

### ขั้นที่ 6 — รีสตาร์ต backend และทดสอบ

```bash
docker compose up -d --force-recreate backend
```

(`docker compose restart` ไม่โหลดค่าใหม่จาก `.env` ต้องใช้ `--force-recreate`)

ทดสอบ: เปิด http://localhost:3000/scan แล้วถ่าย/อัปโหลดใบเสร็จจริง ถ้าสำเร็จจะเห็นข้อความที่อ่านได้และกรอบสีบนรูป ถ้าไม่สำเร็จให้ดู log:

```bash
docker compose logs -f backend
```

| ข้อความใน log | สาเหตุและวิธีแก้ |
| --- | --- |
| `File ... was not found` / `DefaultCredentialsError` | path ใน `GOOGLE_APPLICATION_CREDENTIALS` ผิด หรือไม่ได้วางไฟล์ใน `backend/secrets/` |
| `Cloud Vision API has not been used in project ... or it is disabled` | ยังไม่ได้ Enable API (ขั้นที่ 2) หรือเพิ่งเปิด ให้รอสักครู่ |
| `This API method requires billing to be enabled` | ยังไม่ได้ผูก Billing (ขั้นที่ 1) |
| `PERMISSION_DENIED` ตอนแปลภาษา | service account ไม่มี role Cloud Translation API User |

### โค้ดส่วนที่เรียก Google

- [backend/app/core/config.py](../backend/app/core/config.py) — อ่านค่า `GOOGLE_APPLICATION_CREDENTIALS` จาก `.env` แล้วตั้งเป็น environment variable ให้ไลบรารีของ Google
- [backend/app/services/ocr.py](../backend/app/services/ocr.py) — `_google_ocr()` ใช้ `document_text_detection` สำหรับรูปภาพ (ได้ข้อความ + กรอบของแต่ละคำ) และ `batch_annotate_files` สำหรับ PDF (อ่านได้สูงสุด 5 หน้าแรก)
- [backend/app/services/translation.py](../backend/app/services/translation.py) — `_google()` ตรวจจับภาษา ถ้าไม่ใช่ภาษาไทยจึงแปลเป็นไทย

---

## 4. การทำงานของระบบ

### 4.1 กระบวนการหลัก (ขออนุมัติ → เบิกจ่าย)

```
อาจารย์ยื่นคำขอ ──▶ [รออนุมัติ] ──เจ้าหน้าที่──┬─ ไม่อนุมัติ ──▶ [ไม่อนุมัติ] ──อาจารย์แก้ไขแล้วยื่นใหม่──┐
   (หรือบันทึก [ฉบับร่าง])                    │                                                   │
                                             └─ อนุมัติ ─┬─ ไม่เบิกค่าใช้จ่าย ──▶ [เสร็จสิ้น]          │
                                                         │                                         │
                                                         └─ เบิกค่าใช้จ่าย ──▶ [อนุมัติแล้ว รอส่งใบเสร็จ] ◀──┘
                                                                                   │
                                               อาจารย์อัปโหลดใบเสร็จ (OCR) แล้วกดส่ง
                                                                                   ▼
                                                                       [รอตรวจสอบใบเสร็จ]
                                                                                   │ เจ้าหน้าที่ตรวจ
                                                    ┌──────────────────────────────┴───────────┐
                                                    ▼                                          ▼
                                       [ใบเสร็จไม่ผ่าน] ──ส่งใหม่──▶ ...           [เสร็จสิ้น] → สร้าง PDF, หักวงเงิน
```

สถานะทั้ง 7 (`backend/app/models.py` → `RequestStatus`):

| ค่าในฐานข้อมูล | ความหมาย | ใครเปลี่ยน |
| --- | --- | --- |
| `draft` | ฉบับร่าง | อาจารย์ (บันทึกร่าง) |
| `pending_approval` | รออนุมัติ | อาจารย์ (ยื่นคำขอ) |
| `rejected` | ไม่อนุมัติ | เจ้าหน้าที่ |
| `approved` | อนุมัติแล้ว (รอส่งใบเสร็จ) | เจ้าหน้าที่ |
| `receipt_submitted` | รอตรวจสอบใบเสร็จ | อาจารย์ (ส่งใบเสร็จ) |
| `receipt_rejected` | ใบเสร็จไม่ผ่าน | เจ้าหน้าที่ |
| `completed` | เสร็จสิ้น | เจ้าหน้าที่ |

ทุกครั้งที่เปลี่ยนสถานะ จะผ่านฟังก์ชัน `change_status()` ใน [services/workflow.py](../backend/app/services/workflow.py) ซึ่งบันทึกประวัติลงตาราง `request_status_history` (ใคร, เมื่อไร, หมายเหตุ) และ `ensure_status()` ป้องกันการกดผิดขั้นตอน (ตอบ HTTP 409)

### 4.2 กระบวนการ OCR (หัวใจของระบบ)

ไฟล์หลัก: [backend/app/services/receipts.py](../backend/app/services/receipts.py) → `process_document()`

```
ไฟล์ภาพ/PDF
   │ ① run_ocr()            services/ocr.py          Google Vision → ข้อความ + กรอบคำ
   │ ② detect_and_translate() services/translation.py ถ้าไม่ใช่ภาษาไทย → แปลเป็นไทย (ไว้แสดงผล)
   │ ③ extract_fields()      services/extraction.py   ดึงข้อมูลด้วย regex/คีย์เวิร์ดจากข้อความต้นฉบับ
   │ ④ validate()            services/validation.py   ตรวจตามเกณฑ์ (เทียบตัวอย่างเอกสารประเภทเดียวกัน)
   │ ⑤ tag_words()           services/extraction.py   ระบุว่ากรอบคำไหนคือ ยอดเงิน/วันที่/เลขที่ (ไฮไลต์สีบนรูป)
   ▼
บันทึกตาราง receipts (ocr_data เป็น JSONB) + receipt_issues
สถานะใบเสร็จ: valid (ผ่าน) / flagged (มีคำเตือน)
```

**③ ดึงข้อมูลอะไรบ้าง:** ประเภทเอกสาร, เล่มที่/เลขที่, ชื่อและที่อยู่ผู้รับเงิน, วันที่ (แปลง พ.ศ. → ค.ศ.), รายการ, ยอดเงิน + สกุลเงิน, ยอดเงินตัวอักษร, ลายเซ็น, เลขผู้เสียภาษี, ชื่อผู้เข้าพัก, วันเข้า-ออก, เลขเที่ยวบิน, ชำระผ่านเคาน์เตอร์เซอร์วิสหรือไม่ และหมวดค่าใช้จ่าย

**ประเภทเอกสาร 7 ประเภท** (`classify()` ดูจากคำสำคัญ):

| key | ชื่อ | คำที่ใช้จำแนก | หมวดค่าใช้จ่าย |
| --- | --- | --- | --- |
| `boarding_pass` | Boarding pass | boarding pass | ค่าเดินทาง |
| `itinerary_receipt` | Itinerary Receipt / e-ticket | itinerary, e-ticket, ticket number | ค่าเดินทาง |
| `hotel_folio` | ใบเสร็จค่าที่พัก / Folio | folio, guest name, check-in, arrival, ผู้เข้าพัก | ค่าที่พัก |
| `substitute_receipt` | ใบรับรองแทนใบเสร็จรับเงิน | ใบรับรองแทนใบเสร็จ | - |
| `registration_receipt` | ใบเสร็จค่าลงทะเบียน | registration, ลงทะเบียน | ค่าลงทะเบียน |
| `tax_invoice` | ใบกำกับภาษี | ใบกำกับภาษี, tax invoice | - |
| `receipt` | ใบเสร็จรับเงินทั่วไป | (ไม่เข้าข้อใดเลย) | - |

**④ เกณฑ์ตรวจสอบ** (อ้างอิงหัวข้อ 2.1.1 ในเล่ม):

1. **องค์ประกอบ 6 รายการ** ตามระเบียบ มจพ. พ.ศ. 2551 หมวด 3 ข้อ 16 (เล่มที่/เลขที่, ชื่อ-ที่อยู่ผู้รับเงิน, วันที่, รายการ, ยอดเงินตัวเลขและตัวอักษร, ลายเซ็น) — ประเภทอื่นตรวจเพิ่ม เช่น ใบกำกับภาษีต้องมีเลขผู้เสียภาษี, folio ต้องมีชื่อผู้เข้าพักและวันเข้า-ออก
   รายการที่ต้องตรวจดึงจาก `required_elements` ของตัวอย่างเอกสาร (เจ้าหน้าที่แก้ได้ในหน้าจัดการตัวอย่างเอกสาร) ถ้าไม่มีตัวอย่างใช้ค่า `DEFAULT_REQUIRED`
2. **วันที่ในใบเสร็จต้องไม่ก่อนวันที่อนุมัติ**
3. **ค่าโดยสารที่ชำระผ่านเคาน์เตอร์เซอร์วิสเบิกไม่ได้**
4. **ตอนส่งใบเสร็จ:** ค่าใช้จ่ายแต่ละหมวดที่เบิกต้องมีเอกสารประกอบ (`missing_documents()` — ค่าเดินทาง → Itinerary หรือใบรับรองแทนใบเสร็จ, ค่าที่พัก → Folio, ค่าลงทะเบียน → ใบเสร็จค่าลงทะเบียน)

ผลตรวจทั้งหมดเป็น **คำเตือนแบบ non-blocking** — ผู้ใช้ส่งต่อได้ และเจ้าหน้าที่เป็นผู้ตัดสินขั้นสุดท้าย

**สองโหมดของการสแกน:**

| | live-check (`POST /api/receipts/live-check`) | upload (`POST /api/requests/{id}/receipts`) |
| --- | --- | --- |
| ต้องเข้าสู่ระบบ | ไม่ต้อง | ต้อง (อาจารย์เจ้าของคำขอ) |
| เก็บไฟล์ | เก็บเฉพาะเมื่อเข้าสู่ระบบอยู่ | เก็บเสมอ |
| OCR อ่านไม่ได้ | ตอบ 422 ให้ถ่ายใหม่ | เก็บไฟล์ไว้ และเปิดฟอร์มให้กรอกข้อมูลเอง (ปัญหา `ocr_failed`) |
| ต่อยอด | กด "อัปโหลดใบเสร็จ" เพื่อแนบเข้าคำขอ (`/attach`) | - |

**หลังส่งใบเสร็จ** `link_travel_documents()` ผูกไฟล์ e-ticket / boarding pass เข้ากับเที่ยวบิน (`trips`) และ folio เข้ากับการเข้าพัก (`hotel_stays`) ถ้ายังไม่มีรายการที่ตรงกัน ระบบสร้างให้จากข้อมูล OCR

**การแก้ข้อมูล:** อาจารย์แก้ข้อมูลที่ OCR อ่านได้ (`PUT /api/receipts/{id}/fields`) ระบบจะตรวจตามเกณฑ์ใหม่ทันที (ปัญหาที่เจ้าหน้าที่ระบุไว้จะคงอยู่) ส่วนเจ้าหน้าที่ระบุปัญหาเพิ่ม (`/issues`) หรือปิดปัญหาที่ตรวจแล้ว (`/resolve`) ได้

**กรอกยอดจริงอัตโนมัติ:** หน้าส่งใบเสร็จรวมยอดเงินของใบเสร็จตามหมวดค่าใช้จ่าย แล้วกรอกลงช่องยอดจริงของแต่ละรายการให้ (แก้ไขได้ก่อนส่ง)

### 4.3 ส่วนอื่น ๆ

| เรื่อง | การทำงาน | ไฟล์ |
| --- | --- | --- |
| **เข้าสู่ระบบ** | ตรวจรหัสผ่าน (bcrypt) แล้วออก JWT อายุ 8 ชั่วโมง หน้าเว็บเก็บ token ใน `localStorage` และแนบ `Authorization: Bearer …` ทุกคำขอ บัญชีที่ถูกระงับเข้าไม่ได้ | `core/security.py`, `core/deps.py`, `api/routes/auth.py` |
| **สิทธิ์ตามบทบาท** | `require_roles(Role.STAFF)` ใน backend และ `<RequireRole roles={[...]}>` ใน frontend อาจารย์เห็นเฉพาะคำขอและไฟล์ของตนเอง | `core/deps.py`, `components/AuthProvider.tsx`, `api/routes/files.py` |
| **การแจ้งเตือน** | `notify()` บันทึกการแจ้งเตือนในเว็บ แล้วส่งอีเมล ถ้าอีเมลล้มเหลว การแจ้งเตือนในเว็บยังอยู่ ถ้าไม่ตั้ง `SMTP_HOST` จะเขียนเนื้อหาอีเมลลง log แทน | `services/notify.py`, `services/email.py` |
| **วงเงินงบประมาณ** | เตือนเมื่อยอดประมาณการ/ยอดจริงเกินวงเงินคงเหลือ หักวงเงิน (`budget_used`) เมื่อใบเสร็จผ่าน | `api/routes/requests.py` |
| **กรอบเวลายื่นคำขอ** | เตือนเมื่อยื่นล่วงหน้าน้อยกว่า 5 วันทำการ | `api/routes/requests.py` |
| **PDF เอกสารเบิกจ่าย** | สร้างด้วย ReportLab + ฟอนต์ไทย เก็บประวัติในตาราง `generated_documents` สร้างใหม่เมื่อคำขอมีการเปลี่ยนแปลง | `services/pdf.py` |
| **แดชบอร์ด/รายงาน** | สรุปตามปีงบประมาณ (ต.ค.–ก.ย.) / เดือน / สถานะ ดาวน์โหลด PDF หรือ Excel (openpyxl) | `api/routes/dashboard.py` |
| **ไฟล์อัปโหลด** | รองรับ JPG, PNG, WEBP, PDF ไม่เกิน 10 MB เก็บใน `uploads/` ตั้งชื่อด้วย UUID | `services/storage.py` |

---

## 5. โครงสร้างไฟล์

```
OCRproject/
├── docker-compose.yml          กำหนด 3 services: db, backend, frontend + volumes pgdata, uploads
├── README.md                   วิธีเริ่มต้นแบบย่อ
├── docs/
│   └── GUIDE.md                คู่มือฉบับนี้
│
├── backend/                    ── FastAPI (Python) ──
│   ├── Dockerfile              python:3.12-slim + ฟอนต์ไทย (fonts-thai-tlwg) → seed แล้วรัน uvicorn
│   ├── requirements.txt        ไลบรารี Python
│   ├── .env.example            ตัวอย่างการตั้งค่า (คัดลอกเป็น .env)
│   ├── secrets/                ไฟล์คีย์ Google (ไม่ขึ้น Git)
│   ├── uploads/                ไฟล์ที่ผู้ใช้อัปโหลด + PDF ที่สร้าง (ไม่ขึ้น Git)
│   ├── demo/                   ใบเสร็จสาธิตของโหมด mock (ไม่ขึ้น Git)
│   └── app/
│       ├── main.py             สร้างแอป FastAPI, CORS, ตัวจัดการ error, รวม router ทั้งหมดใต้ /api
│       ├── db.py               engine + SessionLocal + get_db() (1 session ต่อ 1 request)
│       ├── models.py           ตาราง 14 ตารางตาม ER Diagram (SQLAlchemy) + ค่าคงที่ Role/RequestStatus
│       ├── schemas.py          Pydantic: รูปแบบข้อมูลเข้า (…In) และออก (…Out) ของ API + กฎรหัสผ่าน
│       ├── seed.py             ข้อมูลเริ่มต้น: บัญชีทดสอบ, ตัวอย่างเอกสาร, โรงแรม, สายการบิน
│       ├── core/
│       │   ├── config.py       อ่านค่าจาก .env (pydantic-settings)
│       │   ├── security.py     hash รหัสผ่าน (bcrypt), สร้าง/ถอด JWT, สุ่มรหัสผ่านชั่วคราว
│       │   └── deps.py         get_current_user, get_optional_user, require_roles
│       ├── api/routes/         ── endpoint แยกตามกลุ่มงาน ──
│       │   ├── auth.py         เข้าสู่ระบบ, ข้อมูลผู้ใช้ปัจจุบัน
│       │   ├── profile.py      ดู/แก้โปรไฟล์, เปลี่ยนรหัสผ่าน, ประวัติการเบิก
│       │   ├── users.py        (admin) จัดการบัญชีผู้ใช้, ระงับ/เปิด, รีเซ็ตรหัสผ่าน
│       │   ├── requests.py     คำขอ: ยื่น, แก้ไข, อนุมัติ, อัปโหลด/ส่งใบเสร็จ, ตรวจใบเสร็จ, PDF
│       │   ├── receipts.py     live-check, แนบเข้าคำขอ, แก้ข้อมูล OCR, ระบุ/ปิดปัญหา
│       │   ├── samples.py      ตัวอย่างเอกสาร (staff เพิ่ม/แก้/ลบ)
│       │   ├── recommendations.py  โรงแรม/สายการบินแนะนำ (ไม่ต้องเข้าสู่ระบบ)
│       │   ├── notifications.py    การแจ้งเตือนในเว็บ
│       │   ├── dashboard.py    (admin) สถิติ + รายงาน PDF/Excel
│       │   └── files.py        ดาวน์โหลดไฟล์ตามสิทธิ์
│       └── services/           ── business logic (ไม่ผูกกับ HTTP) ──
│           ├── ocr.py          Google Vision / mock
│           ├── translation.py  Google Translation / mock
│           ├── extraction.py   ดึงข้อมูลจากข้อความ OCR, จำแนกประเภทเอกสาร, ติดป้ายกรอบคำ
│           ├── validation.py   เกณฑ์ตรวจองค์ประกอบ + เอกสารที่ต้องแนบตามหมวดค่าใช้จ่าย
│           ├── receipts.py     ประกอบขั้นตอน OCR → แปล → ดึงข้อมูล → ตรวจ, ผูกไฟล์กับเที่ยวบิน/ที่พัก
│           ├── workflow.py     เปลี่ยนสถานะ + บันทึกประวัติ
│           ├── notify.py       แจ้งเตือนในเว็บ + อีเมล
│           ├── email.py        ส่งอีเมลผ่าน SMTP
│           ├── pdf.py          สร้าง PDF เอกสารเบิกจ่ายและรายงาน
│           └── storage.py      บันทึก/ลบไฟล์, ตรวจชนิดและขนาด
│
└── frontend/                   ── Next.js 15 (React 19 + TypeScript + Tailwind) ──
    ├── Dockerfile              node:22-alpine → npm ci → npm run build → npm start
    ├── next.config.ts          rewrite /api/* → backend
    ├── tailwind.config.ts      สีธีม (brand = น้ำเงิน) และฟอนต์ Kanit
    └── src/
        ├── app/                ── หน้าเว็บ (โฟลเดอร์ = URL) ──
        │   ├── layout.tsx      โครงหน้า: ฟอนต์, AuthProvider, Navbar
        │   ├── page.tsx        หน้าแรก (ปุ่มไปหน้าหลักตามบทบาท)
        │   ├── login/          เข้าสู่ระบบ
        │   ├── scan/           สแกนใบเสร็จด้วยกล้อง / เลือกไฟล์ (live-check)
        │   ├── recommendations/ โรงแรมและสายการบินแนะนำ
        │   ├── samples/        ตัวอย่างเอกสาร (อาจารย์)
        │   ├── profile/        โปรไฟล์ + วงเงิน + ประวัติการเบิก
        │   ├── notifications/  การแจ้งเตือน
        │   ├── requests/[id]/  ลิงก์จากอีเมล → พาไปหน้าคำขอตามบทบาท
        │   ├── teacher/
        │   │   ├── page.tsx                    หน้าหลักอาจารย์ (รายการคำขอ + progress bar)
        │   │   └── requests/
        │   │       ├── new/                    ยื่นคำขอใหม่
        │   │       └── [id]/                   รายละเอียดคำขอ, ดู/ดาวน์โหลด PDF
        │   │           ├── edit/               แก้ไขคำขอ (ร่าง / ไม่อนุมัติ)
        │   │           └── receipts/           อัปโหลด/แก้ข้อมูล/ส่งใบเสร็จ
        │   ├── staff/
        │   │   ├── page.tsx                    แดชบอร์ดเจ้าหน้าที่ (ค้นหา/กรองคำขอ)
        │   │   ├── requests/[id]/              พิจารณาคำขอ / ตรวจใบเสร็จ / ระบุปัญหา
        │   │   └── samples/                    จัดการตัวอย่างเอกสาร
        │   └── admin/
        │       ├── page.tsx                    แดชบอร์ดและรายงาน
        │       └── users/                      จัดการบัญชีผู้ใช้
        ├── components/         ── ส่วนประกอบที่ใช้ซ้ำ ──
        │   ├── AuthProvider.tsx   เก็บสถานะผู้ใช้, RequireRole (กันหน้าตามบทบาท)
        │   ├── Navbar.tsx         เมนูตามบทบาท + จำนวนแจ้งเตือนที่ยังไม่อ่าน
        │   ├── RequestForm.tsx    ฟอร์มคำขอ (ค่าใช้จ่าย, เที่ยวบิน, ที่พัก, ไฟล์แนบ)
        │   ├── RequestInfo.tsx    แสดงรายละเอียดคำขอ, ค่าใช้จ่าย, การเดินทาง, ประวัติสถานะ
        │   ├── Status.tsx         ป้ายสถานะ + progress bar 7 สถานะ
        │   ├── OCRResult.tsx      ผลการตรวจ + ข้อมูลที่ OCR ดึงได้ + คำแปล
        │   ├── OCRImageOverlay.tsx วาดกรอบสีทับคำบนรูปใบเสร็จ
        │   ├── PdfPreview.tsx     ดูตัวอย่าง/ดาวน์โหลด PDF
        │   ├── AuthFile.tsx       แสดงไฟล์ที่ต้องใช้ token (รูป/PDF/ลิงก์)
        │   └── ui.tsx             Button, Card, Input, Select, Alert, WarningList ฯลฯ
        └── lib/
            ├── api.ts             ฟังก์ชันเรียก API (แนบ token, แปลง error เป็นข้อความไทย)
            ├── types.ts           TypeScript types ให้ตรงกับ schemas.py
            ├── constants.ts       ชื่อสถานะภาษาไทย, สี, หมวดค่าใช้จ่าย, format เงิน/วันที่
            └── useReceiptOptions.ts  ดึงรายชื่อประเภทเอกสารและองค์ประกอบจาก backend
```

**หลักการแบ่งชั้นของ backend:**

```
routes (รับ HTTP, ตรวจสิทธิ์, เรียก service, commit)  →  services (logic ล้วน)  →  models (ตาราง)
                     ↑ schemas (ตรวจรูปแบบข้อมูลเข้า/ออก)
```

---

## 6. API ทั้งหมด

ทุก endpoint อยู่ใต้ `/api` ดูรายละเอียดและทดลองเรียกได้ที่ http://localhost:8000/docs (กด **Authorize** แล้วใส่ token จาก `/api/auth/login`)

| Method | Path | สิทธิ์ | ใช้ทำอะไร |
| --- | --- | --- | --- |
| POST | `/auth/login` | ทุกคน | เข้าสู่ระบบ → JWT |
| GET | `/auth/me` | เข้าสู่ระบบ | ข้อมูลผู้ใช้ปัจจุบัน |
| GET / PUT | `/profile` | เข้าสู่ระบบ | ดู / แก้โปรไฟล์ |
| PUT | `/profile/password` | เข้าสู่ระบบ | เปลี่ยนรหัสผ่าน |
| GET | `/profile/history` | เข้าสู่ระบบ | ประวัติการเบิก |
| GET / POST | `/admin/users` | admin | รายชื่อ (ค้นหา/กรอง) / เพิ่มผู้ใช้ |
| PUT | `/admin/users/{id}` | admin | แก้ไขผู้ใช้/บทบาท/วงเงิน |
| POST | `/admin/users/{id}/toggle-active` | admin | ระงับ/เปิดใช้งาน |
| POST | `/admin/users/{id}/reset-password` | admin | รีเซ็ตรหัสผ่าน (ส่งอีเมล) |
| GET | `/requests` | เข้าสู่ระบบ | รายการคำขอ (`status`, `teacher`, `date_from`, `date_to`) |
| POST | `/requests` | teacher | สร้างคำขอ (`submit: true` = ยื่นเลย, `false` = ร่าง) |
| GET / PUT / DELETE | `/requests/{id}` | เจ้าของ/staff | ดู / แก้ไข (ร่าง, ไม่อนุมัติ) / ลบร่าง |
| POST | `/requests/{id}/attachment` | teacher | แนบเอกสารประกอบ |
| POST | `/requests/{id}/approve` | staff | อนุมัติ |
| POST | `/requests/{id}/reject` | staff | ไม่อนุมัติ (ต้องมี `reason`) |
| POST | `/requests/{id}/receipts` | teacher | อัปโหลดใบเสร็จ (OCR โหมด upload) |
| DELETE | `/requests/{id}/receipts/{rid}` | teacher | ลบใบเสร็จ |
| POST | `/requests/{id}/submit-receipts` | teacher | ส่งใบเสร็จ + ยอดจริง |
| POST | `/requests/{id}/verify` | staff | ตรวจใบเสร็จ (`passed`, `note`) |
| GET | `/requests/{id}/pdf` | เจ้าของ/staff | ดาวน์โหลด PDF |
| GET | `/requests/meta/statuses` | ทุกคน | รายชื่อสถานะ |
| POST | `/receipts/live-check` | ทุกคน | สแกนตรวจเบื้องต้น |
| POST | `/receipts/{id}/attach` | teacher | แนบใบเสร็จที่สแกนเข้าคำขอ |
| PUT | `/receipts/{id}/fields` | เจ้าของ | แก้ข้อมูล OCR แล้วตรวจใหม่ |
| POST | `/receipts/{id}/issues` | staff | ระบุปัญหาเพิ่ม |
| POST | `/receipts/issues/{issue_id}/resolve` | staff | ปิดปัญหา |
| GET | `/receipts/{id}` | เข้าสู่ระบบ | ดูใบเสร็จ |
| GET | `/receipts/meta/options` | ทุกคน | ประเภทเอกสาร + องค์ประกอบ |
| GET | `/receipts/demo-image/{name}` | ทุกคน | รูปใบเสร็จสาธิต (mock) |
| GET / POST | `/samples` | เข้าสู่ระบบ / staff | ดู / เพิ่มตัวอย่างเอกสาร |
| PUT / DELETE | `/samples/{id}` | staff | แก้ / ลบตัวอย่างเอกสาร |
| GET | `/recommendations/hotels` , `/airlines` | ทุกคน | ค้นหา (`continent` = Asia/Europe/America, `q`) |
| GET | `/recommendations/hotels/{id}` , `/airlines/{id}` | ทุกคน | รายละเอียด |
| GET | `/notifications` | เข้าสู่ระบบ | การแจ้งเตือน 100 รายการล่าสุด |
| GET | `/notifications/unread-count` | เข้าสู่ระบบ | จำนวนที่ยังไม่อ่าน |
| POST | `/notifications/{id}/read` , `/notifications/read-all` | เข้าสู่ระบบ | ทำเครื่องหมายว่าอ่านแล้ว |
| GET | `/admin/dashboard` | admin | สถิติ (`fiscal_year`, `month`, `status`) |
| GET | `/admin/dashboard/report` | admin | รายงาน (`format` = `pdf` / `xlsx`) |
| GET | `/files/{path}` | เข้าสู่ระบบ | ดาวน์โหลดไฟล์ (อาจารย์เห็นเฉพาะของตนเอง) |
| GET | `/health` | ทุกคน | ตรวจว่า API ทำงาน |

ข้อความ error ทุกตัวเป็นภาษาไทยในรูป `{"detail": "..."}` — 400 ข้อมูลผิด, 401 ยังไม่เข้าสู่ระบบ, 403 ไม่มีสิทธิ์, 404 ไม่พบ, 409 ผิดขั้นตอน, 422 รูปแบบข้อมูลผิด/อ่านภาพไม่ได้, 503 OCR หรือฐานข้อมูลไม่ตอบสนอง

---

## 7. ฐานข้อมูล

14 ตารางตาม ER Diagram (บทที่ 3.4) นิยามใน [backend/app/models.py](../backend/app/models.py)

| ตาราง | เก็บอะไร | ความสัมพันธ์หลัก |
| --- | --- | --- |
| `users` | บัญชีผู้ใช้ 3 บทบาท | — |
| `teacher_profiles` | วงเงินทั้งหมด / ใช้ไปแล้ว | 1:1 กับ users |
| `travel_requests` | คำขออนุมัติไปราชการ (ตารางหลัก) | M:1 users |
| `expense_items` | ค่าใช้จ่ายแต่ละหมวด (ประมาณการ + จริง) | M:1 travel_requests |
| `request_status_history` | ประวัติการเปลี่ยนสถานะ | M:1 travel_requests |
| `trips` | เที่ยวบิน + ไฟล์ e-ticket/boarding pass | M:1 travel_requests, M:0..1 airlines |
| `hotel_stays` | การเข้าพัก + ไฟล์ folio/invoice | M:1 travel_requests, M:0..1 hotels |
| `airlines` / `hotels` | ข้อมูลแนะนำแยกตามทวีป | — |
| `receipts` | ใบเสร็จ + ผล OCR (`ocr_data` JSONB) | M:0..1 travel_requests, M:0..1 document_samples |
| `receipt_issues` | ปัญหาที่พบ (AI หรือเจ้าหน้าที่) | M:1 receipts |
| `document_samples` | ตัวอย่างเอกสาร + `required_elements` (JSONB) | — |
| `notifications` | การแจ้งเตือน | M:1 users |
| `generated_documents` | ประวัติไฟล์ PDF ที่สร้าง | M:1 travel_requests |

ฟิลด์ที่เพิ่มจากเล่ม: `travel_requests.event_url`, `attachment_file`, `approved_at` และ `notifications.message`

ตัวอย่างโครงสร้าง `receipts.ocr_data`:

```json
{
  "raw_text": "Grand Example Hotel Tokyo\n...",
  "fields": {
    "document_type": "hotel_folio",
    "document_type_label": "ใบเสร็จค่าที่พัก / Folio",
    "receipt_no": "F-88213",
    "date": "2026-12-13",
    "amount": 54000.0,
    "currency": "JPY",
    "guest_name": "Dr. Example Jaidee",
    "check_in": "2026-12-10",
    "check_out": "2026-12-13",
    "category": "ค่าที่พัก",
    "has_signature": true
  },
  "words": [{ "text": "54,000", "box": [0.61, 0.42, 0.72, 0.45], "field": "amount" }],
  "demo_image": null
}
```

> ตารางถูกสร้างด้วย `create_all` ซึ่ง **ไม่แก้ตารางที่มีอยู่แล้ว** ถ้าเพิ่มคอลัมน์ใหม่ระหว่างพัฒนาให้ล้างฐานข้อมูล (`docker compose down -v`) หากนำไปใช้งานจริงควรเพิ่ม Alembic สำหรับ migration

---

## 8. แนวทางการเขียนและเพิ่มโค้ด

### รูปแบบโค้ด

- **ข้อความที่ผู้ใช้เห็นเป็นภาษาไทย** ทั้ง error ใน backend (`HTTPException(..., "ข้อความไทย")`) และหน้าเว็บ
- **Docstring/คอมเมนต์ภาษาไทย** อธิบาย "ทำไม" สั้น ๆ ไม่อธิบายสิ่งที่โค้ดบอกอยู่แล้ว
- Backend: ใช้ type hints, SQLAlchemy 2.0 (`Mapped[...]`, `select()`), Pydantic v2
- Frontend: ทุกหน้าเป็น client component (`"use client"`), เรียก API ผ่าน `api()` ใน `lib/api.ts` เสมอ, ใช้ component จาก `components/ui.tsx`
- คำเตือนที่ไม่ปิดกั้นการทำงาน ส่งกลับเป็น `warnings: string[]` แล้วแสดงด้วย `<WarningList>`

### เพิ่ม endpoint ใหม่

1. เขียนฟังก์ชันใน `backend/app/api/routes/<กลุ่ม>.py` ใส่ `Depends(require_roles(Role.XXX))` เพื่อกำหนดสิทธิ์
2. ถ้ารับ/ส่ง JSON ให้สร้าง schema ใน `schemas.py`
3. logic ที่ซับซ้อนให้แยกไว้ใน `services/`
4. ถ้าเป็นไฟล์ router ใหม่ ให้เพิ่มเข้า tuple ใน `main.py`
5. เพิ่ม type ที่ตรงกันใน `frontend/src/lib/types.ts`

### เพิ่มประเภทเอกสารใหม่

1. `services/extraction.py` → เพิ่มใน `DOC_TYPES`, คำสำคัญใน `classify()` และหมวดใน `DOC_TYPE_CATEGORY` (ถ้ามี)
2. `services/validation.py` → กำหนดองค์ประกอบที่ต้องมีใน `DEFAULT_REQUIRED`
3. `seed.py` → เพิ่มตัวอย่างเอกสารใน `SAMPLES` (หรือให้เจ้าหน้าที่เพิ่มผ่านหน้าเว็บ)

### เพิ่มองค์ประกอบที่ตรวจได้

1. ดึงค่าใน `extract_fields()` (`services/extraction.py`)
2. เพิ่ม key ใน `ELEMENTS` ของ `services/validation.py` พร้อมฟังก์ชันตรวจ
3. แสดงผลใน `FIELD_LABELS` ของ `components/OCRResult.tsx` และให้แก้ได้ใน `EDITABLE` ของหน้าส่งใบเสร็จ

### เพิ่มหน้าเว็บใหม่

1. สร้างโฟลเดอร์ใน `frontend/src/app/<path>/page.tsx` (path ของโฟลเดอร์ = URL)
2. ครอบด้วย `<RequireRole roles={["teacher"]}>` ถ้าต้องเข้าสู่ระบบ
3. เพิ่มเมนูใน `MENU` ของ `components/Navbar.tsx`

### ตรวจก่อน commit

```bash
docker compose up --build -d
```

frontend จะตรวจ TypeScript และ ESLint ระหว่าง build ถ้ามี error จะ build ไม่ผ่าน จากนั้นทดสอบ flow ที่แก้ในหน้าเว็บหรือ Swagger UI

---

## 9. การตั้งค่า (Environment Variables)

ไฟล์ `backend/.env` (อ่านโดย [core/config.py](../backend/app/core/config.py)) — `MAX_UPLOAD_MB` และ `JWT_EXPIRE_MINUTES` ไม่มีใน `.env.example` แต่เพิ่มเองได้:

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://smartclaim:smartclaim@localhost:5432/smartclaim` | ฐานข้อมูล (Docker ตั้งเป็น `@db:5432` ให้เอง) |
| `JWT_SECRET` | `change-me-in-production` | กุญแจเซ็น token — **ต้องเปลี่ยน** ก่อนใช้งานจริง |
| `CORS_ORIGINS` | `http://localhost:3000` | โดเมนที่เรียก API ตรงได้ (คั่นด้วย `,`) |
| `FRONTEND_URL` | `http://localhost:3000` | ใช้สร้างลิงก์ในอีเมล |
| `OCR_PROVIDER` | `mock` | `mock` หรือ `google` |
| `TRANSLATE_PROVIDER` | `mock` | `mock` หรือ `google` |
| `GOOGLE_APPLICATION_CREDENTIALS` | (ว่าง) | path ไฟล์คีย์ service account |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_USE_TLS` | (ว่าง), 587, … | ตั้งค่าส่งอีเมล — เว้น `SMTP_HOST` ว่างเพื่อเขียน log แทน |
| `PDF_FONT_PATH` | (ว่าง) | ฟอนต์ไทยสำหรับ PDF (Docker ตั้งเป็น Garuda ให้แล้ว, Windows ใช้ `C:/Windows/Fonts/tahoma.ttf`) |
| `MAX_UPLOAD_MB` | `10` | ขนาดไฟล์อัปโหลดสูงสุด |
| `JWT_EXPIRE_MINUTES` | `480` | อายุ token (นาที) |

Frontend: `BACKEND_URL` (ค่าเริ่มต้น `http://localhost:8000`, Docker ใช้ `http://backend:8000`) — อ่านตอน build

**ตัวอย่างตั้งค่าอีเมลด้วย Gmail:** เปิด 2-Step Verification แล้วสร้าง App Password ที่ https://myaccount.google.com/apppasswords

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<อีเมล Gmail>
SMTP_PASSWORD=<App Password 16 ตัว>
SMTP_FROM=CS SmartClaim <อีเมล Gmail>
SMTP_USE_TLS=true
```

---

## 10. แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
| --- | --- |
| `failed to connect to the docker API ... dockerDesktopLinuxEngine` | ยังไม่ได้เปิด Docker Desktop — เปิดโปรแกรมแล้วรอจนสถานะเป็น Running |
| `env file ... backend/.env not found` | ยังไม่ได้คัดลอก `.env.example` เป็น `.env` |
| พอร์ต 3000 / 8000 / 5432 ถูกใช้แล้ว | ปิดโปรแกรมที่ใช้พอร์ตนั้น หรือแก้ฝั่งซ้ายของ `ports` ใน `docker-compose.yml` เช่น `"3001:3000"` |
| หน้าเว็บขึ้น "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" | backend ยังไม่พร้อมหรือ error — ดู `docker compose logs backend` |
| แก้โค้ด frontend แล้วหน้าเว็บไม่เปลี่ยน | ต้อง `docker compose up --build -d` หรือรัน `npm run dev` |
| เพิ่มคอลัมน์ใน `models.py` แล้ว error ว่าไม่มีคอลัมน์ | `create_all` ไม่แก้ตารางเดิม — `docker compose down -v` แล้วรันใหม่ (ข้อมูลหาย) |
| กล้องไม่เปิดบนมือถือ | ต้องเปิดผ่าน HTTPS (Cloudflare Tunnel) และอนุญาตสิทธิ์กล้องในเบราว์เซอร์ |
| PDF ภาษาไทยเป็นสี่เหลี่ยม | ไม่พบฟอนต์ไทย — ตั้ง `PDF_FONT_PATH` ให้ชี้ไปที่ไฟล์ `.ttf` ภาษาไทย |
| ผล OCR เป็นใบเสร็จตัวอย่างทุกครั้ง | ยังเป็นโหมด mock — ทำตามหัวข้อ 3 |
| ไม่ได้รับอีเมล | ไม่ได้ตั้ง `SMTP_HOST` (ระบบเขียนลง log แทน) — ดู `docker compose logs backend` |
