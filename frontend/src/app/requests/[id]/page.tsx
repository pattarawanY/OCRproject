"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";

/** ลิงก์จากอีเมลแจ้งเตือน -> ส่งต่อไปหน้าคำขอตามบทบาท */
export default function RequestRedirect() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.role === "staff") router.replace(`/staff/requests/${id}`);
    else router.replace(`/teacher/requests/${id}`);
  }, [user, loading, id, router]);

  return <p className="py-20 text-center text-slate-500">กำลังเปิดคำขอ...</p>;
}
