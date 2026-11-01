import type { NextConfig } from "next";

// หน้าเว็บเรียก /api ที่โดเมนเดียวกัน แล้ว Next.js ส่งต่อไปยัง backend
// ทำให้เปิดผ่านลิงก์เดียวได้ (เช่น Cloudflare Tunnel บนมือถือ) — ค่านี้ถูกอ่านตอน build
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
