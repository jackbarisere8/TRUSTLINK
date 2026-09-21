"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { claimClientLinkAction } from "@/app/actions/jobs";
export function ClientLink({ publicId }: { publicId: string }) {
  const [message,setMessage] = useState("");
  const router = useRouter();
  useEffect(() => {
    function claim() {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("invite");
      if (!token) return;
      // Remove the capability before awaiting the exchange; this also prevents duplicate mount effects.
      window.history.replaceState(window.history.state,"",window.location.pathname + window.location.search);
      claimClientLinkAction(publicId,token).then(result => {
        if (!result.success) setMessage(result.error);
        else { setMessage("Participant access enabled on this browser."); router.refresh(); }
      }).catch(() => setMessage("We couldn't open participant access. Reopen your original link to try again."));
    }
    claim();
    window.addEventListener("hashchange",claim);
    return () => window.removeEventListener("hashchange",claim);
  }, [publicId,router]);
  return message ? <p role="status" className="notice mb-5">{message}</p> : null;
}
