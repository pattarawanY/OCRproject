"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireRole } from "@/components/AuthProvider";
import { Alert, Button, Card, Field, Input, PageTitle, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import type { DocumentSample } from "@/lib/types";
import { useReceiptOptions } from "@/lib/useReceiptOptions";

interface FormState {
  sample_id?: number;
  document_type: string;
  description: string;
  required_elements: string[];
  file: File | null;
}

const blank: FormState = { document_type: "receipt", description: "", required_elements: [], file: null };

function ManageSamples() {
  const [samples, setSamples] = useState<DocumentSample[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const { document_types, elements, typeLabel, elementLabel } = useReceiptOptions();

  const load = useCallback(() => {
    api<DocumentSample[]>("/samples")
      .then(setSamples)
      .catch((e) => setMsg({ kind: "error", text: e.message }));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    if (!form) return;
    if (!form.document_type || !form.required_elements.length) {
      setMsg({ kind: "error", text: "กรุณาเลือกประเภทเอกสารและองค์ประกอบที่เอกสารต้องมีอย่างน้อย 1 รายการ" });
      return;
    }
    const fd = new FormData();
    fd.append("document_type", form.document_type);
    fd.append("description", form.description);
    fd.append("required_elements", JSON.stringify(form.required_elements));
    if (form.file) fd.append("file", form.file);
    try {
      await api(form.sample_id ? `/samples/${form.sample_id}` : "/samples", {
        method: form.sample_id ? "PUT" : "POST",
        body: fd,
      });
      setMsg({ kind: "success", text: "บันทึกสำเร็จ" });
      setForm(null);
      load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };

  const remove = async (s: DocumentSample) => {
    if (!confirm(`ลบตัวอย่าง "${typeLabel(s.document_type)}"?`)) return;
    try {
      await api(`/samples/${s.sample_id}`, { method: "DELETE" });
      setMsg({ kind: "success", text: "ลบสำเร็จ" });
      load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  };

  const toggle = (k: string) =>
    form &&
    setForm({
      ...form,
      required_elements: form.required_elements.includes(k)
        ? form.required_elements.filter((x) => x !== k)
        : [...form.required_elements, k],
    });

  return (
    <div className="space-y-6">
      <PageTitle action={<Button onClick={() => setForm({ ...blank })}>+ เพิ่มตัวอย่าง</Button>}>
        จัดการตัวอย่างเอกสาร
      </PageTitle>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      {form && (
        <Card className="space-y-4 border-brand-500">
          <h2 className="font-semibold">{form.sample_id ? "แก้ไขตัวอย่าง" : "เพิ่มตัวอย่าง"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ประเภทเอกสาร">
              <Select value={form.document_type} onChange={(e) => setForm({ ...form, document_type: e.target.value })}>
                {document_types.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="ไฟล์ตัวอย่าง (JPG, PNG, PDF)">
              <Input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
            </Field>
          </div>
          <Field label="คำอธิบาย">
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">องค์ประกอบที่เอกสารต้องมี (ใช้เป็นเกณฑ์ตรวจอัตโนมัติ)</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {elements.map((el) => (
                <label key={el.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.required_elements.includes(el.key)} onChange={() => toggle(el.key)} />
                  {el.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>บันทึก</Button>
            <Button variant="ghost" onClick={() => setForm(null)}>
              ยกเลิก
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {samples.map((s) => (
          <Card key={s.sample_id} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{typeLabel(s.document_type)}</h3>
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setForm({
                      sample_id: s.sample_id,
                      document_type: s.document_type,
                      description: s.description ?? "",
                      required_elements: s.required_elements,
                      file: null,
                    })
                  }
                >
                  แก้ไข
                </Button>
                <Button variant="ghost" onClick={() => remove(s)}>
                  ลบ
                </Button>
              </div>
            </div>
            <p className="text-sm text-slate-600">{s.description}</p>
            <p className="text-xs text-slate-500">{s.required_elements.map(elementLabel).join(" · ")}</p>
            <p className="text-xs text-slate-400">{s.file ? "มีไฟล์ตัวอย่าง" : "ยังไม่มีไฟล์ตัวอย่าง"}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RequireRole roles={["staff"]}>
      <ManageSamples />
    </RequireRole>
  );
}
