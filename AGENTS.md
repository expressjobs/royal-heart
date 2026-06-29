# AGENTS.md

# HeartConnect Engineering Manual for Codex

## 0. Instruction Authority

This file defines the required operating standards for Codex when working in the HeartConnect repository.

Codex MUST treat this document as binding project-level guidance. Codex MUST follow these instructions unless the user gives a more specific instruction that is safe, technically valid, and does not violate security, privacy, data protection, payment integrity, authentication integrity, or production safety requirements.

Codex MUST act as a senior full-stack engineer, production systems architect, security reviewer, and reliability-minded maintainer.

Codex MUST NOT behave like a prototype generator. HeartConnect is a production dating and relationship platform. Changes MUST be safe, incremental, reviewed in context, and designed for long-term maintainability.

RFC 2119 terminology applies throughout this file:

- MUST means an absolute requirement.
- MUST NOT means an absolute prohibition.
- SHOULD means a strong recommendation unless there is a documented reason not to.
- SHOULD NOT means a discouraged practice requiring justification.
- MAY means an optional practice when appropriate.

---

## 1. Project Overview

HeartConnect is a serious dating and relationship platform for:

- Product name: HeartConnect
- Primary domain: `royal-heart.com`
- Product type: serious dating, relationship discovery, matchmaking, messaging, and membership platform
- Primary platform: mobile-first web application
- Deployment target: Cloudflare-compatible production environment

HeartConnect handles highly sensitive user data, including romantic preferences, profile details, images, communications, payment status, account safety state, reports, moderation signals, and private behavioral activity.

Codex MUST optimize for:

- Authentication correctness
- User safety
- Privacy
- Payment integrity
- Subscription correctness
- Database consistency
- RLS correctness
- Production resilience
- Mobile-first user experience
- Accessibility
- SEO where applicable
- Performance
- Maintainable architecture
- Long-term operability

Codex MUST preserve all core business-critical flows:

- Authentication
- Session handling
- Account recovery
- Onboarding
- Profile creation and editing
- Profile image loading
- Discovery
- Likes
- Matches
- Messaging
- Notifications
- Membership and subscription access
- Paystack payments
- Paystack webhooks
- Payment reconciliation
- RLS policies
- Supabase migrations
- Blocking
- Reporting
- Verification
- Moderation
- Cloudflare deployment

Codex MUST NOT introduce regressions in any of these flows.

---

## 2. Architecture

HeartConnect uses a modern full-stack TypeScript architecture built around React, TanStack Start, TanStack Router, Vite, Tailwind CSS, Supabase, Paystack, and Cloudflare.

The architecture MUST maintain strong separation between:

- Presentation components
- Route definitions
- Route loaders and server functions
- Domain services
- Database access
- Authorization checks
- Payment verification
- Webhook fulfillment
- Storage access
- Moderation workflows
- Deployment configuration

Codex MUST preserve the following architectural boundaries:

- Client code MUST NOT contain secrets.
- Client code MUST NOT perform privileged payment fulfillment.
- Client code MUST NOT grant premium membership.
- Client code MUST NOT bypass RLS.
- Server functions MUST validate identity and authorization.
- Server functions handling payment or membership MUST be idempotent.
- Database migrations MUST be additive and production-safe.
- RLS MUST remain the primary database-level access control mechanism.
- Application-level authorization MUST complement RLS, not replace it.

Codex SHOULD organize code around domain capabilities rather than incidental technical categories when possible.

Preferred capability boundaries include:

- `auth`
- `onboarding`
- `profiles`
- `discover`
- `likes`
- `matches`
- `messages`
- `notifications`
- `memberships`
- `payments`
- `moderation`
- `reports`
- `blocking`
- `verification`
- `storage`
- `admin`
- `analytics`
- `shared`

Codex MUST inspect the existing repository structure before adding files. Codex MUST follow established project conventions unless those conventions are unsafe.

---

## 3. Tech Stack

HeartConnect uses:

- React 19
- TypeScript
- TanStack Start
- TanStack Router
- Vite
- Tailwind CSS
- Supabase PostgreSQL
- Supabase Auth
- Supabase Row Level Security
- Supabase Storage
- Supabase Edge Functions and/or TanStack Start server functions
- Paystack payments
- Cloudflare deployment
- Wrangler workflow where applicable

Codex MUST use stack-native capabilities before introducing new dependencies.

Codex MUST NOT introduce a new framework, router, ORM, state manager, component system, payment layer, analytics SDK, logging tool, or deployment abstraction unless explicitly requested or clearly justified.

Codex SHOULD prefer:

- Type-safe route definitions
- Server-side validation
- Explicit domain services
- Generated Supabase types where available
- Typed API contracts
- Progressive enhancement
- Mobile-first responsive UI
- Accessible semantic HTML
- Secure server-side payment processing
- Idempotent database writes
- Structured logging
- Small atomic commits

---

## 4. Repository Structure and Module Boundaries

Codex MUST inspect the repository before making assumptions about paths.

If the repository already has a structure, Codex MUST preserve it unless the task explicitly requires reorganization.

Recommended high-level structure:

```txt
.
├── app/
│   ├── routes/
│   ├── components/
│   ├── features/
│   ├── lib/
│   ├── hooks/
│   ├── styles/
│   └── server/
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── seed.sql
├── public/
├── docs/
├── tests/
├── scripts/
├── wrangler.toml
├── vite.config.ts
├── package.json
├── tsconfig.json
└── AGENTS.md
````

When adding new modules, Codex SHOULD prefer domain-oriented structure such as:

```txt
app/features/discover/
├── components/
├── hooks/
├── server/
├── services/
├── types.ts
└── validation.ts
```

Module boundary rules:

* A feature module SHOULD own its domain-specific components, hooks, services, and types.
* Shared utilities MUST be genuinely reusable.
* Cross-feature imports SHOULD be minimized.
* Business rules SHOULD live in domain services, not scattered across UI components.
* Payment logic MUST be isolated from generic membership UI.
* RLS-sensitive query construction SHOULD be centralized where practical.
* Supabase client creation MUST be centralized.
* Server-only clients MUST NOT be imported into client bundles.
* Client-safe Supabase clients MUST NOT use service-role credentials.
* Domain services MUST NOT rely on incidental UI behavior for security.

Codex MUST NOT create circular dependencies between features.

Codex MUST NOT place sensitive server-only logic in generic shared client modules.

---

## 5. Engineering Principles and Software Architecture

Codex MUST apply mature software architecture principles.

### 5.1 SOLID

Codex MUST apply SOLID pragmatically:

* Single Responsibility: modules SHOULD have one clear reason to change.
* Open/Closed: domain logic SHOULD be extendable without broad rewrites.
* Liskov Substitution: abstractions MUST preserve behavioral contracts.
* Interface Segregation: callers SHOULD depend only on the methods they use.
* Dependency Inversion: high-level domain logic SHOULD NOT depend directly on low-level infrastructure when a seam is useful.

Codex MUST NOT over-engineer simple flows with excessive abstraction.

### 5.2 DRY

Codex SHOULD avoid duplication of:

* Validation rules
* Payment status transitions
* Membership activation logic
* Like-limit checks
* Profile eligibility checks
* RLS assumptions
* Auth/session handling
* Storage URL construction

Codex MUST NOT force premature abstraction when two pieces of code only look superficially similar.

### 5.3 KISS

Codex SHOULD prefer the simplest correct implementation.

Codex MUST NOT introduce unnecessary generic frameworks, custom DSLs, clever metaprogramming, or complex inheritance trees.

### 5.4 YAGNI

Codex MUST NOT add speculative capabilities that were not requested.

Examples of prohibited speculative work:

* Adding a new queue system without need.
* Adding multi-tenant architecture without requirement.
* Adding an unused matching engine abstraction.
* Adding unrequested AI moderation.
* Adding unused subscription plan complexity.
* Adding dormant admin permissions.

### 5.5 Clean Architecture

Codex SHOULD separate:

* Entities and domain concepts
* Use cases and application services
* Infrastructure adapters
* UI and routing
* External integrations

Payment, membership, moderation, and discovery logic SHOULD be implemented as explicit use cases where possible.

### 5.6 Domain-Driven Design

Codex SHOULD use domain language consistently.

Important domain concepts include:

* User
* Account
* Profile
* Onboarding status
* Discovery eligibility
* Like
* Match
* Message
* Conversation
* Membership
* Subscription
* Payment
* Payment event
* Paystack reference
* Verification
* Report
* Block
* Moderation action
* Safety status

Codex MUST NOT use vague names for critical business entities. Names such as `data`, `item`, `thing`, `record`, or `obj` MUST NOT be used for domain objects when a precise name is available.

Codex SHOULD encode domain invariants in types, constraints, database policies, and service-level guards.

---

## 6. React 19 Best Practices

Codex MUST use React 19 idioms compatible with the existing application architecture.

React rules:

* Components MUST be pure where practical.
* Side effects MUST be isolated in appropriate hooks or server-side logic.
* Components SHOULD be small, composable, and intention-revealing.
* Server-derived data SHOULD be loaded through route loaders, server functions, or established data-fetching patterns.
* Client state SHOULD be local unless shared state is necessary.
* Derived state SHOULD be computed rather than duplicated.
* Expensive computations SHOULD be memoized only when there is a clear benefit.
* Error boundaries SHOULD be used for route-level and critical UI failures.
* Suspense SHOULD be used carefully and consistently with existing patterns.
* Form interactions MUST handle loading, success, validation failure, network failure, and retry states.
* Event handlers MUST NOT contain large business workflows when those workflows belong in services.
* User-generated content MUST be rendered safely.
* Components MUST NOT leak private data through HTML attributes, logs, or debugging output.

Codex MUST preserve existing UX and design language unless explicitly asked to redesign.

React anti-patterns Codex MUST avoid:

* Fetching protected data in arbitrary components without authorization context.
* Duplicating server truth in uncontrolled local caches.
* Using array indexes as keys for mutable lists.
* Swallowing errors silently.
* Rendering raw backend errors to users.
* Creating unstable callbacks that trigger avoidable re-renders in hot paths.
* Placing payment fulfillment in client event handlers.
* Trusting client-computed membership status for access control.

---

## 7. TanStack Start and TanStack Router Architecture

Codex MUST preserve route architecture and type safety.

TanStack Router rules:

* Routes MUST be explicit, typed, and maintainable.
* Protected routes MUST enforce authentication consistently.
* Onboarding-gated routes MUST preserve onboarding checks.
* Premium-gated routes MUST verify entitlement server-side where required.
* Route loaders MUST NOT expose private data to unauthorized users.
* Route-level errors SHOULD provide safe fallback UI.
* Route params and search params MUST be validated.
* Navigation MUST preserve expected auth redirects.
* Deep links MUST be handled safely.
* Public routes MUST NOT accidentally require auth unless intended.
* Authenticated routes MUST NOT become public unless explicitly requested.

TanStack Start/server-function rules:

* Server functions MUST validate caller identity.
* Server functions MUST validate inputs.
* Server functions MUST enforce authorization.
* Server functions MUST NOT trust client-provided user IDs.
* Server functions MUST NOT expose service-role behavior to clients.
* Server functions handling payments, membership, moderation, or private messages MUST be especially strict.
* Server functions MUST return safe error shapes.
* Server functions SHOULD use structured logging for production diagnostics without leaking sensitive data.

Codex MUST inspect existing route definitions before adding or changing routes.

---

## 8. TypeScript Strict-Mode Standards

TypeScript MUST remain strict, safe, and maintainable.

Codex MUST NOT weaken TypeScript settings.

Codex MUST NOT introduce:

* Unjustified `any`
* Unsafe casts
* Broad `unknown as SomeType` coercions
* Non-null assertions without proof
* Suppressed errors using `@ts-ignore`
* Suppressed errors using `@ts-expect-error` without a documented reason
* Untyped API responses
* Untyped payment payloads
* Untyped database records
* Stringly typed membership states where union types are appropriate

Preferred TypeScript patterns:

* Use explicit domain types.
* Use generated Supabase database types when available.
* Use narrowed `unknown` for untrusted input.
* Use discriminated unions for state machines.
* Use branded types where helpful for identifiers.
* Use `readonly` when mutation is not required.
* Use exhaustive checks for payment status, membership status, moderation status, and message state.
* Use schema validation at trust boundaries when validation utilities exist.

Critical domain states SHOULD be modeled explicitly:

```ts
type MembershipStatus =
  | "free"
  | "premium_active"
  | "premium_past_due"
  | "premium_cancelled"
  | "premium_expired";

type PaymentFulfillmentStatus =
  | "pending"
  | "verified"
  | "fulfilled"
  | "duplicate_ignored"
  | "failed"
  | "refunded"
  | "disputed";
```

Codex MUST align examples with actual project conventions before adding code.

---

## 9. State Management Patterns

Codex MUST keep state minimal and source-of-truth aligned.

State rules:

* Server state MUST remain server-owned.
* Auth state MUST come from Supabase Auth and established app session handling.
* Membership state MUST be validated server-side for protected actions.
* Payment state MUST be derived from verified payment records and membership records.
* UI state MAY be local to components.
* Shared client state SHOULD only be introduced when multiple unrelated components need it.
* Client caches MUST NOT become security boundaries.
* Optimistic updates MAY be used for likes, messages, or UI responsiveness only when rollback behavior is correct.
* Realtime state MUST reconcile with server truth.

Codex MUST NOT introduce global state for convenience if route loaders, server functions, or local state are sufficient.

Critical state transitions MUST be idempotent:

* Like creation
* Match creation
* Message send retry
* Payment webhook processing
* Membership activation
* Subscription renewal
* Subscription expiration
* Refund handling
* Report creation
* Block creation

---

## 10. API Design Standards

Any API route, server function, or edge function MUST follow strict API design rules.

API rules:

* Validate authentication.
* Validate authorization.
* Validate input.
* Validate object ownership.
* Validate resource state.
* Return typed responses.
* Return safe error messages.
* Use appropriate HTTP status codes where applicable.
* Avoid leaking internal errors.
* Avoid leaking stack traces.
* Use idempotency keys for retryable writes where appropriate.
* Use pagination for list endpoints.
* Use rate limiting where appropriate.
* Avoid returning private fields.
* Avoid over-fetching.
* Avoid under-specified response shapes.
* Log structured operational events without sensitive payloads.

API handlers MUST NOT:

* Trust client-supplied `user_id` as identity.
* Trust client-supplied membership status.
* Trust client-supplied payment status.
* Expose service-role operations directly.
* Return private moderation or payment data to users.
* Allow insecure direct object references.
* Implement broad admin behavior without explicit admin authorization.

---

## 11. Supabase Architecture

Supabase is a core infrastructure dependency.

Codex MUST understand whether code is using:

* Browser Supabase client
* Server Supabase client with user session
* Service-role Supabase client
* Supabase Edge Function client
* Generated database types
* Storage APIs
* Realtime APIs

Supabase client rules:

* Browser clients MUST use public anon keys only.
* Browser clients MUST rely on RLS.
* Server clients using user sessions MUST preserve user context.
* Service-role clients MUST only exist in trusted server-side code.
* Service-role usage MUST be narrow, documented, and auditable.
* Supabase Auth MUST remain the identity source of truth.
* Supabase PostgreSQL MUST remain the application data source of truth.

Codex SHOULD keep Supabase access behind well-named utilities or services.

Codex MUST NOT scatter service-role client creation across the codebase.

---

## 12. PostgreSQL Optimization, Indexing, and Query Planning

Codex MUST treat PostgreSQL as a production database.

Before changing queries, Codex MUST inspect:

* Existing schema
* Existing indexes
* Existing constraints
* Existing RLS policies
* Existing query patterns
* Expected data cardinality
* Pagination strategy
* Sorting requirements

Query rules:

* Use selective filters where possible.
* Avoid unbounded queries.
* Use pagination for discovery, messages, matches, notifications, reports, and payment history.
* Avoid N+1 query patterns.
* Avoid client-side filtering of large result sets.
* Avoid fetching private or unnecessary fields.
* Avoid expensive wildcard searches without indexes.
* Avoid random ordering on large tables unless supported by a deliberate strategy.
* Avoid offset pagination for large or frequently changing datasets when cursor pagination is more appropriate.
* Use transactions or transaction-like RPC functions for multi-step consistency when needed.

Indexing rules:

* Add indexes for new join keys.
* Add indexes for new filters.
* Add indexes for new ordering paths.
* Add partial indexes for common filtered states where appropriate.
* Consider composite indexes for multi-column discovery filters.
* Avoid redundant indexes.
* Avoid indexes that create excessive write amplification without benefit.
* Use `create index concurrently` where appropriate and supported by the migration workflow.
* Use `create index if not exists` for idempotent migrations.

For discovery, indexes MAY be needed on fields such as:

* Profile visibility
* Onboarding completion
* Account status
* Country
* Gender
* Age or birthdate
* Verification status
* Last active time
* Created time
* Moderation status
* Profile image presence

Codex MUST NOT assume these columns exist. Codex MUST inspect schema first.

---

## 13. Advanced Row Level Security Policies and Security Modeling

RLS is mandatory for user data protection.

Codex MUST NOT disable RLS on production tables.

Codex MUST model RLS policies around:

* Identity
* Ownership
* Visibility
* Relationship state
* Blocking state
* Moderation state
* Membership state
* Administrative role
* Server-only operations

RLS policy design rules:

* Policies MUST be least-privilege.
* Policies MUST distinguish public profile data from private profile data.
* Policies MUST prevent users from reading private messages outside authorized conversations.
* Policies MUST prevent unauthorized reads of reports and moderation records.
* Policies MUST prevent users from modifying other users’ profiles.
* Policies MUST prevent users from granting themselves premium access.
* Policies MUST prevent users from editing payment records.
* Policies MUST prevent users from bypassing blocking rules where enforceable.
* Policies MUST protect storage metadata where applicable.
* Policies SHOULD use helper functions only if those functions are secure, stable, and do not introduce privilege escalation.
* Policies SHOULD avoid overly complex logic that becomes unmaintainable or slow.

Codex MUST inspect existing policies before modifying them.

Codex MUST test or recommend testing from these perspectives:

* Anonymous user
* Authenticated user accessing own data
* Authenticated user accessing another user’s public data
* Authenticated user accessing another user’s private data
* Blocked user
* User who blocked another user
* Matched user
* Unmatched user
* Free user
* Premium user
* Moderator/admin where applicable
* Service-role server process

Codex MUST NOT create broad policies such as:

```sql
using (true)
with check (true)
```

unless the table is intentionally public, contains no sensitive data, and the reason is documented.

---

## 14. Database Migration Strategy and Rollback Guidance

Migrations MUST be production-safe.

Migration rules:

* New schema changes MUST be added as new migrations.
* Already-applied production migrations MUST NOT be edited unless explicitly approved.
* Migrations MUST be additive where possible.
* Migrations MUST be idempotent where practical.
* Migrations MUST preserve existing data.
* Migrations MUST consider RLS and policy changes.
* Migrations MUST consider indexes and query plans.
* Migrations MUST consider backfill strategy.
* Migrations MUST consider deployment ordering.
* Migrations MUST consider rollback and forward-fix strategy.

Safe migration patterns:

* Add nullable column.
* Backfill safely.
* Add constraints only after data is valid.
* Add indexes before relying on new query patterns.
* Deploy code that writes both old and new fields if needed.
* Deploy code that reads new field with fallback if needed.
* Remove old paths only after production verification.

Dangerous migration patterns requiring explicit approval:

* Dropping columns
* Dropping tables
* Changing column types
* Renaming columns
* Renaming tables
* Tightening constraints on existing dirty data
* Rewriting primary keys
* Replacing enums
* Disabling RLS
* Replacing policies without preserving access
* Destructive rollback scripts

Rollback guidance:

* Prefer forward fixes for production schema issues.
* Rollback plans SHOULD be documented for risky migrations.
* Destructive rollback MUST NOT be included by default.
* If a migration cannot be safely rolled back, Codex MUST state that clearly.
* Payment, membership, and auth migrations require extra caution.

Codex MUST NOT delete production data.

---

## 15. Authentication, Authorization, Session Management, and Account Recovery

Authentication MUST remain stable.

Codex MUST preserve:

* Sign up
* Sign in
* Sign out
* Session refresh
* Protected routes
* Auth redirects
* Onboarding gates
* Profile completion gates
* Email verification if present
* Password reset if present
* OAuth providers if present
* Account recovery
* Account deletion if present
* Account suspension if present

Authentication rules:

* Supabase Auth MUST remain the identity source of truth.
* Client session state MUST NOT be the only authorization boundary.
* Server functions MUST verify identity.
* Route loaders MUST enforce protected route requirements.
* Auth redirects MUST be deterministic and safe.
* Password reset flows MUST NOT leak whether accounts exist unless intentionally designed.
* OAuth callback handling MUST be secure.
* Account recovery MUST preserve privacy and security.
* Session expiration MUST be handled gracefully.
* Sign-out MUST clear sensitive client state.

Authorization rules:

* Authorization MUST be enforced server-side for sensitive operations.
* Authorization MUST be enforced by RLS at the database layer where applicable.
* Users MUST NOT modify other users’ private data.
* Users MUST NOT grant themselves premium membership.
* Users MUST NOT access private messages without authorization.
* Users MUST NOT view reports or moderation notes unless authorized.
* Users MUST NOT bypass blocking or moderation controls.

---

## 16. Profile Lifecycle and Moderation Workflows

Profiles are central to HeartConnect.

Profile lifecycle states MAY include:

* Created
* Incomplete
* Pending onboarding
* Active
* Hidden
* Paused
* Suspended
* Banned
* Deleted
* Pending moderation
* Verification pending
* Verified
* Rejected

Codex MUST inspect actual project states before implementing logic.

Profile rules:

* Users MUST be able to complete onboarding.
* Users MUST be able to edit permitted profile fields.
* Discovery MUST only show eligible profiles.
* Profile images MUST load correctly.
* Missing profile images MUST have safe fallback UI.
* Private profile fields MUST NOT be exposed publicly.
* Moderated profiles MUST respect moderation status.
* Hidden, suspended, banned, or deleted profiles MUST NOT appear in Discover unless explicitly intended for admins.
* Profile completion logic MUST remain consistent across UI, server logic, and database queries.

Moderation rules:

* Reporting flows MUST be preserved.
* Blocking flows MUST be preserved.
* Verification flows MUST be preserved.
* Moderation state MUST be enforced in Discover, messaging, profile views, and matches where applicable.
* Moderation notes MUST be private.
* Reports MUST NOT be visible to reported users.
* Report creation MUST be protected against spam where possible.
* Blocking MUST prevent unsafe contact.
* Safety takes priority over engagement metrics.

---

## 17. Dating Platform Business Logic

HeartConnect MUST prioritize serious relationship intent, safety, and trust.

Codex MUST preserve all business invariants:

* Free users have like limits.
* Premium users may bypass applicable like limits.
* Users from different countries are visible in Discover unless explicitly filtered.
* Profile images are visible and loaded correctly.
* Users cannot like themselves.
* Users cannot message outside permitted rules.
* Matches are created only through valid mutual interest or explicit product rules.
* Blocking prevents inappropriate visibility and communication.
* Reporting and moderation flows remain intact.
* Payment verification controls premium activation.
* RLS prevents unauthorized data access.
* Migrations preserve production data.

Business logic MUST be enforced server-side for critical flows.

Client-side checks MAY improve UX but MUST NOT be trusted for security, payments, or entitlements.

---

## 18. Discover Ranking Algorithm, Cross-Country Visibility, Pagination, and Performance

Discover is production-critical.

Codex MUST NOT accidentally restrict Discover to same-country users.

Discover eligibility MUST consider actual product requirements and MAY include:

* User is not the current user.
* Profile is complete.
* Profile is visible.
* Account is active.
* Account is not suspended, banned, deleted, or hidden.
* User has not blocked current user.
* Current user has not blocked user.
* Profile satisfies explicit filters.
* Profile satisfies moderation requirements.
* Profile has required minimum public fields.
* Profile has accessible image data or fallback behavior.

Cross-country visibility rules:

* Users from different countries MUST remain visible unless the user explicitly applies a country filter or the business rules explicitly restrict geography.
* Country filters MUST be opt-in or clearly driven by user preferences.
* Missing country data MUST NOT crash Discover.
* Discover MUST NOT assume country equality as a default filter.
* International matching MUST remain supported.

Ranking SHOULD consider stable, explainable signals where present:

* Profile completeness
* Last active time
* Verification status
* Preference compatibility
* Location or country preference
* New user exposure
* Prior interactions
* Safety and moderation eligibility
* Premium boosts only if explicitly part of the product

Ranking MUST NOT:

* Expose private scoring data to users.
* Use unsafe random ordering on large datasets.
* Break pagination.
* Repeatedly show the same profiles due to unstable sorting.
* Hide valid profiles because optional metadata is missing.

Pagination rules:

* Discover MUST be paginated.
* Cursor pagination SHOULD be preferred for large datasets.
* Offset pagination SHOULD be avoided for large, dynamic result sets unless existing architecture requires it.
* Pagination MUST avoid duplicates where practical.
* Pagination MUST avoid skipping large numbers of eligible profiles due to unstable sorting.

Performance rules:

* Discover queries MUST be indexed appropriately.
* Discover MUST avoid N+1 profile/image queries.
* Discover MUST fetch only fields required for cards.
* Discover MUST resolve image URLs efficiently.
* Discover MUST provide loading, empty, and error states.

---

## 19. Likes, Matches, Messaging, Notifications, Typing Indicators, and Realtime Synchronization

### 19.1 Likes

Likes MUST be safe and idempotent.

Rules:

* Users MUST NOT like themselves.
* Free-user like limits MUST be enforced.
* Premium bypass MUST be enforced server-side.
* Duplicate likes MUST NOT corrupt state.
* Likes MUST respect blocking.
* Likes MUST respect moderation.
* Likes MUST respect account eligibility.
* Like writes SHOULD use unique constraints where applicable.
* Like-limit checks SHOULD be transaction-safe where possible.
* Optimistic UI MUST rollback on failure.

### 19.2 Matches

Matches MUST be deterministic.

Rules:

* A match MUST be created only when valid product rules are satisfied.
* Duplicate matches MUST be prevented.
* Match creation SHOULD be idempotent.
* Match state MUST respect blocking and moderation.
* Match visibility MUST update when users block, delete, hide, or suspend accounts.
* Mutual-like logic MUST be protected against race conditions.

### 19.3 Messaging

Messaging MUST protect user privacy.

Rules:

* Users MUST only access conversations they are authorized to access.
* Messages MUST only be sent where product rules permit.
* If messaging requires a match, that requirement MUST be enforced.
* If messaging requires premium membership, that requirement MUST be enforced server-side.
* Blocking MUST prevent message sending.
* Suspended or banned users MUST NOT bypass restrictions.
* Message contents MUST NOT be logged.
* Message send retries MUST avoid duplicate messages where possible.
* Message lists MUST be paginated.
* Message delivery UI MUST show sending, sent, failed, and retry states where appropriate.
* Empty conversation UI MUST be clear and safe.

### 19.4 Notifications

Notifications SHOULD be event-driven where practical.

Rules:

* Notifications MUST respect privacy.
* Notifications MUST respect blocking and moderation.
* Notifications MUST NOT reveal sensitive message content unless intended.
* Notification preferences MUST be respected if implemented.
* Duplicate notifications SHOULD be avoided.
* Payment and membership notifications MUST be accurate.

### 19.5 Typing Indicators

Typing indicators, if implemented, MUST be ephemeral.

Rules:

* Typing state MUST NOT be persisted unnecessarily.
* Typing state MUST only be visible to authorized conversation participants.
* Typing state MUST respect blocking.
* Typing state SHOULD expire automatically.
* Typing state MUST NOT leak private user activity outside permitted context.

### 19.6 Realtime Synchronization

Realtime features MUST reconcile with server truth.

Rules:

* Realtime events MUST NOT bypass authorization.
* Realtime subscriptions MUST be scoped.
* Realtime state MUST handle reconnects.
* Realtime state MUST handle duplicate events.
* Realtime state MUST handle out-of-order events.
* Realtime state MUST avoid memory leaks.
* Realtime UI MUST degrade gracefully when unavailable.

---

## 20. Free vs Premium Membership Rules

Membership is revenue-critical.

Codex MUST preserve:

* Free-user limitations
* Premium-user privileges
* Subscription state
* Payment verification
* Membership activation
* Membership expiration
* Membership cancellation
* Grace periods if implemented
* Downgrades if implemented

Free-user rules:

* Free users MUST remain limited on likes according to existing business logic.
* Free users MUST NOT receive premium-only capabilities unless valid entitlement exists.
* Free users SHOULD receive clear upgrade prompts when limits are reached.
* Free users MUST still be able to complete core safe account setup.

Premium-user rules:

* Premium users MAY bypass applicable like limits where the product requires.
* Premium privileges MUST be based on server-verified entitlement.
* Premium status MUST NOT be trusted from client-only state.
* Premium expiration MUST be enforced.
* Premium cancellation MUST be respected.
* Refunds or chargebacks SHOULD revoke or adjust entitlement according to business rules.

Membership writes MUST be idempotent.

---

## 21. Paystack Payment Lifecycle and Financial Integrity

Paystack integration MUST be handled as financial infrastructure.

Codex MUST preserve secure server-side payment workflows.

### 21.1 Payment Initialization

Payment initialization MUST:

* Occur through secure server-side logic.
* Validate authenticated user identity.
* Validate selected plan.
* Validate amount and currency.
* Generate or store a unique reference where applicable.
* Associate payment intent with the authenticated user.
* Avoid trusting client-supplied amount, plan, currency, or membership duration.
* Return only client-safe payment initialization data.

### 21.2 Payment Verification

Payment verification MUST:

* Occur server-side.
* Validate Paystack transaction reference.
* Validate status.
* Validate amount.
* Validate currency.
* Validate customer or metadata linkage to the authenticated user.
* Validate selected plan or product.
* Avoid granting membership from client redirect alone.
* Be idempotent.

### 21.3 Webhook Validation

Paystack webhooks MUST be verified using signatures.

Webhook rules:

* Treat all webhook payloads as untrusted until signature verification succeeds.
* Use the Paystack secret key only in server-side code.
* Compare signatures securely.
* Reject invalid signatures.
* Avoid logging full webhook bodies when they contain sensitive data.
* Store webhook event IDs or transaction references for idempotency.
* Handle duplicate webhook delivery safely.
* Handle out-of-order events safely.
* Return appropriate responses to prevent unnecessary retries after successful processing.

### 21.4 Fulfillment and Membership Activation

Fulfillment MUST be idempotent.

Membership activation MUST occur only after verified payment.

Fulfillment MUST verify:

* Transaction reference
* Paystack status
* User linkage
* Plan
* Amount
* Currency
* Prior fulfillment state
* Subscription state if applicable

Codex MUST NOT grant premium access from:

* Unverified redirects
* Client-only callbacks
* Untrusted metadata
* Failed transactions
* Abandoned transactions
* Duplicate events
* Ambiguous payment state
* Invalid signatures
* Stale payment references

### 21.5 Reconciliation

Payment reconciliation SHOULD support:

* Matching internal payment records to Paystack references
* Detecting pending payments
* Detecting duplicate events
* Detecting underpayment or overpayment
* Detecting currency mismatch
* Detecting orphaned transactions
* Detecting membership activation failures
* Producing safe operational logs

Codex SHOULD design reconciliation flows to be repeatable and idempotent.

### 21.6 Refunds, Reversals, Disputes, and Chargebacks

Refund and dispute handling MUST be conservative.

Rules:

* Refund events SHOULD adjust membership according to product policy.
* Chargebacks SHOULD suspend, revoke, or flag entitlement according to product policy.
* Disputes SHOULD be auditable.
* Refund logic MUST be idempotent.
* Refund logic MUST NOT delete payment history.
* Financial records SHOULD remain append-only where practical.
* Users MUST NOT receive unintended premium access after refund or chargeback if policy says access should end.

### 21.7 Retries

Retry logic MUST be safe.

Rules:

* Retried payment events MUST NOT duplicate fulfillment.
* Retried webhooks MUST be accepted idempotently.
* Network failures MUST not create inconsistent membership.
* Payment initialization retry MUST not create uncontrolled duplicate active subscriptions.
* Retryable operations SHOULD use idempotency keys or unique references.

### 21.8 Subscriptions

If subscriptions are implemented:

* Subscription state MUST be server-verified.
* Renewals MUST be idempotent.
* Cancellations MUST be respected.
* Expiration MUST be enforced.
* Grace periods MUST be explicit.
* Subscription plan changes MUST be auditable.
* Downgrades MUST not occur before allowed by business rules.
* Renewals MUST validate amount, currency, plan, and customer linkage.

### 21.9 Coupons and Discounts

If coupons are implemented:

* Coupons MUST be validated server-side.
* Coupon expiry MUST be enforced.
* Usage limits MUST be enforced.
* User eligibility MUST be enforced.
* Discounted amount MUST match Paystack transaction amount.
* Coupon abuse MUST be prevented.
* Coupon application MUST be auditable.

### 21.10 Installment Payments

If installment payments are implemented:

* Installment schedule MUST be explicit.
* Partial payment MUST NOT grant full premium access unless product policy allows it.
* Missed installment behavior MUST be defined.
* Installment reconciliation MUST be idempotent.
* Payment references MUST map to installment obligations.
* Entitlement duration MUST match paid entitlement.

---

## 22. Image Storage, Optimization, Caching, Signed URLs, and CDN Strategy

Profile images are critical to dating UX.

Image rules:

* Profile images MUST load reliably.
* Missing images MUST show safe fallback UI.
* Broken images MUST not break Discover or profile pages.
* Private images MUST NOT be publicly exposed unless intended.
* Public images MUST not leak private storage paths unnecessarily.
* Image upload MUST validate file type.
* Image upload SHOULD validate file size.
* Image upload SHOULD validate dimensions where appropriate.
* Image upload SHOULD prevent dangerous content types.
* Image processing SHOULD avoid blocking critical UI.

Supabase Storage rules:

* Buckets MUST have appropriate privacy settings.
* Storage policies MUST align with profile visibility.
* Users MUST NOT overwrite other users’ images.
* Users MUST NOT read private images without authorization.
* Signed URLs SHOULD be used for private images.
* Signed URL expiry MUST be appropriate.
* Public CDN URLs MAY be used only for intentionally public assets.
* Image URL construction SHOULD be centralized.

Caching rules:

* Public images MAY use CDN caching.
* Private signed URLs SHOULD have controlled TTL.
* Caches MUST NOT expose private images after access changes where avoidable.
* Profile image updates SHOULD invalidate or bust stale caches.
* Responsive images SHOULD be used where practical.
* Lazy loading SHOULD be used for Discover lists.

Codex MUST verify image loading after changes involving profiles, storage, Discover, or CDN behavior.

---

## 23. Mobile-First UX, PWA Architecture, Accessibility, SEO, Structured Data, and Performance Budgets

### 23.1 Mobile-First UX

HeartConnect MUST be mobile-first.

Rules:

* Layouts MUST work on small screens.
* Tap targets MUST be usable.
* Forms MUST be comfortable on mobile.
* Modals MUST not trap users incorrectly.
* Fixed elements MUST not hide primary actions.
* Safe-area insets SHOULD be respected.
* Discovery cards MUST work on touch devices.
* Chat UI MUST handle mobile keyboards.
* Payment flows MUST work on mobile browsers.
* Onboarding MUST be easy to complete on mobile.

### 23.2 PWA Architecture

If PWA support exists:

* Manifest MUST remain valid.
* Icons MUST remain valid.
* Service worker behavior MUST remain safe.
* Authenticated private data MUST NOT be cached unsafely.
* Offline fallback MUST NOT expose private state.
* Updates SHOULD be handled gracefully.
* Installability SHOULD be preserved.

### 23.3 Accessibility

HeartConnect SHOULD target WCAG 2.2 AA where practical.

Accessibility rules:

* Use semantic HTML.
* Provide accessible names for controls.
* Preserve keyboard navigation.
* Preserve visible focus indicators.
* Maintain sufficient color contrast.
* Avoid hover-only interactions.
* Use proper labels for forms.
* Use ARIA only when semantic HTML is insufficient.
* Dialogs MUST manage focus.
* Error messages MUST be associated with relevant fields.
* Motion SHOULD respect reduced-motion preferences.
* Images SHOULD have appropriate alt text or decorative treatment.
* Loading states SHOULD be perceivable.
* Toasts and alerts SHOULD be accessible.

### 23.4 SEO and Structured Data

SEO applies primarily to public marketing and public content surfaces.

Rules:

* Authenticated private pages MUST NOT expose private data for SEO.
* Public pages SHOULD have meaningful titles and descriptions.
* Canonical URLs SHOULD be correct.
* Open Graph metadata SHOULD be appropriate.
* Structured data MAY be used for public marketing pages where valid.
* Dating profile private data MUST NOT be exposed through structured data unless explicitly public and safe.
* Robots directives MUST prevent indexing of private/authenticated pages.

### 23.5 Performance Budgets

Codex SHOULD protect performance budgets.

Suggested targets:

* Keep initial JavaScript minimal.
* Avoid unnecessary client bundles.
* Optimize images.
* Avoid layout shift.
* Avoid long blocking tasks.
* Keep route transitions responsive.
* Use pagination and lazy loading.
* Avoid unbounded realtime subscriptions.
* Avoid excessive third-party scripts.

Codex SHOULD call out performance risks in final responses.

---

## 24. Cloudflare Deployment, Wrangler Workflow, CI/CD, Environment Separation, Observability, and Incident Response

### 24.1 Cloudflare Deployment

Deployment MUST remain compatible with the configured Cloudflare environment.

Rules:

* Preserve Wrangler configuration.
* Preserve runtime compatibility.
* Preserve Vite/TanStack Start build compatibility.
* Preserve environment variable separation.
* Preserve server function compatibility.
* Avoid Node-only APIs unless supported by the runtime or polyfilled intentionally.
* Validate deployment-impacting changes with build checks.

Recommended commands where available:

```bash
npm run build
npx wrangler types
npx wrangler deploy --dry-run
```

Codex MUST only claim these passed if they actually ran successfully.

### 24.2 Environment Separation

Environment variables MUST be separated across:

* Local
* Preview
* Staging
* Production

Rules:

* Client-exposed variables MUST be intentionally public.
* Server-only variables MUST remain server-only.
* Paystack secret keys MUST remain server-only.
* Supabase service-role keys MUST remain server-only.
* Production secrets MUST NOT be used in local code examples.
* `.env` files MUST NOT be committed.
* Example env files MUST use placeholders only.

### 24.3 CI/CD

CI SHOULD validate:

* Install
* Typecheck
* Lint
* Build
* Unit tests
* Integration tests
* E2E tests where available
* Migration checks
* RLS tests where available
* Accessibility tests where available
* Payment webhook tests where available

Codex SHOULD preserve existing CI workflows.

Codex MUST NOT weaken CI gates without explicit approval.

### 24.4 Observability and Structured Logging

Production code SHOULD support diagnosis without leaking sensitive data.

Logging rules:

* Use structured logs where available.
* Include correlation IDs where practical.
* Log payment lifecycle events safely.
* Log webhook processing outcomes safely.
* Log auth failures safely.
* Log moderation actions safely.
* Do not log full message contents.
* Do not log secrets.
* Do not log full tokens.
* Do not log private environment variables.
* Do not log full payment authorization headers.
* Do not log unnecessary personal data.

Metrics SHOULD track:

* Payment success/failure
* Webhook duplicate events
* Membership activation failures
* Auth errors
* Discovery query latency
* Message send failures
* Realtime disconnects
* API errors
* Build/deploy failures

### 24.5 Monitoring and Incident Response

Codex SHOULD design production-sensitive changes with incident response in mind.

Incident response guidance:

* Identify blast radius.
* Preserve evidence.
* Avoid destructive quick fixes.
* Prefer reversible mitigations.
* Disable unsafe features via flags where available.
* Roll forward with safe fixes where possible.
* Communicate payment, privacy, or security impact clearly.
* Reconcile affected payment or membership records.
* Verify RLS and auth after incident fixes.
* Document follow-up actions.

---

## 25. Dependency Management and Versioning

Codex MUST manage dependencies conservatively.

Rules:

* Do not add dependencies unless necessary.
* Prefer existing utilities.
* Prefer platform APIs where suitable.
* Check package size and maintenance status before adding.
* Avoid abandoned packages.
* Avoid packages with unnecessary permissions or risky postinstall behavior.
* Avoid duplicating dependencies with similar functionality.
* Preserve lockfiles.
* Do not manually edit lockfiles except as part of package manager operations.
* Do not switch package managers without explicit approval.
* Do not upgrade major versions casually.
* Major upgrades MUST include migration notes and validation.

Versioning rules:

* Respect existing semantic versioning practices.
* Keep peer dependency compatibility in mind.
* React, TanStack, Vite, Supabase, Tailwind, and Cloudflare-related upgrades MUST be validated carefully.
* Payment library upgrades MUST be treated as sensitive.

---

## 26. Git Workflow, Branching Strategy, Commit Conventions, and Code Review Checklist

Codex MUST produce changes suitable for review.

Git workflow rules:

* Prefer small, atomic changes.
* Keep unrelated changes separate.
* Do not reformat unrelated files.
* Do not rename files unnecessarily.
* Do not change generated files unless required.
* Do not alter lockfiles unless dependencies changed.
* Do not commit secrets.
* Do not rewrite history.
* Do not force push.

Branching strategy SHOULD follow the team’s existing conventions. If unknown, use descriptive task branches such as:

```txt
fix/discover-cross-country-visibility
feat/paystack-webhook-idempotency
chore/supabase-membership-indexes
```

Commit messages SHOULD be conventional where the repo uses or allows it:

```txt
feat(discover): preserve cross-country profile visibility
fix(payments): make webhook fulfillment idempotent
chore(db): add index for membership lookup
```

Code review checklist:

* Does the change preserve auth?
* Does the change preserve onboarding?
* Does the change preserve profiles?
* Does the change preserve Discover?
* Does the change preserve profile image loading?
* Does the change preserve likes, matches, and messaging?
* Does the change preserve free vs premium rules?
* Does the change preserve Paystack verification?
* Is payment fulfillment idempotent?
* Does the change preserve RLS?
* Are migrations additive and safe?
* Are queries indexed?
* Are errors handled safely?
* Are loading, empty, and fallback states present?
* Is mobile UX preserved?
* Is accessibility preserved?
* Are secrets protected?
* Are tests or validation checks included?
* Is the final response honest about what was and was not validated?

---

## 27. Disaster Recovery, Backup Strategy, and Production Recovery Procedures

Codex MUST treat production data as irreplaceable.

Rules:

* Never delete production data.
* Never truncate production tables.
* Never drop production tables or columns without explicit approval.
* Never overwrite production records in bulk without a verified strategy.
* Never run destructive scripts casually.
* Never hide data corruption with UI-only fixes.
* Preserve audit trails for payments, membership, moderation, and account actions.

Backup strategy SHOULD include:

* Supabase automated backups where configured.
* Manual backup before high-risk migrations.
* Export strategy for critical payment and membership records.
* Recovery point objective awareness.
* Recovery time objective awareness.
* Restoration testing where available.

Production recovery procedures SHOULD include:

* Identify affected users.
* Stop further damage.
* Preserve logs and payment records.
* Restore from backup only with explicit approval.
* Prefer forward repair when safer than rollback.
* Reconcile payments and memberships.
* Validate RLS after recovery.
* Validate auth after recovery.
* Validate Discover and messaging after recovery.
* Document the incident and corrective actions.

Codex MUST recommend a backup before any risky database operation.

---

## 28. Security Threat Modeling, OWASP Top 10, Privacy, GDPR, and Data Protection

HeartConnect MUST be designed against common web and application threats.

### 28.1 OWASP-Oriented Security Rules

Codex MUST consider:

* Broken Access Control
* Cryptographic Failures
* Injection
* Insecure Design
* Security Misconfiguration
* Vulnerable and Outdated Components
* Identification and Authentication Failures
* Software and Data Integrity Failures
* Security Logging and Monitoring Failures
* Server-Side Request Forgery

Security requirements:

* Enforce authorization server-side.
* Enforce RLS database-side.
* Validate all untrusted input.
* Use parameterized queries or Supabase query builders safely.
* Avoid raw SQL unless necessary and reviewed.
* Avoid unsafe redirects.
* Avoid XSS through unsafe rendering.
* Avoid CSRF-sensitive state changes without appropriate protections.
* Avoid exposing internal implementation details.
* Avoid insecure file uploads.
* Avoid dependency risk.
* Avoid permissive CORS unless explicitly safe.
* Avoid leaking account existence unnecessarily.

### 28.2 Privacy and Data Protection

HeartConnect handles sensitive personal data.

Codex MUST protect:

* User identity data
* Contact data
* Profile details
* Preferences
* Images
* Likes
* Matches
* Messages
* Blocks
* Reports
* Moderation records
* Verification records
* Payment records
* Subscription state
* Behavioral activity

Privacy rules:

* Collect only necessary data.
* Display only intended public data.
* Keep private fields private.
* Avoid logging sensitive data.
* Respect deletion or deactivation flows where implemented.
* Respect blocking and reporting privacy.
* Protect message content.
* Protect moderation records.
* Protect payment metadata.

### 28.3 GDPR and Data Rights

Where applicable, Codex SHOULD preserve support for:

* Data access
* Data correction
* Data deletion
* Data export
* Consent management
* Retention policies
* Purpose limitation
* Data minimization

Codex MUST NOT remove existing privacy controls.

Codex MUST NOT add tracking or analytics that collect sensitive data without explicit approval.

---

## 29. AI Assistant Development Guidelines

Codex MUST operate conservatively and transparently.

Before changing code, Codex MUST:

* Inspect relevant files.
* Understand existing dependencies.
* Understand schema assumptions.
* Understand RLS assumptions.
* Understand route behavior.
* Understand payment flow impact if relevant.
* Understand auth/session impact if relevant.
* Avoid broad rewrites.

During implementation, Codex MUST:

* Make minimal sufficient changes.
* Preserve unrelated behavior.
* Use precise types.
* Use safe migrations.
* Keep security boundaries intact.
* Prefer server-side enforcement for critical rules.
* Add validation where needed.
* Add tests where practical.
* Avoid changing formatting across unrelated files.

Codex MUST NOT:

* Invent table names without checking schema.
* Invent environment variables without checking existing config.
* Invent commands without checking `package.json`.
* Invent deployment workflow without checking repo files.
* Invent payment states without checking existing code.
* Claim tests passed without running them.
* Claim production safety without evidence.
* Ignore failing validation.

If repository context is incomplete, Codex MUST make safe assumptions explicit.

---

## 30. Testing Strategy

Testing MUST reflect production risk.

### 30.1 Unit Tests

Unit tests SHOULD cover:

* Domain services
* Like-limit logic
* Premium entitlement logic
* Discovery eligibility
* Match creation logic
* Message validation
* Payment state transitions
* Webhook idempotency
* Profile completion logic
* Moderation eligibility
* Utility functions

### 30.2 Integration Tests

Integration tests SHOULD cover:

* Authenticated server functions
* Supabase queries
* RLS-permitted reads/writes
* Profile updates
* Discover queries
* Like and match flows
* Message flows
* Payment verification
* Membership activation
* Storage URL generation

### 30.3 E2E Tests

E2E tests SHOULD cover:

* Signup/login
* Onboarding completion
* Profile creation
* Profile image upload/display
* Discover browsing
* Cross-country visibility
* Like limit reached for free users
* Premium user bypass
* Match creation
* Messaging
* Blocking
* Reporting
* Payment checkout initiation
* Payment success handling
* Payment failure handling

### 30.4 RLS Tests

RLS tests SHOULD verify:

* Anonymous access restrictions
* Own-profile access
* Other-profile public access
* Private profile restrictions
* Likes ownership
* Match visibility
* Message visibility
* Payment record protection
* Subscription protection
* Report privacy
* Moderation privacy
* Blocking behavior

### 30.5 Payment Tests

Payment tests SHOULD verify:

* Webhook signature validation
* Invalid signature rejection
* Duplicate webhook idempotency
* Verified transaction fulfillment
* Failed transaction non-fulfillment
* Amount mismatch rejection
* Currency mismatch rejection
* User mismatch rejection
* Refund handling if implemented
* Subscription renewal if implemented
* Coupon amount validation if implemented
* Installment behavior if implemented

### 30.6 Performance Tests

Performance checks SHOULD include:

* Discover query latency
* Message list pagination
* Profile image loading
* Bundle size
* Route transition latency
* Database index usage
* Realtime subscription behavior

### 30.7 Accessibility Tests

Accessibility checks SHOULD include:

* Keyboard navigation
* Focus management
* Form labels
* Error message association
* Color contrast
* Screen reader behavior
* Dialog accessibility
* Reduced motion behavior

---

## 31. Testing and Validation Commands

Before finishing any task, Codex MUST run or recommend relevant validation commands.

Codex MUST inspect `package.json` before claiming a script exists.

Common validation commands:

```bash
npm install
npm run build
npm run typecheck
npm run lint
npm test
```

Rules:

* `npm install` SHOULD run only when dependencies are missing or installation is required.
* `npm run build` MUST be run before claiming production readiness when feasible.
* `npm run typecheck` MUST be run when available.
* `npm run lint` MUST be run when available.
* Tests MUST be run when relevant and available.
* Cloudflare checks SHOULD be run when deployment configuration changes.
* Supabase migration checks SHOULD be run when database changes are made.
* RLS checks SHOULD be run when policies or protected queries change.
* Payment tests SHOULD be run when Paystack or membership logic changes.
* Accessibility checks SHOULD be run when UI changes are made.

Codex MUST report:

* Commands run
* Commands skipped
* Commands unavailable
* Failures
* Environment limitations
* Follow-up required

Codex MUST NOT say validation passed unless it actually passed.

---

## 32. Release Checklist

Before a release, Codex SHOULD ensure:

* Build passes.
* Typecheck passes.
* Lint passes.
* Relevant tests pass.
* Migrations are additive and reviewed.
* RLS policies are reviewed.
* Paystack webhook flow is verified if touched.
* Membership activation is verified if touched.
* Auth redirects are verified if touched.
* Onboarding is verified if touched.
* Discover is verified if touched.
* Cross-country visibility is preserved.
* Profile images load correctly.
* Free-user like limits remain enforced.
* Premium-user bypass remains correct.
* Messaging authorization remains correct.
* Blocking and reporting remain correct.
* Mobile layout is checked.
* Accessibility basics are checked.
* Environment variables are configured.
* Cloudflare build compatibility is checked.
* Rollback or forward-fix strategy is understood.
* Monitoring/logging impact is understood.

---

## 33. Deployment Checklist

Before deployment, Codex SHOULD verify:

* Correct branch.
* Clean working tree or documented changes.
* Correct environment.
* Required secrets configured.
* No secrets committed.
* Build passed.
* Typecheck passed.
* Lint passed.
* Tests passed or skipped with reason.
* Migrations reviewed.
* Migrations applied in correct environment.
* RLS reviewed.
* Paystack webhook URL configured.
* Paystack secret configured server-side only.
* Supabase URL and keys configured appropriately.
* Cloudflare variables configured.
* Wrangler configuration valid.
* Preview deployment tested where available.
* Production deployment plan understood.
* Post-deploy smoke tests defined.

Post-deploy smoke tests SHOULD include:

* Public landing page loads.
* Sign-in works.
* Protected route works.
* Onboarding gate works.
* Profile loads.
* Profile images load.
* Discover loads.
* Cross-country profiles appear when eligible.
* Like action works.
* Free like limit works.
* Premium entitlement works.
* Match flow works.
* Messaging works.
* Blocking works.
* Reporting works.
* Payment checkout initializes.
* Webhook fulfillment works in test mode where applicable.

---

## 34. Repository Invariants

The following invariants MUST never be broken.

### 34.1 Product Invariants

* HeartConnect MUST remain a serious dating and relationship platform.
* Existing UI/UX MUST be preserved unless redesign is requested.
* Mobile-first usability MUST be preserved.
* Cross-country Discover visibility MUST be preserved.
* Profile images MUST remain visible and correctly loaded.
* Free users MUST remain limited on likes.
* Premium users MUST receive intended premium privileges.
* Blocking, reporting, verification, and moderation MUST remain functional.

### 34.2 Auth Invariants

* Auth MUST not be weakened.
* Protected routes MUST remain protected.
* Onboarding gates MUST remain correct.
* Users MUST NOT access private data belonging to other users.
* Session handling MUST remain stable.

### 34.3 Payment Invariants

* Paystack secret keys MUST never be exposed.
* Webhooks MUST be signature-verified.
* Payment fulfillment MUST be idempotent.
* Premium access MUST only be granted after verified payment.
* Payment records MUST remain auditable.
* Refunds/disputes MUST not leave unintended entitlement if handled.

### 34.4 Database Invariants

* Production data MUST NOT be deleted.
* RLS MUST remain enabled and correct.
* Migrations MUST be additive and safe unless explicitly approved.
* Schema changes MUST preserve existing production data.
* Queries MUST align with schema and RLS.

### 34.5 Security Invariants

* Secrets MUST not be exposed.
* Private user data MUST remain private.
* Messages MUST remain private.
* Reports and moderation records MUST remain private.
* Service-role access MUST remain server-side only.
* Client-side checks MUST NOT be treated as security boundaries.

---

## 35. Forbidden Actions

Codex MUST NOT perform any of the following actions unless the user explicitly requests the action, the risk is explained, and the action is still safe under production constraints.

### 35.1 Data Destruction

Codex MUST NOT:

* Delete production data.
* Truncate production tables.
* Drop production tables.
* Drop production columns.
* Drop production indexes without replacement analysis.
* Delete user profiles in bulk.
* Delete messages in bulk.
* Delete payment records.
* Delete subscription records.
* Delete reports or moderation history.
* Rewrite production migration history.
* Run destructive scripts without explicit approval.
* Suggest destructive SQL as a casual fix.

### 35.2 Authentication and Authorization

Codex MUST NOT:

* Remove auth guards.
* Weaken protected route checks.
* Allow anonymous access to authenticated data.
* Trust client-supplied user IDs.
* Trust client-supplied roles.
* Trust client-supplied membership status.
* Expose private profile data.
* Expose messages to unauthorized users.
* Expose reports or moderation notes.
* Bypass RLS with unsafe client code.

### 35.3 Payments

Codex MUST NOT:

* Expose Paystack secret keys.
* Expose service-role keys.
* Move payment fulfillment to client code.
* Grant premium from client redirects alone.
* Skip Paystack webhook signature verification.
* Treat unverified webhooks as valid.
* Make payment fulfillment non-idempotent.
* Ignore amount mismatch.
* Ignore currency mismatch.
* Ignore user mismatch.
* Delete payment audit records.
* Log payment secrets.
* Log full authorization headers.
* Grant access for failed or abandoned payments.
* Ignore duplicate webhook delivery.
* Ignore refunds or disputes where handling exists.

### 35.4 Database and RLS

Codex MUST NOT:

* Disable RLS.
* Create broad unrestricted RLS policies for sensitive tables.
* Replace policies without understanding existing access paths.
* Add queries that cannot work under RLS.
* Assume table names.
* Assume column names.
* Assume enum values.
* Assume relationships.
* Ignore indexes for new high-volume queries.
* Perform unsafe backfills.
* Tighten constraints without checking existing data.

### 35.5 Product Logic

Codex MUST NOT:

* Remove free-user like limits.
* Prevent premium users from bypassing intended limits.
* Restrict Discover to same-country users by default.
* Show blocked users.
* Show users who blocked the current user.
* Show suspended, banned, deleted, or hidden users in Discover.
* Allow self-likes.
* Create duplicate matches.
* Allow unauthorized messaging.
* Break notification privacy.
* Break typing indicator privacy.
* Break profile image loading.
* Break onboarding.
* Break account recovery.

### 35.6 UI/UX

Codex MUST NOT:

* Redesign UI without explicit request.
* Remove loading states.
* Remove error states.
* Remove empty states.
* Remove fallback images.
* Break mobile layouts.
* Introduce inaccessible controls.
* Hide important payment or safety information.
* Render raw backend errors to users.
* Make hover-only interactions required on mobile.

### 35.7 Engineering Process

Codex MUST NOT:

* Introduce broad rewrites.
* Perform unrelated cleanup.
* Add unnecessary dependencies.
* Switch package managers.
* Weaken TypeScript config.
* Ignore failing tests.
* Claim checks passed without running them.
* Invent unavailable commands.
* Invent schema details.
* Invent deployment details.
* Commit secrets.
* Commit `.env` files.
* Modify generated files without reason.

---

## 36. Final Response Template for Every Codex Task

Codex MUST end every task with the following response structure.

```md
## Summary

- State the primary change in one or two bullets.
- State why the change was necessary.
- State whether auth, onboarding, profiles, Discover, likes, matches, messaging, payments, subscriptions, RLS, migrations, or deployment were affected.

## Changed Files

- `path/to/file.ext`
  - Describe exactly what changed.
  - Mention whether the change is UI, server, database, payment, auth, RLS, migration, test, or config related.

## Architecture and Safety Notes

- Describe important architectural decisions.
- Describe any security, privacy, payment, RLS, migration, or production-safety considerations.
- Mention how repository invariants were preserved.
- Mention any assumptions made.

## Validation

- `npm install`: Run / skipped / unavailable / failed.
- `npm run build`: Run / skipped / unavailable / failed.
- `npm run typecheck`: Run / skipped / unavailable / failed.
- `npm run lint`: Run / skipped / unavailable / failed.
- `npm test`: Run / skipped / unavailable / failed.
- Supabase migration validation: Run / skipped / unavailable / failed.
- RLS validation: Run / skipped / unavailable / failed.
- Paystack validation: Run / skipped / unavailable / failed.
- Cloudflare/Wrangler validation: Run / skipped / unavailable / failed.
- Accessibility validation: Run / skipped / unavailable / failed.
- Mobile/responsive validation: Run / skipped / unavailable / failed.

## Risks and Follow-Up

- List known risks.
- List follow-up work if needed.
- List anything that could not be validated in the current environment.
- Never claim production readiness unless all relevant checks passed.
```

Codex MUST be honest and specific. Codex MUST NOT hide failures or uncertainty.

---

## 37. Task Intake Checklist for Codex

Before beginning a change, Codex SHOULD identify:

* What feature or subsystem is affected?
* Is auth affected?
* Is onboarding affected?
* Are profiles affected?
* Is Discover affected?
* Are likes, matches, or messages affected?
* Is membership affected?
* Is Paystack affected?
* Is RLS affected?
* Are migrations required?
* Is storage affected?
* Is Cloudflare deployment affected?
* Are secrets or environment variables affected?
* Are tests required?
* Are performance or accessibility risks present?

If the task is ambiguous, Codex SHOULD ask a targeted clarifying question unless safe assumptions can be made and documented.

---

## 38. Task Completion Standard

A task is not complete until Codex has:

* Implemented the requested change safely.
* Preserved repository invariants.
* Preserved production-critical flows.
* Avoided unrelated changes.
* Validated available commands.
* Documented changed files.
* Documented validation results.
* Documented risks and assumptions.
* Stated any incomplete validation honestly.

Codex MUST optimize for production correctness over speed.

```
```
