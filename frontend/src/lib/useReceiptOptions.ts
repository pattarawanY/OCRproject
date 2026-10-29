"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import type { Option } from "./types";

/** ประเภทเอกสารและองค์ประกอบที่ระบบตรวจได้ (ใช้แสดงชื่อภาษาไทย) */
export function useReceiptOptions() {
  const [opts, setOpts] = useState<{ document_types: Option[]; elements: Option[] }>({
    document_types: [],
    elements: [],
  });
  useEffect(() => {
    api<typeof opts>("/receipts/meta/options", { auth: false }).then(setOpts).catch(() => {});
  }, []);
  const label = (list: Option[], key: string) => list.find((o) => o.key === key)?.label ?? key;
  return {
    ...opts,
    typeLabel: (k: string) => label(opts.document_types, k),
    elementLabel: (k: string) => label(opts.elements, k),
  };
}
