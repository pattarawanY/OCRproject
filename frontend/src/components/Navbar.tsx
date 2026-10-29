"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/constants";
import type { Role } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import { cn } from "./ui";

const MENU: Record<Role | "guest", { href: string; label: string }[]> = {
  guest: [
    { href: "/scan", label: "สแกนใบเสร็จ" },
    { href: "/recommendations", label: "โรงแรม & สายการบิน" },
  ],
  teacher: [
    { href: "/teacher", label: "หน้าหลัก" },
    { href: "/teacher/requests/new", label: "ยื่นคำขออนุมัติ" },
    { href: "/scan", label: "สแกนใบเสร็จ" },
    { href: "/samples", label: "ตัวอย่างเอกสาร" },
    { href: "/recommendations", label: "โรงแรม & สายการบิน" },
  ],
  staff: [
    { href: "/staff", label: "แดชบอร์ด" },
    { href: "/staff/samples", label: "จัดการตัวอย่างเอกสาร" },
  ],
  admin: [
    { href: "/admin", label: "แดชบอร์ดและรายงาน" },
    { href: "/admin/users", label: "จัดการบัญชีผู้ใช้" },
  ],
};

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    if (!user || user.role === "admin") return;
    api<{ count: number }>("/notifications/unread-count")
      .then((r) => setUnread(r.count))
      .catch(() => setUnread(0));
  }, [user, pathname]);

  const items = MENU[user?.role ?? "guest"];

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-brand-700">
          <span className="rounded-md bg-brand-600 px-2 py-0.5 text-white">CS</span> SmartClaim
        </Link>
        <button className="ml-auto rounded p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="เมนู">
          ☰
        </button>
        <nav
          className={cn(
            "absolute left-0 right-0 top-full flex-col gap-1 border-b border-slate-200 bg-white p-3 md:static md:flex md:flex-1 md:flex-row md:items-center md:border-0 md:p-0",
            open ? "flex" : "hidden",
          )}
        >
          {items.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                pathname === m.href ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {m.label}
            </Link>
          ))}
          <div className="flex items-center gap-2 md:ml-auto">
            {user ? (
              <>
                {user.role !== "admin" && (
                  <Link href="/notifications" className="relative rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                    🔔
                    {unread > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {unread}
                      </span>
                    )}
                  </Link>
                )}
                {user.role !== "admin" && (
                  <Link href="/profile" className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                    {user.full_name} <span className="text-xs text-slate-400">({ROLE_LABEL[user.role]})</span>
                  </Link>
                )}
                <button
                  onClick={() => {
                    logout();
                    router.push("/login");
                  }}
                  className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  ออกจากระบบ
                </button>
              </>
            ) : (
              <Link href="/login" className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white">
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
