"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { ROLE_HOME } from "@/lib/constants";

const FEATURES = [
  { icon: "📷", title: "สแกนใบเสร็จด้วย AI" },
  { icon: "🌐", title: "แปลเอกสารต่างประเทศ" },
  { icon: "📊", title: "ติดตามสถานะแบบ Progress bar" },
  { icon: "📄", title: "สร้างเอกสารเบิกจ่าย PDF" },
];

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-sky-500 px-6 py-12 text-white sm:px-10">
        <h1 className="text-3xl font-bold sm:text-4xl">CS SmartClaim</h1>
        <div className="mt-6 flex flex-wrap gap-3">
          {user ? (
            <Link href={ROLE_HOME[user.role]} className="rounded-lg bg-white px-5 py-2.5 font-semibold text-brand-700">
              ไปที่หน้าหลัก
            </Link>
          ) : (
            <Link href="/login" className="rounded-lg bg-white px-5 py-2.5 font-semibold text-brand-700">
              เข้าสู่ระบบ
            </Link>
          )}
          <Link href="/scan" className="rounded-lg border border-white/70 px-5 py-2.5 font-semibold">
            สแกนใบเสร็จ
          </Link>
          <Link href="/recommendations" className="rounded-lg border border-white/70 px-5 py-2.5 font-semibold">
            โรงแรม & สายการบินแนะนำ
          </Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-3xl">{f.icon}</div>
            <h3 className="mt-2 font-semibold">{f.title}</h3>
          </div>
        ))}
      </section>
    </div>
  );
}
