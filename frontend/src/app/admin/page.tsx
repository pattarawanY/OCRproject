"use client";

import { useEffect, useState } from "react";
import { RequireRole } from "@/components/AuthProvider";
import { Alert, Button, Card, Empty, Field, PageTitle, Select } from "@/components/ui";
import { api, download } from "@/lib/api";
import { ROLE_LABEL, STATUS_LABEL, formatMoney } from "@/lib/constants";
import type { DashboardStats, RequestStatus, Role } from "@/lib/types";

const THIS_FY = new Date().getFullYear() + 543 + (new Date().getMonth() >= 9 ? 1 : 0);
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function AdminDashboard() {
  const [fy, setFy] = useState("");
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  const query = () => {
    const q = new URLSearchParams();
    if (fy) q.set("fiscal_year", fy);
    if (month) q.set("month", month);
    if (status) q.set("status", status);
    return q;
  };

  useEffect(() => {
    api<DashboardStats>(`/admin/dashboard?${query()}`)
      .then(setStats)
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy, month, status]);

  const report = (format: "pdf" | "xlsx") => {
    const q = query();
    q.set("format", format);
    download(`/admin/dashboard/report?${q}`, `smartclaim_report.${format}`).catch((e) => setError(e.message));
  };

  const max = stats ? Math.max(1, ...Object.values(stats.by_status)) : 1;

  return (
    <div className="space-y-6">
      <PageTitle
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => report("pdf")}>
              ⬇ รายงาน PDF
            </Button>
            <Button variant="secondary" onClick={() => report("xlsx")}>
              ⬇ รายงาน Excel
            </Button>
          </div>
        }
      >
        แดชบอร์ดภาพรวมและรายงาน
      </PageTitle>

      <Card className="grid gap-3 sm:grid-cols-3">
        <Field label="ปีงบประมาณ">
          <Select value={fy} onChange={(e) => setFy(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {[THIS_FY, THIS_FY - 1, THIS_FY - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="เดือน (ตามวันที่เดินทาง)">
          <Select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="สถานะคำขอ">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {Object.entries(STATUS_LABEL)
              .filter(([k]) => k !== "draft")
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </Select>
        </Field>
      </Card>

      {error && <Alert kind="error">{error}</Alert>}
      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-sm text-slate-500">คำขอทั้งหมด</p>
              <p className="text-3xl font-bold">{stats.request_count}</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500">ยอดเบิกจ่ายรวม (เสร็จสิ้น)</p>
              <p className="text-3xl font-bold text-emerald-700">{formatMoney(stats.total_reimbursed)}</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500">ยอดประมาณการรวม</p>
              <p className="text-3xl font-bold">{formatMoney(stats.total_estimated)}</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500">ผู้ใช้งาน (เปิดใช้งาน)</p>
              <p className="text-3xl font-bold">{stats.user_count}</p>
              <p className="text-xs text-slate-500">
                {(Object.keys(stats.users_by_role) as Role[]).map((r) => `${ROLE_LABEL[r]} ${stats.users_by_role[r]}`).join(" · ")}
              </p>
            </Card>
          </div>

          {stats.request_count === 0 && <Empty>ไม่พบข้อมูลในช่วงเวลาที่เลือก</Empty>}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-4 font-semibold">จำนวนคำขอแยกตามสถานะ</h2>
              <div className="space-y-2">
                {Object.entries(stats.by_status).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[150px_1fr_40px] items-center gap-2 text-sm">
                    <span>{STATUS_LABEL[k as RequestStatus]}</span>
                    <div className="h-4 rounded bg-slate-100">
                      <div className="h-4 rounded bg-brand-500" style={{ width: `${(v / max) * 100}%` }} />
                    </div>
                    <span className="text-right font-semibold">{v}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h2 className="mb-4 font-semibold">การใช้วงเงินงบประมาณของอาจารย์</h2>
              <div className="space-y-3">
                {stats.budgets.map((b) => {
                  const pct = b.budget_total ? Math.min(100, (b.budget_used / b.budget_total) * 100) : 0;
                  return (
                    <div key={b.user_id} className="text-sm">
                      <div className="flex justify-between">
                        <span>{b.full_name}</span>
                        <span className="text-slate-500">
                          {formatMoney(b.budget_used)} / {formatMoney(b.budget_total)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded bg-slate-100">
                        <div
                          className={pct > 90 ? "h-2 rounded bg-red-500" : "h-2 rounded bg-emerald-500"}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {!stats.budgets.length && <p className="text-sm text-slate-500">ยังไม่มีอาจารย์ในระบบ</p>}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <RequireRole roles={["admin"]}>
      <AdminDashboard />
    </RequireRole>
  );
}
