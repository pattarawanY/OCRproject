"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RequireRole } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/Status";
import { Alert, Button, Card, Empty, Field, Input, PageTitle, Select, cn } from "@/components/ui";
import { api } from "@/lib/api";
import { STATUS_LABEL, formatDate, formatMoney } from "@/lib/constants";
import type { RequestStatus, RequestSummary } from "@/lib/types";

const QUEUES: { key: string; label: string }[] = [
  { key: "pending_approval", label: "รออนุมัติ" },
  { key: "receipt_submitted", label: "รอตรวจสอบใบเสร็จ" },
  { key: "", label: "ทั้งหมด" },
];

function StaffDashboard() {
  const [status, setStatus] = useState("pending_approval");
  const [teacher, setTeacher] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<RequestSummary[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (teacher) q.set("teacher", teacher);
    if (from) q.set("date_from", from);
    if (to) q.set("date_to", to);
    api<RequestSummary[]>(`/requests?${q}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [status, teacher, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<RequestSummary[]>("/requests")
      .then((all) => {
        const c: Record<string, number> = {};
        all.forEach((r) => (c[r.status] = (c[r.status] ?? 0) + 1));
        setCounts(c);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <PageTitle>แดชบอร์ดเจ้าหน้าที่</PageTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(Object.keys(STATUS_LABEL) as RequestStatus[])
          .filter((s) => s !== "draft")
          .map((s) => (
            <Card key={s} className="p-4">
              <p className="text-xs text-slate-500">{STATUS_LABEL[s]}</p>
              <p className="text-2xl font-bold">{counts[s] ?? 0}</p>
            </Card>
          ))}
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {QUEUES.map((q) => (
            <button
              key={q.key}
              onClick={() => setStatus(q.key)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold",
                status === q.key ? "bg-brand-600 text-white" : "border bg-white text-slate-600",
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="สถานะ">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {(Object.keys(STATUS_LABEL) as RequestStatus[])
                .filter((s) => s !== "draft")
                .map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="ชื่ออาจารย์">
            <Input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="ค้นหา" />
          </Field>
          <Field label="ยื่นตั้งแต่วันที่">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="ถึงวันที่">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Button variant="secondary" onClick={() => { setTeacher(""); setFrom(""); setTo(""); }}>
          ล้างตัวกรอง
        </Button>
      </Card>

      {error && <Alert kind="error">{error}</Alert>}
      {rows && !rows.length && <Empty>ไม่พบคำขอ</Empty>}
      {rows && rows.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="p-3">เลขที่</th>
                <th className="p-3">อาจารย์</th>
                <th className="p-3">งาน</th>
                <th className="p-3">วันที่เดินทาง</th>
                <th className="p-3">ยื่นเมื่อ</th>
                <th className="p-3 text-right">ยอดเงิน</th>
                <th className="p-3">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.request_id} className="border-t hover:bg-slate-50">
                  <td className="p-3">
                    <Link href={`/staff/requests/${r.request_id}`} className="font-semibold text-brand-600 hover:underline">
                      #{r.request_id}
                    </Link>
                  </td>
                  <td className="p-3">{r.user.full_name}</td>
                  <td className="p-3">{r.event_name}</td>
                  <td className="p-3">{formatDate(r.start_date)}</td>
                  <td className="p-3">{formatDate(r.submitted_at)}</td>
                  <td className="p-3 text-right">
                    {r.request_type === "reimburse" ? formatMoney(r.actual_amount ?? r.estimated_amount) : "ไม่เบิก"}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <RequireRole roles={["staff"]}>
      <StaffDashboard />
    </RequireRole>
  );
}
