"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireRole } from "@/components/AuthProvider";
import { RequestForm } from "@/components/RequestForm";
import { Alert, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import type { TravelRequest } from "@/lib/types";

function EditRequest() {
  const { id } = useParams<{ id: string }>();
  const [req, setReq] = useState<TravelRequest | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<TravelRequest>(`/requests/${id}`).then(setReq).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!req) return <p className="text-slate-500">กำลังโหลด...</p>;
  const lastNote = [...req.history].reverse().find((h) => h.status === "rejected")?.note;
  return (
    <>
      <PageTitle>แก้ไขคำขอ #{req.request_id}</PageTitle>
      {req.status === "rejected" && lastNote && (
        <div className="mb-4">
          <Alert kind="error">เหตุผลที่ไม่อนุมัติ: {lastNote}</Alert>
        </div>
      )}
      <RequestForm initial={req} />
    </>
  );
}

export default function Page() {
  return (
    <RequireRole roles={["teacher"]}>
      <EditRequest />
    </RequireRole>
  );
}
