"use client";

import type { OCRWord } from "@/lib/types";

const FIELD_STYLE: Record<string, { color: string; label: string }> = {
  receipt_no: { color: "#7c3aed", label: "เลขที่" },
  date: { color: "#0891b2", label: "วันที่" },
  amount: { color: "#16a34a", label: "จำนวนเงิน" },
  amount_in_words: { color: "#d97706", label: "จำนวนเงิน (ตัวอักษร)" },
  description: { color: "#db2777", label: "รายการ" },
};
const DEFAULT_COLOR = "#2563eb";

/** แสดงภาพเอกสารพร้อมกรอบรอบคำที่ OCR อ่านได้ (พิกัดเป็นสัดส่วน 0-1 ของภาพ) */
export function OCRImageOverlay({ src, words }: { src: string; words: OCRWord[] }) {
  const fieldsFound = Object.keys(FIELD_STYLE).filter((k) => words.some((w) => w.field === k));
  return (
    <div className="space-y-2">
      <div className="relative mx-auto w-full max-w-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="เอกสารที่สแกน" className="block w-full rounded-lg border" />
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          {words.map((w, i) => {
            const color = (w.field && FIELD_STYLE[w.field]?.color) || DEFAULT_COLOR;
            const [x0, y0, x1, y1] = w.box;
            const pad = 0.003;
            return (
              <rect
                key={i}
                x={x0 - pad}
                y={y0 - pad}
                width={x1 - x0 + pad * 2}
                height={y1 - y0 + pad * 2}
                fill={color}
                fillOpacity={w.field ? 0.18 : 0.06}
                stroke={color}
                strokeWidth={w.field ? 2.5 : 1.2}
                vectorEffect="non-scaling-stroke"
                rx={0.004}
              >
                <title>{w.text}</title>
              </rect>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap justify-center gap-3 text-xs">
        <Legend color={DEFAULT_COLOR} label={`ข้อความที่อ่านได้ (${words.length})`} />
        {fieldsFound.map((k) => (
          <Legend key={k} color={FIELD_STYLE[k].color} label={FIELD_STYLE[k].label} />
        ))}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 rounded-sm border-2" style={{ borderColor: color, background: `${color}30` }} />
      {label}
    </span>
  );
}
