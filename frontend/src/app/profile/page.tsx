"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireRole, useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/Status";
import { Alert, Button, Card, Field, Input, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { ROLE_LABEL, formatDate, formatMoney } from "@/lib/constants";
import type { RequestSummary, User } from "@/lib/types";

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function Profile() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "" });
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [history, setHistory] = useState<RequestSummary[]>([]);

  useEffect(() => {
    if (user) setForm({ full_name: user.full_name, email: user.email, phone: user.phone ?? "" });
    if (user?.role === "teacher") api<RequestSummary[]>("/profile/history").then(setHistory).catch(() => {});
  }, [user]);

  const save = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      setMsg({ kind: "error", text: "รูปแบบอีเมลไม่ถูกต้อง ตัวอย่าง: name@kmutnb.ac.th" });
      return;
    }
    try {
      await api<User>("/profile", { method: "PUT", body: form });
      await refresh();
      setMsg({ kind: "success", text: "บันทึกสำเร็จ" });
    } catch (e) {
      setMsg({ kind: "error", text: `บันทึกข้อมูลไม่สำเร็จ (${(e as Error).message})` });
    }
  };

  const changePw = async () => {
    if (!PASSWORD_RULE.test(pw.new_password)) {
      setPwMsg({ kind: "error", text: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีทั้งตัวอักษรและตัวเลข" });
      return;
    }
    if (pw.new_password !== pw.confirm_password) {
      setPwMsg({ kind: "error", text: "ยืนยันรหัสผ่านไม่ตรงกับรหัสผ่านใหม่ กรุณากรอกใหม่อีกครั้ง" });
      return;
    }
    try {
      await api("/profile/password", { method: "PUT", body: pw });
      setPw({ current_password: "", new_password: "", confirm_password: "" });
      setPwMsg({ kind: "success", text: "บันทึกสำเร็จ" });
    } catch (e) {
      setPwMsg({ kind: "error", text: `บันทึกข้อมูลไม่สำเร็จ (${(e as Error).message})` });
    }
  };

  if (!user) return null;
  const p = user.teacher_profile;

  return (
    <div className="space-y-6">
      <PageTitle>โปรไฟล์ของฉัน</PageTitle>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="font-semibold">ข้อมูลส่วนตัว</h2>
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
          <Field label="ชื่อ-นามสกุล">
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="อีเมล">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="เบอร์โทรศัพท์">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <p className="text-sm text-slate-500">
            บทบาท: {ROLE_LABEL[user.role]} · ภาควิชา: {user.department ?? "-"}
          </p>
          <div className="flex gap-2">
            <Button onClick={save}>บันทึกการแก้ไข</Button>
            <Button variant="ghost" onClick={() => setForm({ full_name: user.full_name, email: user.email, phone: user.phone ?? "" })}>
              ยกเลิก
            </Button>
          </div>
        </Card>
        <Card className="space-y-4">
          <h2 className="font-semibold">เปลี่ยนรหัสผ่าน</h2>
          {pwMsg && <Alert kind={pwMsg.kind}>{pwMsg.text}</Alert>}
          <Field label="รหัสผ่านปัจจุบัน">
            <Input type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
          </Field>
          <Field label="รหัสผ่านใหม่" hint="อย่างน้อย 8 ตัวอักษร มีทั้งตัวอักษรและตัวเลข">
            <Input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
          </Field>
          <Field label="ยืนยันรหัสผ่านใหม่">
            <Input type="password" value={pw.confirm_password} onChange={(e) => setPw({ ...pw, confirm_password: e.target.value })} />
          </Field>
          <Button onClick={changePw}>เปลี่ยนรหัสผ่าน</Button>
        </Card>
      </div>

      {p && (
        <Card className="space-y-4">
          <h2 className="font-semibold">วงเงินงบประมาณและประวัติการเบิก</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <p>วงเงินทั้งหมด: <b>{formatMoney(p.budget_total)} ฿</b></p>
            <p>ใช้ไปแล้ว: <b>{formatMoney(p.budget_used)} ฿</b></p>
            <p>คงเหลือ: <b className="text-emerald-700">{formatMoney(p.budget_remaining)} ฿</b></p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="p-2">คำขอ</th>
                  <th className="p-2">วันที่</th>
                  <th className="p-2">สถานะ</th>
                  <th className="p-2 text-right">ยอดเบิกจริง</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.request_id} className="border-t">
                    <td className="p-2">
                      <Link href={`/teacher/requests/${r.request_id}`} className="text-brand-600 hover:underline">
                        #{r.request_id} {r.event_name}
                      </Link>
                    </td>
                    <td className="p-2">{formatDate(r.start_date)}</td>
                    <td className="p-2"><StatusBadge status={r.status} /></td>
                    <td className="p-2 text-right">{formatMoney(r.actual_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <RequireRole roles={["teacher", "staff"]}>
      <Profile />
    </RequireRole>
  );
}
