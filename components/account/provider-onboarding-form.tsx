"use client";

import { useState, useTransition } from "react";
import { enableProviderAction } from "@/app/actions/account";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ProviderOnboardingForm() {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <form className="max-w-xl space-y-5" onSubmit={event => {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    setError("");
    startTransition(async () => {
      try {
        const result = await enableProviderAction(input);
        if (result?.error) setError(result.error);
      } catch {
        setError("Connection interrupted. Please try again.");
      }
    });
  }}>
    <Input name="headline" label="Professional headline" placeholder="Website developer, auto mechanic, photographer" maxLength={160} required />
    <Input name="serviceArea" label="Service area" placeholder="Ikeja, Lagos or Remote across Nigeria" maxLength={160} hint="Use a broad area only. You can add detailed service coverage later." required />
    <p className="text-xs leading-6 text-surface-600">Your provider profile starts as a private draft. It will not appear in marketplace search until you complete the later service setup and publication steps.</p>
    {error && <p className="p-3 bg-danger-light border border-red-200 text-xs font-medium text-danger-text" role="alert">{error}</p>}
    <Button type="submit" loading={pending}>Enable provider workspace</Button>
  </form>;
}
