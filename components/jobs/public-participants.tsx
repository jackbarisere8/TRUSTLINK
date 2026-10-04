export function PublicParticipants({ providerName, accepted }: { providerName: string; accepted: boolean }) {
  return <section className="record-section" aria-labelledby="public-participants-heading">
    <h2 id="public-participants-heading">Participants</h2>
    <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
      <div><dt className="field-label">Provider</dt><dd className="font-medium">{providerName}</dd></div>
      <div><dt className="field-label">Client</dt><dd className="font-medium">{accepted ? "Agreement accepted by client" : "Client acceptance not recorded"}</dd></div>
    </dl>
    <p className="mt-4 text-xs leading-6 text-surface-600">Client name and contact details are visible only through an authorized participant link.</p>
  </section>;
}
