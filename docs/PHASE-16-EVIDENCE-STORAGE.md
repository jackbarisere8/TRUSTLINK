# Phase 16: evidence storage

Phase 16 separates sensitive transaction evidence from public application assets and closes the upload, download, and deletion authorization loop. The `transaction-evidence` Supabase bucket remains private and is used only for delivery and dispute evidence. Static brand assets stay in the application `public/` directory. TrustLink does not currently expose a public profile or portfolio upload endpoint; a future public-media workflow must use a separate bucket and authorization design.

## Upload contract

The evidence route authorizes the requested transaction before reading an upload and requires a same-origin mutation request. A provider can upload `DELIVERY` evidence only while delivery is an available action. A provider or active client participant can upload `DISPUTE` evidence only while that action is available. Browser-supplied actor IDs, job IDs, paths, purposes, and MIME declarations never grant access.

Each request is bounded even when `Content-Length` is missing or false. Accepted content is limited to PDF, JPEG, PNG, WebP, and UTF-8 plain text at 10 MiB per file. Validation checks the claimed type against structural signatures and trailers where feasible. Plain-text uploads reject null bytes, script shebangs, and obvious HTML, SVG, or script content. SVG and executable MIME types are not accepted.

Object paths are generated as `<job UUID>/<object UUID>` and never use the supplied filename. Download names are normalized, stripped of control, path, bidirectional, and unsafe platform characters, limited to 200 characters, and given the canonical extension for the detected content type. A text payload named `file.exe`, for example, is stored for download as `file.txt`.

## Purpose and attachment state

`evidence_files` is the single private attachment registry. Every new row records an uploader, transaction, safe object path, content metadata, a `DELIVERY` or `DISPUTE` purpose, and `PENDING` status. Server Actions accept only unique pending paths owned by the current actor and matching the command purpose.

The Phase 16 commit wrapper locks the transaction and each referenced metadata row. A successful delivery or dispute commit changes those rows to `ATTACHED` in the same database transaction that persists the child record and immutable event. Deferred constraints require both sides of that relationship. A failed or concurrent commit rolls the status change back. This also serializes submission against deletion: either deletion removes the pending row first and submission fails, or submission attaches it first and deletion is denied.

The migration classifies historical attached rows from their existing delivery or dispute references. Unattached historical rows receive the quarantined `UNASSIGNED` purpose and remain pending so an operator can remove them; new `UNASSIGNED` inserts are rejected and such rows can never be attached.

## Download and deletion authorization

Downloads always pass through the transaction route. The server validates the provider session, scoped client capability, or administrator relationship, verifies the job-scoped path and metadata state, and returns a 60-second signed private download. Pending uploads are visible only to their uploader. Attached evidence is available only inside the authorized transaction workspace.

The uploader can remove a pending file from the delivery or dispute form. The route requires same-origin authorization, exact uploader ownership, the matching job-scoped path, and an unattached database row. It deletes metadata first, so the file cannot later be committed or signed, and then removes the private Storage object. Submitted evidence cannot be updated, deleted, or truncated. If Storage cleanup fails after metadata deletion, the response records cleanup as pending; the object remains private and unreachable through TrustLink, but deployment operations still need orphan cleanup and retention procedures.

## Database and deployment

`20260924000001_evidence_storage.sql` is the thirteenth cumulative migration. It reasserts the private bucket configuration, adds purpose and attachment-state columns, installs safe metadata constraints, protects submitted metadata, links attached metadata to delivery/dispute rows, and wraps the atomic commit with purpose and row-lock enforcement. It adds no public table and grants no new browser or service-role privilege.

Focused source coverage includes stricter signature checks, active-content rejection, filename/path normalization, pending upload removal, attached deletion denial, purpose mismatch rejection, status rollback after a failed commit, and immutable attached metadata. Dynamic validation has not been recorded for Phase 16 in this workspace. No hosted Supabase project or credentials were changed; verify the real Storage API, signed downloads, restrictive policy interaction, orphan operations, and historical `NOT VALID` constraints in backed-up staging before production use.
