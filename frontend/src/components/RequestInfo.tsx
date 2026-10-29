"use client";

import { STATUS_LABEL, formatDate, formatMoney } from "@/lib/constants";
import type { TravelRequest } from "@/lib/types";
import { AuthFile } from "./AuthFile";
import { StatusBadge, StatusProgress } from "./Status";
import { Card } from "./ui";

export function RequestInfo({ req }: { req: TravelRequest }) {
  const reimburse = req.request_type === "reimburse";
  return (
    <div className="space-y-4">
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold">
              #{req.request_id} {req.event_name}
            </h2>
            <p className="text-sm text-slate-500">
              ผู้ยื่น: {req.user.full_name} ({req.user.email})
            </p>
          </div>
          <StatusBadge status={req.status} />
        </div>
        <StatusProgress status={req.status} reimburse={reimburse} />
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row k="ประเภทคำขอ" v={reimburse ? "เบิกค่าใช้จ่าย" : "ไม่เบิกค่าใช้จ่าย"} />
          <Row k="ประเภทกิจกรรม" v={req.activity_type} />
          <Row k="สถานที่" v={req.location} />
          <Row k="วันที่" v={`${formatDate(req.start_date)} – ${formatDate(req.end_date)}`} />
          <Row k="ยื่นคำขอเมื่อ" v={formatDate(req.submitted_at, true)} />
          <Row k="อนุมัติเมื่อ" v={formatDate(req.approved_at, true)} />
          {req.event_url && (
            <Row
              k="ลิงก์การจัดงาน"
              v={
                <a href={req.event_url} target="_blank" rel="noreferrer" className="text-brand-600 underline">
                  {req.event_url}
                </a>
              }
            />
          )}
        </dl>
        {req.attachment_file && (
          <div>
            <p className="mb-1 text-sm font-medium text-slate-600">เอกสารประกอบ</p>
            <AuthFile path={req.attachment_file} className="max-h-60 rounded border" />
          </div>
        )}
      </Card>

      {reimburse && (
        <Card>
          <h3 className="mb-3 font-semibold">รายการค่าใช้จ่าย</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="p-2">ประเภท</th>
                  <th className="p-2">รายละเอียด</th>
                  <th className="p-2 text-right">ประมาณการ</th>
                  <th className="p-2 text-right">ยอดจริง</th>
                </tr>
              </thead>
              <tbody>
                {req.expense_items.map((e) => (
                  <tr key={e.item_id} className="border-t">
                    <td className="p-2">{e.category}</td>
                    <td className="p-2">{e.description || "-"}</td>
                    <td className="p-2 text-right">{formatMoney(e.estimated_amount)}</td>
                    <td className="p-2 text-right">{formatMoney(e.actual_amount)}</td>
                  </tr>
                ))}
                <tr className="border-t font-semibold">
                  <td className="p-2" colSpan={2}>
                    รวม (บาท)
                  </td>
                  <td className="p-2 text-right">{formatMoney(req.estimated_amount)}</td>
                  <td className="p-2 text-right">{formatMoney(req.actual_amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(req.trips.length > 0 || req.hotel_stays.length > 0) && (
        <Card className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 font-semibold">การเดินทาง</h3>
            {req.trips.length ? (
              req.trips.map((t) => (
                <p key={t.trip_id} className="text-sm">
                  ✈ {t.airline} {t.flight_number} · {t.departure_location} → {t.arrival_location}{" "}
                  <span className="text-slate-500">{formatDate(t.departure_datetime, true)}</span>
                </p>
              ))
            ) : (
              <p className="text-sm text-slate-500">-</p>
            )}
          </div>
          <div>
            <h3 className="mb-2 font-semibold">การเข้าพัก</h3>
            {req.hotel_stays.length ? (
              req.hotel_stays.map((h) => (
                <p key={h.stay_id} className="text-sm">
                  🏨 {h.hotel_name} · {h.city}, {h.country}{" "}
                  <span className="text-slate-500">
                    {formatDate(h.check_in_date)} – {formatDate(h.check_out_date)}
                  </span>
                </p>
              ))
            ) : (
              <p className="text-sm text-slate-500">-</p>
            )}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="mb-3 font-semibold">ประวัติสถานะ</h3>
        <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
          {req.history.map((h) => (
            <li key={h.history_id} className="text-sm">
              <span className="font-medium">{STATUS_LABEL[h.status]}</span>{" "}
              <span className="text-slate-500">{formatDate(h.changed_at, true)}</span>
              {h.note && <p className="text-slate-600">{h.note}</p>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2 border-b border-slate-100 py-1">
      <dt className="w-32 shrink-0 text-slate-500">{k}</dt>
      <dd className="break-all">{v}</dd>
    </div>
  );
}
