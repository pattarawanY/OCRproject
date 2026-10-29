import type { RequestStatus, Role } from "./types";

export const STATUS_LABEL: Record<RequestStatus, string> = {
  draft: "ฉบับร่าง",
  pending_approval: "รออนุมัติ",
  rejected: "ไม่อนุมัติ",
  approved: "อนุมัติแล้ว (รอส่งใบเสร็จ)",
  receipt_submitted: "รอตรวจสอบใบเสร็จ",
  receipt_rejected: "ใบเสร็จไม่ผ่าน",
  completed: "เสร็จสิ้น",
};

export const STATUS_COLOR: Record<RequestStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  pending_approval: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-700",
  approved: "bg-sky-100 text-sky-800",
  receipt_submitted: "bg-violet-100 text-violet-800",
  receipt_rejected: "bg-red-100 text-red-700",
  completed: "bg-emerald-100 text-emerald-800",
};

export const ROLE_LABEL: Record<Role, string> = {
  teacher: "อาจารย์",
  staff: "เจ้าหน้าที่",
  admin: "ผู้ดูแลระบบ",
};

export const ROLE_HOME: Record<Role, string> = {
  teacher: "/teacher",
  staff: "/staff",
  admin: "/admin",
};

export const ACTIVITY_TYPES = ["อบรม/สัมมนา", "ประชุมวิชาการ", "นำเสนอผลงานวิจัย", "ดูงาน", "อื่น ๆ"];

export const EXPENSE_CATEGORIES = ["ค่าเดินทาง", "ค่าที่พัก", "ค่าเบี้ยเลี้ยง", "ค่าลงทะเบียน"];

export const CONTINENTS = [
  { key: "Asia", label: "เอเชีย" },
  { key: "Europe", label: "ยุโรป" },
  { key: "America", label: "อเมริกา" },
];

export function formatMoney(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return "-";
  return Number(v).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(v: string | null | undefined, withTime = false) {
  if (!v) return "-";
  const d = new Date(v);
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
