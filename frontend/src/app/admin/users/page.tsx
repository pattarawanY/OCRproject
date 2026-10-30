"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireRole, useAuth } from "@/components/AuthProvider";
import { Alert, Button, Card, Field, Input, PageTitle, Select, cn } from "@/components/ui";
import { api } from "@/lib/api";
import { ROLE_LABEL, formatMoney } from "@/lib/constants";
import type { Role, User } from "@/lib/types";

interface AdminResult {
  user: User;
  temporary_password: string | null;
  email_sent: boolean;
}

interface FormState {
  user_id?: number;
  full_name: string;
  email: string;
  phone: string;
  department: string;
  role: Role;
  budget_total: string;
}

const blank: FormState = {
  full_name: "",
  email: "",
  phone: "",
  department: "วิทยาการคอมพิวเตอร์และสารสนเทศ",
  role: "teacher",
  budget_total: "",
};

function ManageUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [msg, setMsg] = useState<{ kind: "success" | "error" | "warning"; text: string } | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (role) p.set("role", role);
    api<User[]>(`/admin/users?${p}`)
      .then(setUsers)
      .catch((e) => setMsg({ kind: "error", text: e.message }));
  }, [q, role]);
  useEffect(load, [load]);

  const showResult = (r: AdminResult, what: string) => {
    if (r.email_sent) setMsg({ kind: "success", text: `${what}สำเร็จ และส่งอีเมลแจ้งข้อมูลการเข้าสู่ระบบแล้ว` });
    else
      setMsg({
        kind: "warning",
        text: `${what}สำเร็จ แต่ส่งอีเมลไม่สำเร็จ — รหัสผ่านชั่วคราว: ${r.temporary_password} (กรุณาแจ้งผู้ใช้โดยตรง)`,
      });
  };

  const save = async () => {
    if (!form) return;
    if (!form.full_name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      setMsg({ kind: "error", text: "กรุณากรอกชื่อและอีเมลให้ถูกต้อง" });
      return;
    }
    const body = {
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || null,
      department: form.department || null,
      role: form.role,
      budget_total: form.role === "teacher" && form.budget_total !== "" ? Number(form.budget_total) : null,
    };
    try {
      if (form.user_id) {
        await api(`/admin/users/${form.user_id}`, { method: "PUT", body });
        setMsg({ kind: "success", text: "บันทึกสำเร็จ" });
      } else {
        showResult(await api<AdminResult>("/admin/users", { method: "POST", body }), "เพิ่มผู้ใช้");
      }
      setForm(null);
      load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };

  const toggle = async (u: User) => {
    try {
      await api(`/admin/users/${u.user_id}/toggle-active`, { method: "POST" });
      load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };

  const reset = async (u: User) => {
    if (!confirm(`รีเซ็ตรหัสผ่านของ ${u.full_name}?`)) return;
    try {
      showResult(await api<AdminResult>(`/admin/users/${u.user_id}/reset-password`, { method: "POST" }), "รีเซ็ตรหัสผ่าน");
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle action={<Button onClick={() => setForm({ ...blank })}>+ เพิ่มผู้ใช้</Button>}>จัดการบัญชีผู้ใช้</PageTitle>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      {form && (
        <Card className="space-y-4 border-brand-500">
          <h2 className="font-semibold">{form.user_id ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ชื่อ-นามสกุล *">
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="อีเมล *">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="เบอร์โทรศัพท์">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="ภาควิชา">
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </Field>
            <Field label="บทบาท">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </Field>
            {form.role === "teacher" && (
              <Field label="วงเงินงบประมาณ (บาท/ปี)">
                <Input type="number" min="0" value={form.budget_total} onChange={(e) => setForm({ ...form, budget_total: e.target.value })} />
              </Field>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>บันทึก</Button>
            <Button variant="ghost" onClick={() => setForm(null)}>
              ยกเลิก
            </Button>
          </div>
        </Card>
      )}

      <Card className="grid gap-3 sm:grid-cols-3">
        <Field label="ค้นหาชื่อหรืออีเมล">
          <Input value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <Field label="บทบาท">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="p-3">ชื่อ</th>
              <th className="p-3">อีเมล</th>
              <th className="p-3">บทบาท</th>
              <th className="p-3 text-right">วงเงิน</th>
              <th className="p-3">สถานะ</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} className={cn("border-t", !u.is_active && "text-slate-400")}>
                <td className="p-3">{u.full_name}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">{ROLE_LABEL[u.role]}</td>
                <td className="p-3 text-right">{u.teacher_profile ? formatMoney(u.teacher_profile.budget_total) : "-"}</td>
                <td className="p-3">{u.is_active ? "ใช้งาน" : "ระงับ"}</td>
                <td className="whitespace-nowrap p-3 text-right">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setForm({
                        user_id: u.user_id,
                        full_name: u.full_name,
                        email: u.email,
                        phone: u.phone ?? "",
                        department: u.department ?? "",
                        role: u.role,
                        budget_total: u.teacher_profile?.budget_total ?? "",
                      })
                    }
                  >
                    แก้ไข
                  </Button>
                  <Button variant="ghost" onClick={() => reset(u)}>
                    รีเซ็ตรหัสผ่าน
                  </Button>
                  {u.user_id !== me?.user_id && (
                    <Button variant="ghost" onClick={() => toggle(u)}>
                      {u.is_active ? "ระงับการใช้งาน" : "เปิดใช้งาน"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <RequireRole roles={["admin"]}>
      <ManageUsers />
    </RequireRole>
  );
}
