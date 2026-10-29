import { STATUS_COLOR, STATUS_LABEL } from "@/lib/constants";
import type { RequestStatus } from "@/lib/types";
import { cn } from "./ui";

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_COLOR[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const STEPS_REIMBURSE: { key: RequestStatus; label: string }[] = [
  { key: "draft", label: "ฉบับร่าง" },
  { key: "pending_approval", label: "รออนุมัติ" },
  { key: "approved", label: "อนุมัติแล้ว" },
  { key: "receipt_submitted", label: "รอตรวจใบเสร็จ" },
  { key: "completed", label: "เสร็จสิ้น" },
];

const STEPS_NO_REIMBURSE = [STEPS_REIMBURSE[0], STEPS_REIMBURSE[1], STEPS_REIMBURSE[4]];

/** แถบความคืบหน้า (Progress bar) ของคำขอ — สถานะไม่อนุมัติ/ใบเสร็จไม่ผ่านแสดงเป็นขั้นที่ติดปัญหา */
export function StatusProgress({ status, reimburse = true }: { status: RequestStatus; reimburse?: boolean }) {
  const steps = reimburse ? STEPS_REIMBURSE : STEPS_NO_REIMBURSE;
  const errorAt: Partial<Record<RequestStatus, RequestStatus>> = {
    rejected: "pending_approval",
    receipt_rejected: "receipt_submitted",
  };
  const current = errorAt[status] ?? status;
  const idx = steps.findIndex((s) => s.key === current);
  const isError = status in errorAt;

  return (
    <div className="flex w-full items-start">
      {steps.map((s, i) => {
        const done = i < idx || (i === idx && status === "completed");
        const active = i === idx && status !== "completed";
        return (
          <div key={s.key} className="flex flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={cn("h-1 flex-1", i === 0 ? "invisible" : i <= idx ? "bg-brand-500" : "bg-slate-200")} />
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  done && "bg-brand-600 text-white",
                  active && !isError && "bg-amber-400 text-white ring-4 ring-amber-100",
                  active && isError && "bg-red-500 text-white ring-4 ring-red-100",
                  !done && !active && "bg-slate-200 text-slate-500",
                )}
              >
                {done ? "✓" : active && isError ? "!" : i + 1}
              </div>
              <div
                className={cn("h-1 flex-1", i === steps.length - 1 ? "invisible" : i < idx ? "bg-brand-500" : "bg-slate-200")}
              />
            </div>
            <span className={cn("mt-1 text-[11px] leading-tight sm:text-xs", active ? "font-semibold" : "text-slate-500")}>
              {active && isError ? STATUS_LABEL[status] : s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
