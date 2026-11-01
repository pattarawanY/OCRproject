"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { OCRImageOverlay } from "@/components/OCRImageOverlay";
import { OCRResult } from "@/components/OCRResult";
import { Alert, Button, Card, Field, PageTitle, Select } from "@/components/ui";
import { API_URL, api } from "@/lib/api";
import type { OCRCheckResult, RequestSummary } from "@/lib/types";

/** สแกนใบเสร็จแบบ live-check: ใช้กล้องหรือเลือกไฟล์ ไม่ต้องเข้าสู่ระบบ */
export default function ScanPage() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OCRCheckResult | null>(null);
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [targetId, setTargetId] = useState("");
  const [uploaded, setUploaded] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const isTeacher = user?.role === "teacher";

  useEffect(() => {
    if (!isTeacher) return;
    api<RequestSummary[]>("/requests?status=approved,receipt_rejected")
      .then((r) => {
        setRequests(r);
        if (r[0]) setTargetId(String(r[0].request_id));
      })
      .catch(() => setRequests([]));
  }, [isTeacher]);

  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setError("ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้กล้อง หรือเลือกไฟล์ภาพแทน");
    }
  };

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  const check = async (file: Blob, name: string) => {
    setBusy(true);
    setError("");
    setResult(null);
    setUploaded(false);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    });
    const fd = new FormData();
    fd.append("file", file, name);
    try {
      setResult(await api<OCRCheckResult>("/receipts/live-check", { method: "POST", body: fd }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((b) => b && check(b, "capture.jpg"), "image/jpeg", 0.92);
    stopCamera();
  };

  const attach = async () => {
    if (!result || !targetId) return;
    setBusy(true);
    try {
      await api(`/receipts/${result.receipt.receipt_id}/attach`, {
        method: "POST",
        body: { request_id: Number(targetId) },
      });
      setUploaded(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle>สแกนใบเสร็จ</PageTitle>

      <Card className="space-y-4">
        {cameraOn ? (
          <div className="space-y-3">
            <video ref={videoRef} autoPlay playsInline className="w-full max-w-xl rounded-lg bg-black" />
            <div className="flex gap-2">
              <Button onClick={capture}>📸 ถ่ายภาพ</Button>
              <Button variant="secondary" onClick={stopCamera}>
                ปิดกล้อง
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button onClick={startCamera} disabled={busy}>
              📷 เปิดกล้อง
            </Button>
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              📁 เลือกไฟล์
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) check(f, f.name);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        )}
        {busy && <p className="text-sm text-slate-500">กำลังตรวจสอบ...</p>}
        {error && <Alert kind="error">{error}</Alert>}
      </Card>

      {result && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">ผลการตรวจสอบ</h2>
            <Button variant="ghost" onClick={() => setResult(null)}>
              ✕ ปิดเพื่อสแกนใหม่
            </Button>
          </div>
          {(result.receipt.ocr_data.demo_image || preview) && (
            <OCRImageOverlay
              src={
                result.receipt.ocr_data.demo_image
                  ? `${API_URL}/api/receipts/demo-image/${result.receipt.ocr_data.demo_image}`
                  : preview!
              }
              words={result.receipt.ocr_data.words ?? []}
            />
          )}
          <OCRResult result={result} />

          {isTeacher && !uploaded && requests.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <>
                  <Field label="อัปโหลดเข้าคำขอ">
                    <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                      {requests.map((r) => (
                        <option key={r.request_id} value={r.request_id}>
                          #{r.request_id} {r.event_name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button onClick={attach} disabled={busy}>
                    ⬆ อัปโหลดใบเสร็จ
                  </Button>
              </>
            </div>
          )}
          {uploaded && <Alert kind="success">อัปโหลดสำเร็จ</Alert>}
        </Card>
      )}
    </div>
  );
}
