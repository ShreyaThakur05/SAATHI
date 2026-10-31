import { Suspense } from "react";
import { MerchantShell } from "@/components/MerchantShell";
import { Skeleton } from "@/components/ui/primitives";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-8 w-48" /></div>}>
      <MerchantShell>{children}</MerchantShell>
    </Suspense>
  );
}
