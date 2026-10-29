"use client";

import { RequireRole } from "@/components/AuthProvider";
import { RequestForm } from "@/components/RequestForm";
import { PageTitle } from "@/components/ui";

export default function NewRequestPage() {
  return (
    <RequireRole roles={["teacher"]}>
      <PageTitle>ยื่นคำขออนุมัติไปราชการ</PageTitle>
      <RequestForm />
    </RequireRole>
  );
}
