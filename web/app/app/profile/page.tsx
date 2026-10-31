"use client";

import { PageHeader } from "@/components/MerchantBits";
import { ProfileView } from "@/components/ProfileView";
import { ErrorState, Skeleton } from "@/components/ui/primitives";
import { useMerchant, useMerchantQuery } from "@/lib/merchantAuth";

export default function Profile() {
  const { api, token } = useMerchant();
  const q = useMerchantQuery(["profile"], (a) => a.profile(), { refetchInterval: 8000 });
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Profile" subtitle="Your business, where it is, how your devices are connected, and your history." />
      {q.isPending ? <Skeleton className="h-96" /> : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : (
        <ProfileView profile={q.data} diagnosticsKey={(id) => ["m", token, "diag", id]} diagnostics={(id) => api!.diagnostics(id)} />
      )}
    </div>
  );
}
