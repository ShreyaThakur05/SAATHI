"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ProfileView } from "@/components/ProfileView";
import { ErrorState, Skeleton } from "@/components/ui/primitives";
import { useStaff, useStaffQuery } from "@/lib/auth";

export default function Merchant360() {
  const { id } = useParams<{ id: string }>();
  const mid = Number(id);
  const { api } = useStaff();
  const q = useStaffQuery(["merchant-360", mid], () => api.merchantProfile(mid), { refetchInterval: 8000, enabled: Number.isInteger(mid) && mid > 0 });
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/console/merchants" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All merchants
      </Link>
      {q.isPending ? <Skeleton className="h-96" /> : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : (
        <ProfileView profile={q.data} diagnosticsKey={(d) => ["staff-diag", mid, d]} diagnostics={(d) => api.merchantDiagnostics(mid, d)} />
      )}
    </div>
  );
}
