"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveProviderServiceAction, setProviderPublicationAction } from "@/app/actions/provider-marketplace";
import { Button } from "@/components/ui/button";

export function PublicationControl({ published, canPublish }: { published: boolean; canPublish: boolean }) {
  const router = useRouter();
  const [error,setError] = useState("");
  const [pending,startTransition] = useTransition();
  return <div className="space-y-3">
    <Button type="button" variant={published ? "outline" : "primary"} disabled={!published && !canPublish} loading={pending} onClick={() => {
      setError("");
      startTransition(async () => {
        try {
          const result = await setProviderPublicationAction(!published);
          if (result.error) { setError(result.error); return; }
          router.refresh();
        } catch { setError("Connection interrupted. Please try again."); }
      });
    }}>{published ? "Unpublish marketplace profile" : "Publish marketplace profile"}</Button>
    {!published && !canPublish && <p className="text-xs leading-5 text-surface-600">Create and activate at least one complete service before publishing.</p>}
    {error && <p className="text-xs font-medium text-danger" role="alert">{error}</p>}
  </div>;
}

export function ArchiveServiceButton({ serviceId }: { serviceId: string }) {
  const router = useRouter();
  const [error,setError] = useState("");
  const [pending,startTransition] = useTransition();
  return <div className="space-y-2"><Button type="button" variant="ghost" size="sm" loading={pending} onClick={() => {
    setError("");
    startTransition(async () => {
      try {
        const result = await archiveProviderServiceAction(serviceId);
        if (result.error) { setError(result.error); return; }
        router.refresh();
      } catch { setError("Connection interrupted. Please try again."); }
    });
  }}>Archive</Button>{error && <p className="text-xs font-medium text-danger" role="alert">{error}</p>}</div>;
}
