import { Suspense } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { Skeleton } from "@/components/ui/primitives";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <Skeleton className="h-8 w-48" />
        </div>
      }
    >
      <ConsoleShell>{children}</ConsoleShell>
    </Suspense>
  );
}
