"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuthFile } from "@/components/AuthFile";
import { RequireRole } from "@/components/AuthProvider";
import { OCRResult } from "@/components/OCRResult";
import { Alert, Button, Card, Field, Input, PageTitle, WarningList } from "@/components/ui";
import { api, stashWarnings } from "@/lib/api";
import { formatMoney } from "@/lib/constants";
import type { ExtractedFields, OCRCheckResult, Receipt, RequestActionResult, TravelRequest } from "@/lib/types";

const EDITABLE: [keyof ExtractedFields, string][] = [
  ["book_no", "เล่มที่"],
  ["receipt_no", "เลขที่"],
  ["payee_name", "ชื่อผู้รับเงิน"],
  ["payee_address", "ที่อยู่ผู้รับเงิน"],
  ["date", "วันที่ (YYYY-MM-DD)"],
  ["description", "รายการ"],
  ["amount", "จำนวนเงิน"],
  ["amount_in_words", "จำนวนเงิน (ตัวอักษร)"],
];

function toResult(r: Receipt): OCRCheckResult {
  const open = r.issues.filter((i) => !i.resolved);
  return { receipt: r, passed: !open.length, warnings: open.map((i) => i.description) };
}

function ReceiptCard({ receipt, onChange, onRemove }: { receipt: Receipt; onChange: (r: Receipt) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const fields = receipt.ocr_data.fields!;

  const startEdit = () => {
    setDraft(Object.fromEntries(EDITABLE.map(([k]) => [k, fields[k] == null ? "" : String(fields[k])])));
    setEditing(true);
  };
  const save = async () => {
    setError("");
    const payload: Record<string, unknown> = { ...draft };
    payload.amount = draft.amount ? Number(draft.amount) : null;
    for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;
    try {
      const res = await api<OCRCheckResult>(`/receipts/${receipt.receipt_id}/fields`, {
        method: "PUT",
        body: { fields: payload },
      });
      onChange(res.receipt);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Card className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div>{receipt.image_file && <AuthFile path={receipt.image_file} className="max-h-80 w-full rounded border object-contain" />}</div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold">ใบเสร็จ #{receipt.receipt_id}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={startEdit}>
              แก้ไขข้อมูล
            </Button>
            <Button variant="ghost" onClick={onRemove}>
              ลบ
            </Button>
          </div>
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        {editing ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {EDITABLE.map(([k, label]) => (
              <Field key={k as string} label={label}>
                <Input value={draft[k as string] ?? ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
              </Field>
            ))}
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={save}>บันทึก</Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                ยกเลิก
              </Button>
            </div>
          </div>
        ) : (
          <OCRResult result={toResult(receipt)} />
        )}
      </div>
    </Card>
  );
}

function SubmitReceipts() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [req, setReq] = useState<TravelRequest | null>(null);
  const [actuals, setActuals] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setReq(await api<TravelRequest>(`/requests/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // กรอกยอดจริงอัตโนมัติจากยอดเงินในใบเสร็จตามหมวดค่าใช้จ่าย (แก้ไขได้)
  useEffect(() => {
    if (!req) return;
    const byCategory: Record<string, number> = {};
    for (const r of req.receipts) {
      const f = r.ocr_data.fields;
      if (f?.category && f.amount) byCategory[f.category] = (byCategory[f.category] ?? 0) + Number(f.amount);
    }
    setActuals((prev) => {
      const next = { ...prev };
      for (const item of req.expense_items) {
        if (next[item.item_id] === undefined || next[item.item_id] === "") {
          const auto = item.actual_amount ?? byCategory[item.category];
          next[item.item_id] = auto != null ? String(auto) : "";
        }
      }
      return next;
    });
  }, [req]);

  const upload = async (files: FileList) => {
    setBusy(true);
    setError("");
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", f);
      try {
        await api<OCRCheckResult>(`/requests/${id}/receipts`, { method: "POST", body: fd });
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`);
      }
    }
    await load();
    setBusy(false);
  };

  const remove = async (rid: number) => {
    await api(`/requests/${id}/receipts/${rid}`, { method: "DELETE" }).catch((e) => setError(e.message));
    await load();
  };

  const submit = async () => {
    if (!req) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<RequestActionResult>(`/requests/${id}/submit-receipts`, {
        method: "POST",
        body: {
          receipt_ids: req.receipts.map((r) => r.receipt_id),
          actual_amounts: req.expense_items.map((i) => ({
            item_id: i.item_id,
            actual_amount: Number(actuals[i.item_id]) || 0,
          })),
        },
      });
      stashWarnings(res.request.request_id, res.warnings);
      router.push(`/teacher/requests/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (!req) return error ? <Alert kind="error">{error}</Alert> : <p className="text-slate-500">กำลังโหลด...</p>;

  const allWarnings = req.receipts.flatMap((r) =>
    r.issues.filter((i) => !i.resolved).map((i) => `ใบเสร็จ #${r.receipt_id}: ${i.description}`),
  );
  const total = req.expense_items.reduce((s, i) => s + (Number(actuals[i.item_id]) || 0), 0);
  const estimated = Number(req.estimated_amount);

  return (
    <div className="space-y-6">
      <PageTitle>ส่งใบเสร็จเพื่อเบิกจ่าย — #{req.request_id} {req.event_name}</PageTitle>
      {error && <Alert kind="error">{error}</Alert>}

      <Card className="space-y-3">
        <p className="text-sm text-slate-600">
          อัปโหลด Itinerary Receipt / e-ticket, boarding pass, ใบเสร็จค่าที่พักพร้อม folio, ใบเสร็จค่าลงทะเบียน
          หรือใบรับรองแทนใบเสร็จรับเงิน (JPG, PNG, PDF) — ระบบจะอ่านด้วย OCR แปลภาษา และตรวจตามเกณฑ์ให้อัตโนมัติ
        </p>
        <label className="inline-flex cursor-pointer items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
          ⬆ อัปโหลดใบเสร็จ
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              if (e.target.files?.length) upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {busy && <p className="text-sm text-slate-500">กำลังประมวลผล...</p>}
      </Card>

      {req.receipts.map((r) => (
        <ReceiptCard
          key={r.receipt_id}
          receipt={r}
          onRemove={() => remove(r.receipt_id)}
          onChange={(nr) => setReq({ ...req, receipts: req.receipts.map((x) => (x.receipt_id === nr.receipt_id ? nr : x)) })}
        />
      ))}

      <Card className="space-y-3">
        <h2 className="font-semibold">แบบฟอร์มเบิกจ่าย (กรอกยอดจริงอัตโนมัติจากใบเสร็จ — ตรวจสอบและแก้ไขได้)</h2>
        {req.expense_items.map((i) => (
          <div key={i.item_id} className="grid grid-cols-12 items-center gap-2 text-sm">
            <span className="col-span-4">{i.category}</span>
            <span className="col-span-4 text-slate-500">ประมาณการ {formatMoney(i.estimated_amount)}</span>
            <Input
              className="col-span-4"
              type="number"
              min="0"
              value={actuals[i.item_id] ?? ""}
              onChange={(e) => setActuals({ ...actuals, [i.item_id]: e.target.value })}
            />
          </div>
        ))}
        <p className="text-right font-semibold">
          ยอดจริงรวม {formatMoney(total)} บาท{" "}
          {total > estimated && <span className="text-amber-700">(สูงกว่ายอดประมาณการ)</span>}
        </p>
      </Card>

      <WarningList warnings={allWarnings} />

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={() => router.back()}>
          ยกเลิก
        </Button>
        <Button onClick={submit} disabled={busy || !req.receipts.length}>
          ส่งใบเสร็จ
        </Button>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RequireRole roles={["teacher"]}>
      <SubmitReceipts />
    </RequireRole>
  );
}
