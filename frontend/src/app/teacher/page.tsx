"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireRole, useAuth } from "@/components/AuthProvider";
import { StatusBadge, StatusProgress } from "@/components/Status";
import { Alert, Card, Empty, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/constants";
import type { RequestSummary } from "@/lib/types";

function TeacherHome() {
  const { user, refresh } = useAuth();
  const [requests, setRequests] = useState<RequestSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    refresh();
    api<RequestSummary[]>("/requests")
      .then(setRequests)
      .catch((e) => setError(e.message));
  }, [refresh]);

  const p = user?.teacher_profile;
  return (
    <div className="space-y-6">
      <PageTitle
        action={
          <Link href="/teacher/requests/new" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
            + ยื่นคำขออนุมัติไปราชการ
          </Link>
        }
      >
        สวัสดี {user?.full_name}
      </PageTitle>

      {p && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-sm text-slate-500">วงเงินงบประมาณทั้งหมด</p>
            <p className="text-2xl font-bold">{formatMoney(p.budget_total)} ฿</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">ใช้ไปแล้ว</p>
            <p className="text-2xl font-bold text-brand-700">{formatMoney(p.budget_used)} ฿</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">คงเหลือ</p>
            <p className="text-2xl font-bold text-emerald-700">{formatMoney(p.budget_remaining)} ฿</p>
          </Card>
        </div>
      )}

      <h2 className="text-lg font-semibold">คำขอของฉัน</h2>
      {error && <Alert kind="error">{error}</Alert>}
      {requests && !requests.length && <Empty>ยังไม่มีคำขอ</Empty>}
      <div className="space-y-3">
        {requests?.map((r) => (
          <Link key={r.request_id} href={`/teacher/requests/${r.request_id}`} className="block">
            <Card className="space-y-4 transition hover:border-brand-500">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    #{r.request_id} {r.event_name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {r.activity_type} · {r.location} · {formatDate(r.start_date)} – {formatDate(r.end_date)}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status={r.status} />
                  <p className="mt-1 text-sm text-slate-500">
                    {r.request_type === "reimburse" ? `ประมาณการ ${formatMoney(r.estimated_amount)} ฿` : "ไม่เบิกค่าใช้จ่าย"}
                  </p>
                </div>
              </div>
              <StatusProgress status={r.status} reimburse={r.request_type === "reimburse"} />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RequireRole roles={["teacher"]}>
      <TeacherHome />
    </RequireRole>
  );
}
