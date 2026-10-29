"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireRole, useAuth } from "@/components/AuthProvider";
import { Alert, Button, Card, Empty, PageTitle, cn } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/constants";
import type { Notification } from "@/lib/types";

function Notifications() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState("");

  const load = () => api<Notification[]>("/notifications").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const open = async (n: Notification) => {
    if (!n.is_read) await api(`/notifications/${n.notification_id}/read`, { method: "POST" }).catch(() => {});
    if (n.related_request_id) router.push(`/${user?.role}/requests/${n.related_request_id}`);
    else load();
  };

  return (
    <div className="space-y-4">
      <PageTitle
        action={
          <Button variant="secondary" onClick={() => api("/notifications/read-all", { method: "POST" }).then(load)}>
            อ่านทั้งหมด
          </Button>
        }
      >
        การแจ้งเตือน
      </PageTitle>
      {error && <Alert kind="error">{error}</Alert>}
      {items && !items.length && <Empty>ยังไม่มีการแจ้งเตือน</Empty>}
      {items?.map((n) => (
        <button key={n.notification_id} onClick={() => open(n)} className="block w-full text-left">
          <Card className={cn("transition hover:border-brand-500", !n.is_read && "border-l-4 border-l-brand-500")}>
            <div className="flex justify-between gap-2">
              <p className={cn(!n.is_read && "font-semibold")}>
                {n.type === "warning" ? "⚠ " : ""}
                {n.subject}
              </p>
              <span className="shrink-0 text-xs text-slate-500">{formatDate(n.sent_at, true)}</span>
            </div>
            {n.message && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{n.message}</p>}
          </Card>
        </button>
      ))}
    </div>
  );
}

export default function Page() {
  return (
    <RequireRole roles={["teacher", "staff"]}>
      <Notifications />
    </RequireRole>
  );
}
