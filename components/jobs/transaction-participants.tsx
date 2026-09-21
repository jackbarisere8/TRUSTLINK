import type { ParticipantDetailStatus } from "@/lib/db/types";
import type { TransactionParticipant } from "@/lib/domain/jobs";

function statusLabel(participant: TransactionParticipant) {
  const labels: Record<ParticipantDetailStatus, string> = {
    SELF_PROVIDED: participant.participantType === "PROVIDER" ? "Self-provided profile details" : "Self-provided contact details",
    EMAIL_VERIFIED: "Email address verified",
    OTHER_VERIFIED: "Other verification recorded",
    UNKNOWN: "No participant detail status recorded",
  };
  return labels[participant.detailStatus];
}

export function TransactionParticipants({ participants }: { participants: TransactionParticipant[] }) {
  return <section className="border-t border-surface-200 pt-7 mt-7" aria-labelledby="transaction-participants-heading">
    <h2 id="transaction-participants-heading" className="text-lg font-semibold">Participants</h2>
    <p className="text-xs leading-6 text-surface-500 mt-2">These statuses describe how participant details were supplied or confirmed. They are not proof of legal identity.</p>
    <div className="divide-y divide-surface-200 mt-5 border-y border-surface-200">
      {participants.map(participant => <article key={participant.participantType} className="py-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="field-label">{participant.participantType === "PROVIDER" ? "Provider" : "Client participant"}</p>
          <h3 className="font-medium break-words">{participant.displayName}</h3>
          <p className="text-xs text-surface-500 mt-1">{participant.accountAssociation === "GUEST" ? "Guest participant" : "TrustLink account"}</p>
        </div>
        <div className="text-sm sm:text-right min-w-0">
          <p className="font-medium">{statusLabel(participant)}</p>
          {participant.email && <p className="text-surface-600 break-all mt-1">{participant.email}</p>}
          {participant.phone && <p className="text-surface-600 break-all mt-1">{participant.phone}</p>}
        </div>
      </article>)}
    </div>
  </section>;
}
