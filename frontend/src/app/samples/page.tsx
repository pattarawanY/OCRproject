"use client";

import { useEffect, useState } from "react";
import { AuthFile } from "@/components/AuthFile";
import { RequireRole } from "@/components/AuthProvider";
import { Alert, Card, Empty, PageTitle, cn } from "@/components/ui";
import { api } from "@/lib/api";
import type { DocumentSample } from "@/lib/types";
import { useReceiptOptions } from "@/lib/useReceiptOptions";

function Samples() {
  const [samples, setSamples] = useState<DocumentSample[] | null>(null);
  const [type, setType] = useState("");
  const [selected, setSelected] = useState<DocumentSample | null>(null);
  const [error, setError] = useState("");
  const { typeLabel, elementLabel } = useReceiptOptions();

  useEffect(() => {
    api<DocumentSample[]>("/samples").then(setSamples).catch((e) => setError(e.message));
  }, []);

  const types = [...new Set(samples?.map((s) => s.document_type))];
  const shown = samples?.filter((s) => !type || s.document_type === type) ?? [];

  return (
    <div className="space-y-6">
      <PageTitle>ตัวอย่างเอกสารที่ถูกต้องตามเกณฑ์การเบิกจ่าย</PageTitle>
      {error && <Alert kind="error">{error}</Alert>}
      {samples && !samples.length && <Empty>ยังไม่มีตัวอย่างเอกสาร</Empty>}
      <div className="flex flex-wrap gap-2">
        <button className={cn("rounded-full px-3 py-1 text-sm", !type ? "bg-brand-600 text-white" : "bg-white border")} onClick={() => setType("")}>
          ทั้งหมด
        </button>
        {types.map((t) => (
          <button
            key={t}
            className={cn("rounded-full px-3 py-1 text-sm", type === t ? "bg-brand-600 text-white" : "bg-white border")}
            onClick={() => setType(t)}
          >
            {typeLabel(t)}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {shown.map((s) => (
          <Card key={s.sample_id} className={cn("cursor-pointer", selected?.sample_id === s.sample_id && "border-brand-500")}>
            <div onClick={() => setSelected(s)}>
              <h3 className="font-semibold">{typeLabel(s.document_type)}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.description}</p>
              <p className="mt-3 text-sm font-medium">องค์ประกอบที่เอกสารต้องมี</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                {s.required_elements.map((e) => (
                  <li key={e}>{elementLabel(e)}</li>
                ))}
              </ul>
            </div>
            {selected?.sample_id === s.sample_id && s.file && (
              <div className="mt-3">
                <AuthFile path={s.file} />
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RequireRole roles={["teacher", "staff"]}>
      <Samples />
    </RequireRole>
  );
}
