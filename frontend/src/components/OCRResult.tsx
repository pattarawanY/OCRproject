"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/constants";
import type { OCRCheckResult } from "@/lib/types";
import { Alert, WarningList } from "./ui";

const FIELD_LABELS: [string, string][] = [
  ["document_type_label", "ประเภทเอกสาร"],
  ["book_no", "เล่มที่"],
  ["receipt_no", "เลขที่"],
  ["payee_name", "ผู้รับเงิน/ผู้ออกเอกสาร"],
  ["payee_address", "ที่อยู่ผู้รับเงิน"],
  ["date", "วันที่"],
  ["description", "รายการ"],
  ["amount", "จำนวนเงิน"],
  ["currency", "สกุลเงิน"],
  ["amount_in_words", "จำนวนเงิน (ตัวอักษร)"],
  ["tax_id", "เลขประจำตัวผู้เสียภาษี"],
  ["guest_name", "ชื่อผู้เข้าพัก/ผู้โดยสาร"],
  ["check_in", "วันเข้าพัก"],
  ["check_out", "วันออก"],
  ["flight_numbers", "เที่ยวบิน"],
];

export function OCRResult({ result }: { result: OCRCheckResult }) {
  const [showRaw, setShowRaw] = useState(false);
  const fields = result.receipt.ocr_data.fields;
  if (!fields) return null;

  return (
    <div className="space-y-4">
      {result.passed ? (
        <Alert kind="success">
          <span className="font-semibold">✓ ผ่านเกณฑ์</span> — เอกสารมีองค์ประกอบครบตามเกณฑ์การเบิกจ่ายเบื้องต้น
        </Alert>
      ) : (
        <WarningList title="✗ ไม่ผ่านเกณฑ์ — รายการที่ขาดหรือไม่ถูกต้อง" warnings={result.warnings} />
      )}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {FIELD_LABELS.map(([key, label]) => {
          let v = fields[key];
          if (Array.isArray(v)) v = v.join(", ");
          if (key === "amount") v = formatMoney(v as number);
          return (
            <div key={key} className="flex gap-2 border-b border-slate-100 py-1">
              <dt className="w-40 shrink-0 text-slate-500">{label}</dt>
              <dd className="font-medium text-slate-800">{(v as string) || "-"}</dd>
            </div>
          );
        })}
        <div className="flex gap-2 border-b border-slate-100 py-1">
          <dt className="w-40 shrink-0 text-slate-500">ลายมือชื่อผู้รับเงิน</dt>
          <dd className="font-medium">{fields.has_signature ? "พบ" : "ไม่พบ"}</dd>
        </div>
      </dl>

      {result.receipt.translated_text && (
        <div>
          <p className="mb-1 text-sm font-semibold text-slate-700">
            คำแปลภาษาไทย (ภาษาต้นฉบับ: {result.receipt.source_language})
          </p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs">
            {result.receipt.translated_text}
          </pre>
        </div>
      )}
      <button className="text-xs text-brand-600 underline" onClick={() => setShowRaw(!showRaw)}>
        {showRaw ? "ซ่อน" : "แสดง"}ข้อความ OCR ต้นฉบับ
      </button>
      {showRaw && (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs">
          {result.receipt.ocr_data.raw_text}
        </pre>
      )}
    </div>
  );
}
