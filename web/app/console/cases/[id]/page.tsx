"use client";

import { useParams } from "next/navigation";
import { CaseView } from "@/components/CaseView";

export default function CasePage() {
  const { id } = useParams<{ id: string }>();
  const caseId = Number(id);
  if (!Number.isInteger(caseId) || caseId < 1) return <p className="text-sm text-muted">That case id is not valid.</p>;
  return (
    <div className="mx-auto max-w-6xl">
      <CaseView caseId={caseId} />
    </div>
  );
}
