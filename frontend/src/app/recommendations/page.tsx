"use client";

import { useEffect, useState } from "react";
import { Alert, Card, Empty, PageTitle, cn } from "@/components/ui";
import { api } from "@/lib/api";
import { CONTINENTS } from "@/lib/constants";
import type { Airline, Hotel } from "@/lib/types";

export default function RecommendationsPage() {
  const [continent, setContinent] = useState("Asia");
  const [kind, setKind] = useState<"hotels" | "airlines">("hotels");
  const [items, setItems] = useState<(Hotel | Airline)[] | null>(null);
  const [selected, setSelected] = useState<Hotel | Airline | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(null);
    setSelected(null);
    setError("");
    api<(Hotel | Airline)[]>(`/recommendations/${kind}?continent=${continent}`, { auth: false })
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [continent, kind]);

  const tab = (active: boolean) =>
    cn("rounded-lg px-4 py-2 text-sm font-semibold", active ? "bg-brand-600 text-white" : "bg-white border text-slate-600");

  return (
    <div className="space-y-6">
      <PageTitle>ค้นหาโรงแรมและสายการบินที่แนะนำ</PageTitle>
      <div className="flex flex-wrap gap-2">
        {CONTINENTS.map((c) => (
          <button key={c.key} className={tab(continent === c.key)} onClick={() => setContinent(c.key)}>
            {c.label}
          </button>
        ))}
        <span className="mx-2 border-l" />
        <button className={tab(kind === "hotels")} onClick={() => setKind("hotels")}>
          🏨 โรงแรม
        </button>
        <button className={tab(kind === "airlines")} onClick={() => setKind("airlines")}>
          ✈ สายการบิน
        </button>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {items && !items.length && <Empty>ไม่พบข้อมูล</Empty>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items?.map((it) => {
          const id = "hotel_id" in it ? it.hotel_id : it.airline_id;
          return (
            <button key={id} onClick={() => setSelected(it)} className="text-left">
              <Card className={cn("h-full transition hover:border-brand-500", selected === it && "border-brand-500")}>
                <h3 className="font-semibold">
                  {it.name} {"code" in it && it.code && <span className="text-slate-400">({it.code})</span>}
                </h3>
                <p className="text-sm text-slate-500">
                  {"city" in it ? `${it.city}, ` : ""}
                  {it.country}
                </p>
                {selected === it && it.notes && <p className="mt-2 text-sm text-slate-700">{it.notes}</p>}
              </Card>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        ข้อมูลเป็นข้อมูลเบื้องต้นสำหรับประกอบการวางแผนเท่านั้น ไม่รวมการจองหรือชำระเงินผ่านระบบ
      </p>
    </div>
  );
}
