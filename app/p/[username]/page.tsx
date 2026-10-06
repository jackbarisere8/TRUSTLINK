import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";
import { getProviderReputation } from "@/lib/reputation";
import { dateLabel } from "@/lib/format";
import { exampleRecord } from "@/lib/examples";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Trust Profile", description: "Transaction history from completed TrustLink records." };

function excerpt(value: string) {
  const plain = value.replace(/\s+/g, " ").trim();
  return plain.length > 220 ? plain.slice(0, 220).trimEnd() + "…" : plain;
}
export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const example = username === "amaka";
  const data = example ? null : await getProviderReputation(username);
  if (!example && !data) notFound();
  if (!example && (!data!.providerProfile || !["NOT_LISTED", "PUBLISHED"].includes(data!.providerProfile.marketplaceStatus))) notFound();

  const name = example ? "Amaka Okafor" : data!.profile.displayName;
  const savedHeadline = data?.providerProfile?.headline || "";
  const headline = example ? exampleRecord.provider.headline : savedHeadline === "Independent professional" ? "" : savedHeadline;
  const bio = example ? "" : data?.providerProfile?.bio || "";
  const savedServiceArea = data?.providerProfile?.serviceArea || "";
  const serviceArea = example || savedServiceArea === "Not provided" ? "" : savedServiceArea;
  const location = example ? "Lagos, Nigeria" : [data?.profile.city, data?.profile.country].filter(Boolean).join(", ");
  const jobs = example ? [{
    publicId: "sample-website-project",
    title: exampleRecord.service,
    category: "Web design",
    scope: exampleRecord.scope,
    completedAt: "2026-09-18",
    rating: undefined,
    comment: undefined,
  }] : data!.jobs;
  const services = example ? [exampleRecord.service] : data!.completedServices;
  const completedCount = example ? 1 : data!.completedJobsCount;
  const onTimeJobsCount = example ? 0 : data!.onTimeJobsCount;
  const onTimeRate = example ? "" : data!.onTimeRate;
  const feedback = jobs.filter(job => job.rating || job.comment);
  const recordHref = (publicId: string) => example ? "/#preview" : "/j/" + publicId;

  return <><Navbar/><main id="main-content" className="shell max-w-4xl pb-20 pt-10 sm:pt-16">
    {example && <p className="notice mb-8">Illustrative Trust Profile · The person and completed work shown here are examples, not live transaction evidence.</p>}
    <header className="border-b border-[#dbe2e3] pb-9">
      <p className="eyebrow">Trust Profile / Evidence from records</p>
      <h1 className="page-heading mt-4 text-[2.8rem] sm:text-[4rem]">{name}</h1>
      {location && <p className="mt-4 text-sm text-surface-600">{location}</p>}
      <p className="mt-4 max-w-2xl text-xs leading-6 text-surface-600">Provider details are self-provided. Transaction history does not independently verify identity.</p>
    </header>

    <section className="border-b border-[#dbe2e3] py-9" aria-labelledby="how-they-work-heading">
      <h2 id="how-they-work-heading" className="text-xl font-semibold">How they work</h2>
      {bio ? <><p className="field-label mt-5">Provider-written description</p><p className="max-w-2xl whitespace-pre-line text-sm leading-7">{bio}</p></> : <p className="mt-4 text-sm text-surface-600">No work approach has been added.</p>}
    </section>

    <section className="border-b border-[#dbe2e3] py-9" aria-labelledby="what-they-do-heading">
      <h2 id="what-they-do-heading" className="text-xl font-semibold">What they do</h2>
      {headline ? <p className="mt-4 max-w-2xl text-sm leading-7">{headline}</p> : <p className="mt-4 text-sm text-surface-600">No service description has been added.</p>}
      {serviceArea && <p className="mt-3 text-sm text-surface-600">Service area: {serviceArea}</p>}
      {services.length > 0 && <div className="mt-6"><h3 className="field-label">Services in completed records</h3><ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{services.map(service => <li key={service} className="border-b border-[#b6c6c9] pb-1">{service}</li>)}</ul></div>}
    </section>

    <section className="border-b border-[#dbe2e3] py-9" aria-labelledby="completed-transactions-heading">
      <h2 id="completed-transactions-heading" className="text-xl font-semibold">Completed transactions</h2>
      {completedCount ? <p className="mt-4 text-sm leading-7"><strong className="font-semibold">{completedCount} completed {completedCount === 1 ? "record" : "records"}</strong> in this Trust Profile. Open a record below to see its public terms and history.</p> : <p className="mt-4 max-w-2xl text-sm leading-7 text-surface-600">No completed transactions recorded yet. Delivery consistency, client feedback and transaction history will appear as completed records become available.</p>}
    </section>

    {completedCount > 0 && <>
      <section className="border-b border-[#dbe2e3] py-9" aria-labelledby="delivery-consistency-heading">
        <h2 id="delivery-consistency-heading" className="text-xl font-semibold">Delivery consistency</h2>
        {onTimeJobsCount > 0 ? <p className="mt-4 max-w-2xl text-sm leading-7"><strong className="font-semibold">{onTimeRate} on-time</strong> across {onTimeJobsCount} completed {onTimeJobsCount === 1 ? "record" : "records"} with a recorded delivery and deadline.</p> : <p className="mt-4 text-sm leading-7 text-surface-600">No completed delivery with an agreed deadline is available to assess timing.</p>}
      </section>

      <section className="border-b border-[#dbe2e3] py-9" aria-labelledby="client-feedback-heading">
        <h2 id="client-feedback-heading" className="text-xl font-semibold">Client feedback</h2>
        {feedback.length ? <ul className="mt-5 divide-y divide-[#dbe2e3] border-y border-[#dbe2e3]">{feedback.map(job => <li key={job.publicId} className="py-5"><p className="text-sm font-semibold"><Link href={recordHref(job.publicId)} className="quiet-link">{job.title}</Link></p>{job.rating && <p className="mt-2 text-xs text-surface-600">Client rating: {job.rating} / 5</p>}{job.comment && <blockquote className="mt-3 max-w-2xl text-sm leading-7">“{job.comment}”</blockquote>}</li>)}</ul> : <p className="mt-4 text-sm text-surface-600">No client feedback has been recorded for these completed transactions.</p>}
      </section>

      <section className="border-b border-[#dbe2e3] py-9" aria-labelledby="selected-work-heading">
        <h2 id="selected-work-heading" className="text-xl font-semibold">Selected work</h2>
        <p className="mt-3 text-sm text-surface-600">Recent work from completed transaction records.</p>
        <div className="mt-5 divide-y divide-[#dbe2e3] border-y border-[#dbe2e3]">{jobs.slice(0, 2).map(job => <article key={job.publicId} className="py-6">
          <h3 className="text-lg font-semibold">{job.title}</h3>
          <p className="mt-2 text-xs text-surface-600">{job.category} · Completed <time className="record-time" dateTime={job.completedAt}>{dateLabel(job.completedAt)}</time></p>
          <p className="mt-4 max-w-2xl text-sm leading-7">{excerpt(job.scope)}</p>
          <Link href={recordHref(job.publicId)} className="quiet-link mt-4 inline-block py-1 text-sm font-semibold">{example ? "View illustrative agreement" : "Read transaction record"} →</Link>
        </article>)}</div>
      </section>

      <section className="py-9" aria-labelledby="transaction-history-heading">
        <h2 id="transaction-history-heading" className="text-xl font-semibold">Transaction history</h2>
        <p className="mt-3 text-sm text-surface-600">Completed records, ordered by completion date.</p>
        <ol className="mt-5 divide-y divide-[#dbe2e3] border-y border-[#dbe2e3]">{jobs.map(job => <li key={job.publicId} className="py-5">
          <p className="field-label">TrustLink / {example ? "Illustrative completed record" : "Completed transaction record"}</p>
          <h3 className="mt-2 text-base font-semibold"><Link href={recordHref(job.publicId)} className="quiet-link">{job.title}</Link></h3>
          <p className="mt-2 text-sm text-surface-600">{job.category} · Completed <time className="record-time" dateTime={job.completedAt}>{dateLabel(job.completedAt)}</time></p>
        </li>)}</ol>
      </section>
    </>}

    {!example && <p className="mt-5 max-w-3xl text-xs leading-6 text-surface-600">Completion counts and service names come from completed records. Delivery timing compares the final submitted delivery with the agreed deadline. Client feedback is submitted after completion. Agreed prices and payment totals are excluded from this profile.</p>}
  </main><Footer/></>;
}
