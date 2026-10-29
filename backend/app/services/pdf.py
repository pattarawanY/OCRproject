"""PDF Generator — สร้างเอกสารสรุปคำขอเบิกจ่ายและรายงานภาพรวม"""

import io
import logging
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.config import settings
from app.models import TravelRequest

log = logging.getLogger(__name__)

STATUS_TH = {
    "draft": "ฉบับร่าง",
    "pending_approval": "รออนุมัติ",
    "rejected": "ไม่อนุมัติ",
    "approved": "อนุมัติแล้ว (รอส่งใบเสร็จ)",
    "receipt_submitted": "รอตรวจสอบใบเสร็จ",
    "receipt_rejected": "ใบเสร็จไม่ผ่าน",
    "completed": "เสร็จสิ้น",
}

_FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/tlwg/Garuda.ttf",
    "/usr/share/fonts/truetype/thai/Garuda.ttf",
    "C:/Windows/Fonts/tahoma.ttf",
    "C:/Windows/Fonts/LeelawUI.ttf",
]


def _font() -> str:
    if "ThaiFont" in pdfmetrics.getRegisteredFontNames():
        return "ThaiFont"
    for path in [settings.pdf_font_path, *_FONT_CANDIDATES]:
        if path and Path(path).exists():
            pdfmetrics.registerFont(TTFont("ThaiFont", path))
            return "ThaiFont"
    log.warning("ไม่พบฟอนต์ภาษาไทย ตั้งค่า PDF_FONT_PATH เพื่อให้ PDF แสดงภาษาไทยได้")
    return "Helvetica"


def _styles():
    font = _font()
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("t", parent=base["Title"], fontName=font, fontSize=16, leading=22),
        "h": ParagraphStyle("h", parent=base["Heading3"], fontName=font, fontSize=12, leading=18),
        "p": ParagraphStyle("p", parent=base["Normal"], fontName=font, fontSize=10, leading=15),
        "font": font,
    }


def _table(rows: list[list], font: str, widths=None) -> Table:
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eefc")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def _money(v) -> str:
    return "-" if v is None else f"{float(v):,.2f}"


def build_request_pdf(req: TravelRequest) -> bytes:
    s = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=15 * mm)
    el = [
        Paragraph("เอกสารสรุปคำขออนุมัติไปราชการและเบิกจ่าย", s["title"]),
        Paragraph("ภาควิชาวิทยาการคอมพิวเตอร์และสารสนเทศ คณะวิทยาศาสตร์ประยุกต์ มจพ.", s["p"]),
        Spacer(1, 6),
        Paragraph(f"เลขที่คำขอ: {req.request_id} &nbsp;&nbsp; สถานะ: {STATUS_TH.get(req.status, req.status)}", s["p"]),
        Paragraph(f"ผู้ยื่นคำขอ: {req.user.full_name} ({req.user.email})", s["p"]),
        Paragraph(f"ประเภทคำขอ: {'เบิกค่าใช้จ่าย' if req.request_type == 'reimburse' else 'ไม่เบิกค่าใช้จ่าย'}", s["p"]),
        Paragraph(f"กิจกรรม: {req.activity_type} — {req.event_name}", s["p"]),
        Paragraph(f"สถานที่: {req.location}", s["p"]),
        Paragraph(f"วันที่: {req.start_date:%d/%m/%Y} ถึง {req.end_date:%d/%m/%Y}", s["p"]),
        Spacer(1, 8),
    ]

    if req.expense_items:
        el.append(Paragraph("รายการค่าใช้จ่าย", s["h"]))
        rows = [["ประเภท", "รายละเอียด", "ประมาณการ (บาท)", "ยอดจริง (บาท)"]]
        rows += [[i.category, i.description or "-", _money(i.estimated_amount), _money(i.actual_amount)]
                 for i in req.expense_items]
        rows.append(["รวม", "", _money(req.estimated_amount), _money(req.actual_amount)])
        el.append(_table(rows, s["font"], [35 * mm, 65 * mm, 35 * mm, 35 * mm]))

    if req.trips:
        el += [Spacer(1, 8), Paragraph("ข้อมูลการเดินทาง", s["h"])]
        rows = [["เที่ยวบิน", "สายการบิน", "ต้นทาง", "ปลายทาง", "ออกเดินทาง"]]
        rows += [[t.flight_number or "-", t.airline or "-", t.departure_location or "-",
                  t.arrival_location or "-",
                  t.departure_datetime.strftime("%d/%m/%Y %H:%M") if t.departure_datetime else "-"]
                 for t in req.trips]
        el.append(_table(rows, s["font"]))

    if req.hotel_stays:
        el += [Spacer(1, 8), Paragraph("ข้อมูลการเข้าพัก", s["h"])]
        rows = [["โรงแรม", "เมือง/ประเทศ", "เช็กอิน", "เช็กเอาต์"]]
        rows += [[h.hotel_name or "-", f"{h.city or '-'} / {h.country or '-'}",
                  f"{h.check_in_date:%d/%m/%Y}" if h.check_in_date else "-",
                  f"{h.check_out_date:%d/%m/%Y}" if h.check_out_date else "-"]
                 for h in req.hotel_stays]
        el.append(_table(rows, s["font"]))

    if req.receipts:
        el += [Spacer(1, 8), Paragraph("ใบเสร็จและเอกสารแนบ", s["h"])]
        rows = [["#", "ประเภทเอกสาร", "เลขที่", "วันที่", "จำนวนเงิน", "ผลตรวจ"]]
        for r in req.receipts:
            f = (r.ocr_data or {}).get("fields", {})
            rows.append([str(r.receipt_id), f.get("document_type_label", "-"), f.get("receipt_no") or "-",
                         f.get("date") or "-", _money(f.get("amount")), r.status])
        el.append(_table(rows, s["font"]))

    if req.history:
        el += [Spacer(1, 8), Paragraph("ประวัติสถานะ", s["h"])]
        rows = [["วันเวลา", "สถานะ", "หมายเหตุ"]]
        rows += [[h.changed_at.strftime("%d/%m/%Y %H:%M"), STATUS_TH.get(h.status, h.status), h.note or "-"]
                 for h in req.history]
        el.append(_table(rows, s["font"], [35 * mm, 45 * mm, 90 * mm]))

    el += [Spacer(1, 12), Paragraph(f"สร้างโดยระบบ CS SmartClaim เมื่อ {datetime.now():%d/%m/%Y %H:%M}", s["p"])]
    doc.build(el)
    return buf.getvalue()


def build_report_pdf(stats: dict, title: str) -> bytes:
    s = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm)
    el = [Paragraph(title, s["title"]), Spacer(1, 6)]
    el.append(Paragraph(
        f"จำนวนผู้ใช้งาน: {stats['user_count']} คน &nbsp; คำขอทั้งหมด: {stats['request_count']} รายการ "
        f"&nbsp; ยอดเบิกจ่ายรวม: {_money(stats['total_reimbursed'])} บาท", s["p"]))
    el += [Spacer(1, 8), Paragraph("จำนวนคำขอแยกตามสถานะ", s["h"])]
    rows = [["สถานะ", "จำนวน"]] + [[STATUS_TH.get(k, k), str(v)] for k, v in stats["by_status"].items()]
    el.append(_table(rows, s["font"], [90 * mm, 40 * mm]))
    el += [Spacer(1, 8), Paragraph("การใช้วงเงินงบประมาณของอาจารย์", s["h"])]
    rows = [["อาจารย์", "วงเงินทั้งหมด", "ใช้ไป", "คงเหลือ"]]
    rows += [[b["full_name"], _money(b["budget_total"]), _money(b["budget_used"]), _money(b["budget_remaining"])]
             for b in stats["budgets"]]
    el.append(_table(rows, s["font"], [70 * mm, 33 * mm, 33 * mm, 33 * mm]))
    doc.build(el)
    return buf.getvalue()
