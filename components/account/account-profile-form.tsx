"use client";

import { useState, useTransition } from "react";
import { updateAccountAction } from "@/app/actions/account";
import type { AccountProfileInput } from "@/lib/db/repository";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AccountProfileForm({ initial }: { initial: AccountProfileInput }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <form className="max-w-xl space-y-5" onSubmit={event => {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        const result = await updateAccountAction(input);
        if (result.error) setError(result.error);
        else setMessage(result.message || "Account details saved.");
      } catch {
        setError("Connection interrupted. Please try again.");
      }
    });
  }}>
    <Input name="displayName" label="Full name or business name" defaultValue={initial.displayName} maxLength={120} required />
    <Input name="country" label="Country" defaultValue={initial.country} maxLength={80} required />
    <Input name="state" label="State / region" defaultValue={initial.state} maxLength={100} />
    <Input name="city" label="City" defaultValue={initial.city} maxLength={100} />
    {message && <p className="notice" role="status">{message}</p>}
    {error && <p className="p-3 bg-danger-light border border-red-200 text-xs font-medium text-danger-text" role="alert">{error}</p>}
    <Button type="submit" loading={pending}>Save account details</Button>
  </form>;
}
