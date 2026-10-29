"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireRole } from "@/components/AuthProvider";
import { RequestInfo } from "@/components/RequestInfo";
import { Alert, Button, WarningList } from "@/components/ui";
import { api, download, popWarnings } from "@/lib/api";
import type { TravelRequest } from "@/lib/types";

function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [req, setReq] = useState<TravelRequest | null>(null);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    setWarnings(popWarnings(id));
    api<TravelRequest>(`/requests/${id}`).then(setReq).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!req) return <p className="text-slate-500">กำลังโหลด...</p>;

  const lastNote = [...req.history].reverse()[0]?.note;
  const deleteDraft = async () => {
    if (!confirm("ลบฉบับร่างนี้?")) return;
    try {
      await api(`/requests/${req.request_id}`, { method: "DELETE" });
      router.push("/teacher");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <WarningList warnings={warnings} />
      {req.status === "pending_approval" && <Alert kind="info">ยื่นคำขอสำเร็จ — รอเจ้าหน้าที่พิจารณา</Alert>}
      {req.status === "rejected" && <Alert kind="error">ไม่อนุมัติ: {lastNote} — แก้ไขคำขอแล้วยื่นใหม่ได้</Alert>}
      {req.status === "receipt_rejected" && <Alert kind="error">ใบเสร็จไม่ผ่าน: {lastNote} — กรุณาแก้ไขหรือส่งใบเสร็จใหม่</Alert>}

      <div className="flex flex-wrap gap-2">
        {(req.status === "draft" || req.status === "rejected") && (
          <Link href={`/teacher/requests/${req.request_id}/edit`}>
            <Button>แก้ไขคำขอ</Button>
          </Link>
        )}
        {req.status === "draft" && (
          <Button variant="danger" onClick={deleteDraft}>
            ลบฉบับร่าง
          </Button>
        )}
        {(req.status === "approved" || req.status === "receipt_rejected") && req.request_type === "reimburse" && (
          <Link href={`/teacher/requests/${req.request_id}/receipts`}>
            <Button>ส่งใบเสร็จ</Button>
          </Link>
        )}
        {req.status !== "draft" && (
          <Button
            variant="secondary"
            onClick={() =>
              download(`/requests/${req.request_id}/pdf`, `smartclaim_request_${req.request_id}.pdf`).catch((e) =>
                setError(e.message),
              )
            }
          >
            ⬇ ดาวน์โหลด PDF
          </Button>
        )}
      </div>

      <RequestInfo req={req} />
    </div>
  );
}

export default function Page() {
  return (
    <RequireRole roles={["teacher"]}>
      <RequestDetail />
    </RequireRole>
  );
}
