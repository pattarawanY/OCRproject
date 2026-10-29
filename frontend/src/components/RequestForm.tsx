"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, stashWarnings } from "@/lib/api";
import { ACTIVITY_TYPES, EXPENSE_CATEGORIES, formatMoney } from "@/lib/constants";
import type { Airline, Hotel, HotelStay, RequestActionResult, TravelRequest, Trip } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Select } from "./ui";

interface ExpenseRow {
  category: string;
  description: string;
  estimated_amount: string;
}

const emptyTrip: Trip = {
  flight_number: "",
  airline: "",
  airline_id: null,
  departure_location: "",
  departure_datetime: null,
  arrival_location: "",
  arrival_datetime: null,
};
const emptyStay: HotelStay = {
  hotel_id: null,
  hotel_name: "",
  city: "",
  country: "",
  check_in_date: null,
  check_out_date: null,
};

const blankToNull = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === "" ? null : v])) as T;

export function RequestForm({ initial }: { initial?: TravelRequest }) {
  const router = useRouter();
  const [form, setForm] = useState({
    request_type: initial?.request_type ?? "reimburse",
    activity_type: initial?.activity_type ?? ACTIVITY_TYPES[0],
    event_name: initial?.event_name ?? "",
    location: initial?.location ?? "",
    start_date: initial?.start_date ?? "",
    end_date: initial?.end_date ?? "",
    event_url: initial?.event_url ?? "",
  });
  const [expenses, setExpenses] = useState<ExpenseRow[]>(
    initial?.expense_items.map((e) => ({
      category: e.category,
      description: e.description ?? "",
      estimated_amount: e.estimated_amount,
    })) ?? EXPENSE_CATEGORIES.map((c) => ({ category: c, description: "", estimated_amount: "" })),
  );
  const [trips, setTrips] = useState<Trip[]>(initial?.trips ?? []);
  const [stays, setStays] = useState<HotelStay[]>(initial?.hotel_stays ?? []);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [airlines, setAirlines] = useState<Airline[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Airline[]>("/recommendations/airlines", { auth: false }).then(setAirlines).catch(() => {});
    api<Hotel[]>("/recommendations/hotels", { auth: false }).then(setHotels).catch(() => {});
  }, []);

  const reimburse = form.request_type === "reimburse";
  const total = expenses.reduce((s, e) => s + (Number(e.estimated_amount) || 0), 0);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const save = async (submit: boolean) => {
    setError("");
    if (!form.event_name || !form.location || !form.start_date || !form.end_date) {
      setError("กรุณากรอกข้อมูลที่จำเป็นให้ครบ: ชื่องาน สถานที่ วันที่เริ่มต้นและวันที่สิ้นสุด");
      return;
    }
    if (form.end_date < form.start_date) {
      setError("วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มต้น");
      return;
    }
    setBusy(true);
    const body = {
      ...form,
      event_url: form.event_url || null,
      expense_items: reimburse
        ? expenses
            .filter((e) => Number(e.estimated_amount) > 0)
            .map((e) => ({ ...e, estimated_amount: Number(e.estimated_amount) }))
        : [],
      trips: trips.map((t) => blankToNull({ ...t, trip_id: undefined })),
      hotel_stays: stays.map((s) => blankToNull({ ...s, stay_id: undefined })),
      submit,
    };
    try {
      const res = initial
        ? await api<RequestActionResult>(`/requests/${initial.request_id}`, { method: "PUT", body })
        : await api<RequestActionResult>("/requests", { method: "POST", body });
      if (attachment) {
        const fd = new FormData();
        fd.append("file", attachment);
        await api(`/requests/${res.request.request_id}/attachment`, { method: "POST", body: fd });
      }
      stashWarnings(res.request.request_id, res.warnings);
      router.push(`/teacher/requests/${res.request.request_id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && <Alert kind="error">{error}</Alert>}

      <Card className="grid gap-4 sm:grid-cols-2">
        <Field label="ประเภทคำขอ">
          <Select value={form.request_type} onChange={set("request_type")}>
            <option value="reimburse">เบิกค่าใช้จ่าย</option>
            <option value="no_reimburse">ไม่เบิกค่าใช้จ่าย (อนุมัติตัวอย่างเดียว)</option>
          </Select>
        </Field>
        <Field label="ประเภทกิจกรรม">
          <Select value={form.activity_type} onChange={set("activity_type")}>
            {ACTIVITY_TYPES.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
        <Field label="ชื่องาน / โครงการ *">
          <Input value={form.event_name} onChange={set("event_name")} />
        </Field>
        <Field label="สถานที่ *">
          <Input value={form.location} onChange={set("location")} />
        </Field>
        <Field label="วันที่เริ่มต้น *">
          <Input type="date" value={form.start_date} onChange={set("start_date")} />
        </Field>
        <Field label="วันที่สิ้นสุด *">
          <Input type="date" value={form.end_date} onChange={set("end_date")} />
        </Field>
        <Field label="ลิงก์การจัดงาน">
          <Input value={form.event_url} onChange={set("event_url")} placeholder="https://" />
        </Field>
        <Field label="เอกสารประกอบ (กำหนดการ/หนังสือเชิญ)" hint={initial?.attachment_file ? "มีไฟล์แนบแล้ว — เลือกใหม่เพื่อแทนที่" : "JPG, PNG หรือ PDF"}>
          <Input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => setAttachment(e.target.files?.[0] ?? null)} />
        </Field>
      </Card>

      {reimburse && (
        <Card className="space-y-3">
          <h2 className="font-semibold">ประมาณการค่าใช้จ่าย</h2>
          {expenses.map((e, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <Select
                className="col-span-4 sm:col-span-3"
                value={e.category}
                onChange={(ev) => setExpenses(expenses.map((x, j) => (j === i ? { ...x, category: ev.target.value } : x)))}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <Input
                className="col-span-8 sm:col-span-5"
                placeholder="รายละเอียด"
                value={e.description}
                onChange={(ev) => setExpenses(expenses.map((x, j) => (j === i ? { ...x, description: ev.target.value } : x)))}
              />
              <Input
                className="col-span-9 sm:col-span-3"
                type="number"
                min="0"
                placeholder="บาท"
                value={e.estimated_amount}
                onChange={(ev) =>
                  setExpenses(expenses.map((x, j) => (j === i ? { ...x, estimated_amount: ev.target.value } : x)))
                }
              />
              <Button variant="ghost" className="col-span-3 sm:col-span-1" onClick={() => setExpenses(expenses.filter((_, j) => j !== i))}>
                ✕
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={() => setExpenses([...expenses, { category: EXPENSE_CATEGORIES[0], description: "", estimated_amount: "" }])}>
              + เพิ่มรายการ
            </Button>
            <p className="font-semibold">รวม {formatMoney(total)} บาท</p>
          </div>
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">ข้อมูลการเดินทาง (เที่ยวบิน)</h2>
          <Button variant="secondary" onClick={() => setTrips([...trips, { ...emptyTrip }])}>
            + เพิ่มเที่ยวบิน
          </Button>
        </div>
        {trips.map((t, i) => {
          const upd = (patch: Partial<Trip>) => setTrips(trips.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <div key={i} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-4">
              <Select
                value={t.airline_id ?? ""}
                onChange={(e) => {
                  const a = airlines.find((x) => x.airline_id === Number(e.target.value));
                  upd({ airline_id: a?.airline_id ?? null, airline: a?.name ?? t.airline });
                }}
              >
                <option value="">— สายการบินแนะนำ —</option>
                {airlines.map((a) => (
                  <option key={a.airline_id} value={a.airline_id}>
                    {a.name}
                  </option>
                ))}
              </Select>
              <Input placeholder="สายการบิน" value={t.airline ?? ""} onChange={(e) => upd({ airline: e.target.value, airline_id: null })} />
              <Input placeholder="เลขเที่ยวบิน" value={t.flight_number ?? ""} onChange={(e) => upd({ flight_number: e.target.value })} />
              <Button variant="ghost" onClick={() => setTrips(trips.filter((_, j) => j !== i))}>
                ลบ
              </Button>
              <Input placeholder="ต้นทาง" value={t.departure_location ?? ""} onChange={(e) => upd({ departure_location: e.target.value })} />
              <Input type="datetime-local" value={t.departure_datetime?.slice(0, 16) ?? ""} onChange={(e) => upd({ departure_datetime: e.target.value || null })} />
              <Input placeholder="ปลายทาง" value={t.arrival_location ?? ""} onChange={(e) => upd({ arrival_location: e.target.value })} />
              <Input type="datetime-local" value={t.arrival_datetime?.slice(0, 16) ?? ""} onChange={(e) => upd({ arrival_datetime: e.target.value || null })} />
            </div>
          );
        })}
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">ข้อมูลการเข้าพัก</h2>
          <Button variant="secondary" onClick={() => setStays([...stays, { ...emptyStay }])}>
            + เพิ่มที่พัก
          </Button>
        </div>
        {stays.map((s, i) => {
          const upd = (patch: Partial<HotelStay>) => setStays(stays.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <div key={i} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-4">
              <Select
                value={s.hotel_id ?? ""}
                onChange={(e) => {
                  const h = hotels.find((x) => x.hotel_id === Number(e.target.value));
                  upd(h ? { hotel_id: h.hotel_id, hotel_name: h.name, city: h.city, country: h.country } : { hotel_id: null });
                }}
              >
                <option value="">— โรงแรมแนะนำ —</option>
                {hotels.map((h) => (
                  <option key={h.hotel_id} value={h.hotel_id}>
                    {h.name}
                  </option>
                ))}
              </Select>
              <Input placeholder="ชื่อโรงแรม" value={s.hotel_name ?? ""} onChange={(e) => upd({ hotel_name: e.target.value, hotel_id: null })} />
              <Input placeholder="เมือง" value={s.city ?? ""} onChange={(e) => upd({ city: e.target.value })} />
              <Input placeholder="ประเทศ" value={s.country ?? ""} onChange={(e) => upd({ country: e.target.value })} />
              <Field label="เช็กอิน">
                <Input type="date" value={s.check_in_date ?? ""} onChange={(e) => upd({ check_in_date: e.target.value || null })} />
              </Field>
              <Field label="เช็กเอาต์">
                <Input type="date" value={s.check_out_date ?? ""} onChange={(e) => upd({ check_out_date: e.target.value || null })} />
              </Field>
              <div className="flex items-end">
                <Button variant="ghost" onClick={() => setStays(stays.filter((_, j) => j !== i))}>
                  ลบ
                </Button>
              </div>
            </div>
          );
        })}
      </Card>

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={() => router.back()} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="secondary" onClick={() => save(false)} disabled={busy}>
          บันทึกฉบับร่าง
        </Button>
        <Button onClick={() => save(true)} disabled={busy}>
          ยื่นคำขอ
        </Button>
      </div>
    </div>
  );
}
