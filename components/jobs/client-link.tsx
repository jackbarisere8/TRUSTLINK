"use client";
import { startTransition, useEffect, useState } from "react";
export function ClientLink({ publicId }: { publicId: string }) {
  const [message,setMessage] = useState("");
  useEffect(() => {
    function claim() {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("invite");
      if (!token) return;
      const cleanUrl = window.location.pathname + window.location.search;
      // Remove the capability before awaiting the exchange; this also prevents duplicate mount effects.
      window.history.replaceState(window.history.state,"",cleanUrl);
      startTransition(async () => {
        try {
          const response = await fetch("/api/client-capability/" + publicId, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) setMessage(result.error || "This participant link is invalid or expired. Ask the provider for a new link.");
          else window.location.replace(cleanUrl);
        } catch {
          setMessage("We couldn't open participant access. Reopen your original link to try again.");
        }
      });
    }
    claim();
    window.addEventListener("hashchange",claim);
    return () => window.removeEventListener("hashchange",claim);
  }, [publicId]);
  return message ? <p role="status" className="notice mb-5">{message}</p> : null;
}
