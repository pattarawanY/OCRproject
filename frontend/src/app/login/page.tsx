"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { ROLE_HOME } from "@/lib/constants";

export default function LoginPage() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace(ROLE_HOME[user.role]);
  }, [user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("กรุณากรอกอีเมลและรหัสผ่านให้ครบ");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const u = await login(email, password);
      router.replace(ROLE_HOME[u.role]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-8">
        <h1 className="text-2xl font-bold">เข้าสู่ระบบ</h1>
        <p className="mt-1 text-sm text-slate-500">สำหรับอาจารย์ เจ้าหน้าที่ และผู้ดูแลระบบ</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && <Alert kind="error">{error}</Alert>}
          <Field label="อีเมล">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="รหัสผ่าน">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
