"use client";

import { useEffect, useState } from "react";
import { apiBlob, download } from "@/lib/api";
import { Button, Card } from "./ui";

/** ปุ่มดูตัวอย่างและดาวน์โหลดเอกสารเบิกจ่าย PDF ของคำขอ */
export function PdfPreview({ requestId, onError }: { requestId: number; onError: (message: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const path = `/requests/${requestId}/pdf`;
  const filename = `smartclaim_request_${requestId}.pdf`;

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const toggle = async () => {
    if (url) return setUrl(null);
    setLoading(true);
    try {
      setUrl(URL.createObjectURL(await apiBlob(path)));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={toggle} disabled={loading}>
        {url ? "ซ่อนตัวอย่าง PDF" : loading ? "กำลังสร้าง PDF..." : "👁 ดูตัวอย่าง PDF"}
      </Button>
      <Button variant="secondary" onClick={() => download(path, filename).catch((e) => onError(e.message))}>
        ⬇ ดาวน์โหลด PDF
      </Button>
      {url && (
        <Card className="w-full p-0">
          <iframe src={url} title="ตัวอย่างเอกสารเบิกจ่าย" className="h-[70vh] w-full rounded-xl" />
        </Card>
      )}
    </>
  );
}
