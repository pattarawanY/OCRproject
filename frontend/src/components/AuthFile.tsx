"use client";

import { useEffect, useState } from "react";
import { apiBlob, fileApiPath } from "@/lib/api";

/** แสดงไฟล์ที่ต้องยืนยันตัวตน (รูปใบเสร็จ/PDF) โดยดึงเป็น blob พร้อม token */
export function AuthFile({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let revoke: string | null = null;
    apiBlob(fileApiPath(path))
      .then((b) => {
        revoke = URL.createObjectURL(b);
        setType(b.type);
        setUrl(revoke);
      })
      .catch(() => setError(true));
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [path]);

  if (error) return <p className="text-sm text-red-600">ไม่สามารถโหลดไฟล์ได้</p>;
  if (!url) return <p className="text-sm text-slate-400">กำลังโหลดไฟล์...</p>;
  if (type === "application/pdf") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-sm text-brand-600 underline">
        เปิดไฟล์ PDF
      </a>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="เอกสาร" className={className ?? "max-h-96 rounded-lg border object-contain"} />;
}
