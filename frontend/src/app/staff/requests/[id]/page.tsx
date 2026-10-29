"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuthFile } from "@/components/AuthFile";
import { RequireRole } from "@/components/AuthProvider";
import { OCRResult } from "@/components/OCRResult";
import { RequestInfo } from "@/components/RequestInfo";
import { Alert, Button, Card, Field, Textarea } from "@/components/ui";
import { api, download } from "@/lib/api";
import { formatMoney } from "@/lib/constants";
import type { TravelRequest } from "@/lib/types";

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
        <Button
          variant="secondary"
          onClick={() =>
            download(`/requests/${req.request_id}/pdf`, `smartclaim_request_${req.request_id}.pdf`).catch((e) =>
              setError(e.message),
            )
          }
        >
          ⬇ ดาวน์โหลด PDF
        </Button>
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
