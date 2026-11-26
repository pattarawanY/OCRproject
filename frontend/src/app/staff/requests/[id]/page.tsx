"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuthFile } from "@/components/AuthFile";
import { RequireRole } from "@/components/AuthProvider";
import { OCRResult } from "@/components/OCRResult";
import { PdfPreview } from "@/components/PdfPreview";
import { RequestInfo } from "@/components/RequestInfo";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/constants";
import type { Receipt, TravelRequest } from "@/lib/types";

/** เจ้าหน้าที่ระบุปัญหาเพิ่ม หรือยืนยันว่าปัญหาที่ระบบตรวจพบแก้ไขแล้ว (เฉพาะใบเสร็จที่รอตรวจ) */
function IssueManager({ receipt, onChange, onError }: { receipt: Receipt; onChange: (r: Receipt) => void; onError: (m: string) => void }) {
  const [text, setText] = useState("");
  const run = async (path: string, body?: unknown) => {
    try {
      onChange(await api<Receipt>(path, { method: "POST", body }));
    } catch (e) {
      onError((e as Error).message);
    }
  };
  return (
    <div className="space-y-2 border-t pt-3 lg:col-span-2">
      <p className="text-sm font-semibold">ปัญหาที่พบ</p>
      {receipt.issues.map((i) => (
        <div key={i.issue_id} className="flex items-center justify-between gap-2 text-sm">
          <span className={i.resolved ? "text-slate-400 line-through" : ""}>
            {i.reported_by ? "👤 " : "🤖 "}
            {i.description}
          </span>
          {!i.resolved && (
            <Button variant="ghost" onClick={() => run(`/receipts/issues/${i.issue_id}/resolve`)}>
              ✓ ตรวจแล้ว
            </Button>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Input placeholder="ระบุปัญหาเพิ่มเติม" value={text} onChange={(e) => setText(e.target.value)} />
        <Button
          variant="secondary"
          disabled={!text.trim()}
          onClick={() => run(`/receipts/${receipt.receipt_id}/issues`, { description: text }).then(() => setText(""))}
        >
          เพิ่ม
        </Button>
      </div>
    </div>
  );
}

type Action = "approve" | "reject" | "pass" | "fail" | null;

function StaffReview() {
  const { id } = useParams<{ id: string }>();
  const [req, setReq] = useState<TravelRequest | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<TravelRequest>(`/requests/${id}`).then(setReq).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  const confirm = async () => {
    if ((action === "reject" || action === "fail") && !reason.trim()) {
      setError("กรุณากรอกเหตุผลก่อนยืนยัน");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const path = {
        approve: ["approve", undefined],
        reject: ["reject", { reason }],
        pass: ["verify", { passed: true, note: reason || null }],
        fail: ["verify", { passed: false, note: reason }],
      }[action!] as [string, unknown];
      setReq(await api<TravelRequest>(`/requests/${id}/${path[0]}`, { method: "POST", body: path[1] }));
      setSuccess("บันทึกผลสำเร็จ และแจ้งเตือนอาจารย์แล้ว");
      setAction(null);
      setReason("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!req) return error ? <Alert kind="error">{error}</Alert> : <p className="text-slate-500">กำลังโหลด...</p>;

  const actionLabel = { approve: "อนุมัติ", reject: "ไม่อนุมัติ", pass: "ใบเสร็จผ่าน", fail: "ใบเสร็จไม่ผ่าน" };

  return (
    <div className="space-y-4">
      {success && <Alert kind="success">{success}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        {req.status === "pending_approval" && (
          <>
            <Button variant="success" onClick={() => setAction("approve")}>
              อนุมัติ
            </Button>
            <Button variant="danger" onClick={() => setAction("reject")}>
              ไม่อนุมัติ
            </Button>
          </>
        )}
        {req.status === "receipt_submitted" && (
          <>
            <Button variant="success" onClick={() => setAction("pass")}>
              ใบเสร็จผ่าน
            </Button>
            <Button variant="danger" onClick={() => setAction("fail")}>
              ใบเสร็จไม่ผ่าน
            </Button>
          </>
        )}
        <PdfPreview requestId={req.request_id} onError={setError} />
      </div>

      {action && (
        <Card className="space-y-3 border-brand-500">
          <p className="font-semibold">ยืนยัน: {actionLabel[action]}</p>
          {action !== "approve" && (
            <Field label={action === "pass" ? "หมายเหตุ (ถ้ามี)" : "เหตุผลและคำแนะนำในการแก้ไข *"}>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          )}
          <div className="flex gap-2">
            <Button onClick={confirm} disabled={busy}>
              ยืนยัน
            </Button>
            <Button variant="ghost" onClick={() => setAction(null)}>
              ยกเลิก
            </Button>
          </div>
        </Card>
      )}

      <RequestInfo req={req} />

      {req.receipts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            ใบเสร็จต้นฉบับเทียบข้อมูล OCR — ยอดประมาณการ {formatMoney(req.estimated_amount)} / ยอดจริง{" "}
            {formatMoney(req.actual_amount)} บาท
          </h2>
          {req.receipts.map((r) => {
            const open = r.issues.filter((i) => !i.resolved);
            return (
              <Card key={r.receipt_id} className="grid gap-4 lg:grid-cols-2">
                <div>{r.image_file && <AuthFile path={r.image_file} className="w-full rounded border object-contain" />}</div>
                <OCRResult result={{ receipt: r, passed: !open.length, warnings: open.map((i) => i.description) }} />
                {req.status === "receipt_submitted" && (
                  <IssueManager
                    receipt={r}
                    onError={setError}
                    onChange={(nr) =>
                      setReq({ ...req, receipts: req.receipts.map((x) => (x.receipt_id === nr.receipt_id ? nr : x)) })
                    }
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <RequireRole roles={["staff"]}>
      <StaffReview />
    </RequireRole>
  );
}
