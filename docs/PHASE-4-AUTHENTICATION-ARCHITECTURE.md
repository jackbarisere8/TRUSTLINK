# Phase 4: authentication architecture

Implemented for the user's request to continue with Phase 4, September 21, 2026. This phase prepares the production authentication boundary around Supabase Auth without creating another password or session system. No hosted Supabase project exists in this workspace, and no development login was added to the application.

## Authentication boundary

`lib/auth/contracts.ts` defines the provider interface used by account actions and session resolution. The two implementations are:

- the Supabase provider, which delegates sign-in, sign-up, email confirmation, validated user lookup and sign-out to Supabase Auth;
- the unconfigured provider, which always returns no identity and rejects sign-in/sign-up. Local JSON storage selects this behavior even if stray Supabase values are present.

This is an application boundary, not a second authentication protocol. TrustLink stores no passwords, signs no account cookies or JWTs, and accepts no submitted account ID or role. The old `tl_session_token` cookie is ignored everywhere and cleared during logout only as legacy cleanup.

`lib/auth/config.ts` derives auth availability from the explicit storage selection. Supabase mode requires a valid URL and anon key. Non-loopback HTTP endpoints are rejected; local test services may use loopback HTTP. Production remains unavailable until real environment configuration is supplied. No `TRUSTLINK_AUTH` switch or fake-login mode exists.

## Session and role resolution

The server resolves the current account through this chain:

```text
Supabase Auth getUser()
        ↓
validated Auth identity
        ↓
profile by auth user ID
        ↓
provider/admin application session
```

`getUser()` performs the server-side validation; cookie contents alone are never treated as identity. A valid Auth identity must map to a profile with the same user ID or the application session fails closed. Username and display name come from that persisted profile.

Administrator access comes only from server-controlled `app_metadata.role = ADMIN`. Missing, unknown or provider roles map to `PROVIDER`; `user_metadata` is deliberately ignored for authorization. Dashboard layouts require a resolved account. Admin layouts and admin data access require the administrator role. Transaction participant capabilities remain independent, job-scoped guest access and are not account sessions.

The proxy refreshes Supabase sessions and applies response headers, but it is not the authorization boundary. Pages, Server Actions and data access helpers authorize again near protected data or mutations.

## Account operations

Login, signup and email-confirmation inputs now use shared bounded schemas. Emails are normalized to lowercase. Passwords stay opaque and are passed only to Supabase Auth. Provider errors are converted to generic public messages; credentials, tokens and provider error details are not logged or returned.

Signup passes display name and headline as initial metadata so the existing database trigger can create `profiles` and `provider_profiles` from `auth.users`. When email confirmation is enabled, a signup without a session returns instructions to confirm before login. The callback accepts only a bounded token hash with the `email` OTP type and redirects to a fixed local route.

Session cookies use HTTP-only, SameSite=Lax settings and Secure in production. Logout delegates invalidation to Supabase and redirects to login. Protected pages resolve the session again after logout.

## Automated fixture isolation

`tests/support/supabase-fixture.mts` remains a PGlite-backed HTTP stand-in for automated browser testing only. It now refuses to start unless `TRUSTLINK_TEST_FIXTURE=1` and `NODE_ENV` is not `production`. The workflow Playwright configuration supplies that flag only to the fixture process; the Next production server receives normal Supabase configuration and contains no fixture-specific login path.

Fixture identities, passwords, tokens and keys are visibly nonfunctional test values. A fixture provider whose editable `user_metadata.role` says `ADMIN` remains a provider because its trusted `app_metadata` does not grant the role.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | Passed with strict mode |
| `npm run lint` | Passed without errors or warnings |
| `npm test` | 29 passed, including four authentication-boundary tests |
| `npm run build` | Passed; all static and dynamic routes compiled |
| `npm run test:browser` | 6 passed; local auth remains honestly unavailable and forged legacy cookies fail |
| `npm run test:workflow` | 2 passed; full lifecycle plus session/role/cookie/logout checks |

The browser workflow verifies generic rejected-credential handling, provider and admin sessions, provider denial from admin pages, user-metadata spoof rejection, HTTP-only Secure SameSite auth cookies, ignored legacy cookies, logout and subsequent protected-route denial. The existing lifecycle workflow continues to verify server-authorized account and guest actions through the Supabase adapter. A production-bundle scan found no service-role variable name or test service key in client JavaScript/CSS.

## Remaining hosted work

The local fixture does not prove hosted Supabase behavior. Before deployment, configure separate staging and production projects and test real email delivery, confirmation templates, signup, login rejection, access-token expiry, refresh-token rotation, logout, cookie behavior behind the deployed HTTPS proxy, Auth rate limits and operator assignment of administrator `app_metadata`.

Magic-link login, password recovery, MFA, social login and a custom account-session service are not implemented. Phase 4 adds no development dashboard bypass and makes no production-readiness claim.
