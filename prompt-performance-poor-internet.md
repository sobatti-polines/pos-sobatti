# MASTER TASK: Optimize This Next.js Application for Slow, Unstable, and Offline Networks

You are working inside an existing production-oriented Next.js application.

Your primary objective is:

> Make this application remain fast, responsive, usable, and resilient when users have slow, high-latency, unstable, intermittent, packet-loss, metered, or temporarily offline network connections.

This is NOT a request to blindly "make the website faster."

This is a request to systematically inspect the application, identify real bottlenecks, implement high-impact improvements, and verify that the application behaves well under constrained network conditions.

Use ALL relevant installed skills available in this environment, especially the installed performance, Next.js, PWA/Service Worker, and data-fetching skills.

Do not assume a particular architecture before inspecting the project.

---

## 1. OPERATING PRINCIPLES

Follow these principles throughout the task:

1. Measure before changing things whenever measurement is possible.
2. Prefer evidence over assumptions.
3. Fix the highest-impact bottlenecks first.
4. Do not introduce dependencies unless they solve a real problem.
5. Prefer Next.js native capabilities when they are sufficient.
6. Preserve existing functionality, visual design, routes, authentication, authorization, and business logic.
7. Do not perform cosmetic refactors unrelated to performance or network resilience.
8. Do not optimize for benchmark numbers at the expense of real UX.
9. Never cache private, user-specific, sensitive, authenticated, or mutation responses incorrectly.
10. Every caching strategy must be chosen according to the data's consistency requirements.
11. Every optimization must have a reason.
12. Every major optimization should be verified after implementation.
13. Do not remove features merely because they are expensive without first determining whether they are necessary.
14. Do not blindly apply every recommendation from a skill. Use engineering judgment.
15. Avoid premature optimization.

When uncertain, inspect the existing code and architecture first.

Do NOT ask for confirmation for normal implementation decisions. Make the best technically justified decision and document it.

---

# 2. FIRST: UNDERSTAND THE APPLICATION

Before making changes, inspect:

- package.json
- lockfile
- Next.js version
- React version
- TypeScript configuration
- next.config.*
- middleware/proxy configuration
- app/ or pages/
- server components
- client components
- API routes / route handlers
- Server Actions
- data fetching architecture
- TanStack Query usage, if any
- state management
- image handling
- fonts
- third-party scripts
- analytics
- external APIs
- database access
- authentication
- authorization
- existing caching
- existing service worker/PWA configuration
- CDN/deployment configuration
- environment-specific behavior
- build scripts
- existing performance tooling
- test configuration

Determine whether this is:

- App Router
- Pages Router
- hybrid
- static-heavy
- SSR-heavy
- data-heavy
- dashboard-like
- ecommerce-like
- real-time
- offline-sensitive
- highly interactive

Do not assume.

---

# 3. CREATE A PERFORMANCE + NETWORK BASELINE

Before changing code, inspect the current application and establish a baseline.

Measure or estimate, where possible:

### Loading
- TTFB
- FCP
- LCP
- CLS
- INP
- TBT where useful for lab diagnosis
- initial page weight
- transferred bytes
- compressed JavaScript size
- compressed CSS size
- image transfer size
- font transfer size
- third-party transfer size

### Network behavior
Inspect:

- number of requests
- request waterfalls
- sequential API requests
- duplicate requests
- duplicate data fetching
- unnecessary prefetches
- unnecessary preload
- blocking resources
- requests triggered immediately on page load
- requests triggered by components that are not visible
- large API payloads
- over-fetching
- repeated requests
- requests that could be cached
- requests that could run in parallel

### Runtime behavior
Inspect:

- hydration cost
- unnecessary Client Components
- excessive JavaScript
- large dependencies
- large barrel imports
- expensive client-side computations
- long main-thread tasks
- unnecessary re-renders
- excessive event handlers
- expensive animations
- large lists without virtualization where appropriate

### Assets
Inspect:

- image dimensions
- image formats
- image quality
- oversized images
- missing responsive image behavior
- font loading
- external fonts
- unused fonts
- third-party scripts

Treat findings from static inspection as hypotheses when the page cannot be executed.

---

# 4. DEFINE TARGET NETWORK CONDITIONS

The application must be evaluated conceptually and, where tooling allows, practically under:

### Good connection
- 4G / broadband
- normal latency

### Constrained connection
- slower 4G
- 3G
- high latency
- limited bandwidth

### Very poor connection
- 2G-like behavior
- severe latency
- intermittent connection
- packet loss
- temporary request failures

### Offline
- completely unavailable network

Do not assume that "offline" and "slow network" are the same problem.

They require different strategies.

---

# 5. OPTIMIZE THE CRITICAL PATH

Identify the minimum resources required for the user to understand and interact with the page.

Then optimize for:

1. fastest possible server response
2. smallest possible critical payload
3. earliest useful HTML/UI
4. minimal blocking JavaScript
5. minimal render-blocking CSS
6. fastest LCP resource discovery
7. fastest first interaction
8. minimal hydration work

Do not aggressively preload resources unless the evidence supports it.

Remember that unnecessary preload/prefetch can make constrained-network performance WORSE by competing for bandwidth.

---

# 6. NEXT.JS ARCHITECTURE OPTIMIZATION

Use current Next.js best practices supported by the project's installed version.

Inspect every important Server/Client boundary.

Prefer Server Components when client interactivity is not required.

Minimize unnecessary:

"use client"

boundaries.

Avoid sending large objects across RSC boundaries.

Do not serialize data the client does not need.

Reduce duplicated serialized data.

Avoid unnecessary client-side fetching for initial content when server-side fetching is more appropriate.

Use React cache/deduplication patterns where appropriate.

Eliminate sequential server-side waterfalls.

For independent operations, start them concurrently.

Example principle:

BAD:

await getUser()
await getProducts()
await getNotifications()

GOOD:

const userPromise = getUser()
const productsPromise = getProducts()
const notificationsPromise = getNotifications()

Then resolve only what is needed.

Use Suspense and streaming where they improve progressive rendering.

Do not make the entire page wait for secondary data.

Break large blocking regions into meaningful streaming boundaries.

Use route-level loading.tsx where useful.

Use error.tsx and robust failure states where appropriate.

---

# 7. DATA FETCHING AND API OPTIMIZATION

Audit every data-fetching path.

Look for:

- waterfalls
- duplicate requests
- over-fetching
- unnecessary refetches
- redundant client fetches
- large payloads
- excessive polling
- unnecessary real-time connections
- lack of caching
- inefficient serialization
- poor invalidation
- missing request deduplication

For independent requests, parallelize them.

For data that changes infrequently, introduce appropriate caching/revalidation.

For data that must always be fresh, do NOT introduce stale caching merely to improve benchmark scores.

Choose cache semantics based on business requirements.

---

# 8. TANSTACK QUERY / CLIENT DATA CACHE

If the application already uses TanStack Query, optimize the existing architecture instead of replacing it.

Inspect:

- staleTime
- gcTime
- refetchOnWindowFocus
- refetchOnReconnect
- retry behavior
- duplicate queries
- query key design
- mutation invalidation
- pagination
- infinite queries
- persisted query data

Where appropriate, consider:

- offlineFirst
- persisted cache
- IndexedDB persistence
- background refetching
- stale-while-revalidate behavior
- optimistic updates
- retry with backoff

Do NOT persist sensitive data insecurely.

Do NOT persist authentication secrets or confidential data merely for convenience.

Do NOT add TanStack Query solely because a skill mentions it.

Add it only if it solves an actual architectural problem.

---

# 9. SERVICE WORKER / PWA / OFFLINE STRATEGY

If offline capability provides real value for this application, implement it using an appropriate modern Service Worker/PWA architecture.

Prefer the project's existing PWA approach if one already exists.

If Service Worker support is appropriate, implement carefully:

### Static assets
Use cache-first or precaching where appropriate for versioned static resources.

Examples:

- JS
- CSS
- icons
- fonts
- stable images
- static shell resources

### Public content
Consider stale-while-revalidate when appropriate.

### HTML/navigation
Choose between:

- network-first
- cache-first
- stale-while-revalidate

based on freshness requirements.

### APIs
Do NOT blindly cache all API requests.

Never incorrectly cache:

- user-specific responses
- authenticated private data
- secrets
- highly sensitive information
- mutation responses

For APIs that are safely cacheable, explicitly define appropriate cache behavior.

### Mutations
Do not pretend writes succeeded when they did not.

For offline mutations, only implement background synchronization/queueing if the application's business logic safely supports it.

Never create a fake-success UX for operations that require server confirmation.

### Offline fallback
Implement a useful offline experience.

Examples:

- previously cached page shell
- cached public content
- clear offline state
- retry action
- graceful fallback

Do not make the offline experience more complicated than the product requires.

---

# 10. ADAPTIVE LOADING

Implement adaptive loading ONLY where it provides measurable or practical value.

Consider:

- effective network type
- Save-Data
- device constraints
- reduced motion
- viewport size

But do NOT assume Network Information API support is universal.

Use feature detection and progressive enhancement.

Possible adaptive behavior:

### Better network
Allow:

- richer imagery
- additional non-critical features
- more aggressive prefetching
- enhanced animations
- optional background loading

### Poor network
Prefer:

- smaller images
- fewer non-critical requests
- reduced prefetching
- delayed third-party scripts
- lazy loading
- reduced background work
- simpler media
- fewer optional features

### Save-Data enabled
Respect the user's explicit bandwidth-saving preference.

Do not break the core experience.

---

# 11. PREFETCHING

Audit all Next.js prefetching.

Do not assume prefetching is always beneficial.

On constrained networks, unnecessary prefetching can consume bandwidth that should be reserved for the current page.

Inspect:

- Link prefetch behavior
- manually triggered prefetching
- speculative navigation
- route prediction
- large prefetched RSC payloads

Prefer intent-aware prefetching.

Do not prefetch huge resources merely because navigation might happen.

Where the project can benefit from progressive navigation, use appropriate loading/transition states instead.

---

# 12. IMAGES

Audit every important image.

Optimize:

- format
- dimensions
- quality
- compression
- responsive sizes
- lazy loading
- priority
- fetch priority
- width/height
- placeholders
- CDN delivery

Use Next.js image optimization where appropriate.

Do not ship a 3000–5000 px image to a small mobile card.

Do not lazy-load the main LCP image if that would delay LCP.

Do not mark every image as high priority.

Use high priority only where justified.

Use modern formats where supported.

---

# 13. FONTS

Audit:

- external font requests
- number of font files
- font weights
- font subsets
- loading strategy
- font-display
- unnecessary font families

Prefer local/self-hosted font delivery when appropriate.

Do not preload every font.

Only prioritize critical fonts when evidence supports it.

Avoid unnecessary typography-related network requests.

---

# 14. JAVASCRIPT / BUNDLE OPTIMIZATION

Inspect bundle size.

Identify:

- huge dependencies
- unnecessary dependencies
- duplicate libraries
- large icon packages
- large chart libraries
- editors
- maps
- PDF libraries
- syntax highlighters
- date libraries
- utility libraries
- analytics
- unnecessary client-only dependencies

Use:

- dynamic imports
- route splitting
- component splitting
- feature splitting
- tree shaking
- optimized package imports
- direct imports instead of problematic barrel imports

Do not rewrite working code merely to make the code look different.

Reduce JavaScript where it affects actual loading/runtime cost.

---

# 15. THIRD-PARTY SCRIPTS

Audit every third-party script.

Examples:

- analytics
- tracking
- chat
- customer support
- ads
- maps
- social embeds
- video embeds
- monitoring
- A/B testing

For every third party ask:

1. Is it needed?
2. Is it needed on every page?
3. Is it needed immediately?
4. Can it load after interaction?
5. Can it load after the page becomes idle?
6. Can it be replaced with a lightweight facade?
7. Does it block rendering?
8. How many requests does it create?
9. How much JavaScript does it add?

Never sacrifice critical UX for a non-critical third-party script.

---

# 16. CACHING

Audit all caching layers:

Browser
↓
Service Worker
↓
CDN
↓
Next.js
↓
Application
↓
Database / upstream APIs

Avoid contradictory cache policies.

Use immutable caching for versioned static assets where appropriate.

Use sensible revalidation for public content.

Be especially careful with:

- authenticated content
- personalized pages
- cookies
- authorization
- user-specific APIs
- mutation responses

A fast cache that serves the wrong user's data is a catastrophic bug.

Correctness always wins over cache hit rate.

---

# 17. SERVER RESPONSE AND DELIVERY

Audit:

- TTFB
- CDN usage
- compression
- HTTP caching
- static asset delivery
- edge caching
- response headers
- transfer encoding
- origin latency

Where the deployment platform supports it, optimize delivery through:

- edge/CDN caching
- compression
- HTTP/2 or HTTP/3
- immutable static assets
- efficient cache-control
- reduced origin work

Do not make infrastructure changes that depend on a hosting provider unless the project actually uses that provider.

---

# 18. DATABASE / BACKEND BOTTLENECKS

Performance problems can originate outside the frontend.

Inspect critical backend/database paths where relevant.

Look for:

- N+1 queries
- sequential database calls
- unnecessarily large queries
- duplicate queries
- missing caching
- slow external APIs
- excessive serialization
- unnecessary server-side transformations

If the frontend is waiting 1–3 seconds for a backend operation, reducing a 20 KB JavaScript bundle will not solve the core issue.

Fix the actual bottleneck.

---

# 19. NETWORK FAILURE HANDLING

Make critical user journeys resilient to:

- slow responses
- timeouts
- temporary failures
- connection drops
- DNS failures
- server errors
- retryable API failures
- reconnect events

Use:

- sensible timeouts where appropriate
- AbortController where useful
- exponential backoff
- retry limits
- cancellation
- request deduplication
- stale data when appropriate
- explicit retry UI
- graceful error boundaries

Avoid:

- infinite retries
- aggressive polling
- retry storms
- duplicate mutations
- silent failures
- fake success states

For user-triggered mutations, preserve correctness.

---

# 20. LOADING UX

The interface must remain understandable during slow requests.

Use appropriate:

- skeletons
- pending states
- Suspense
- progressive rendering
- optimistic UI where safe
- disabled/pending controls
- partial content rendering
- retry UI

Avoid huge fullscreen spinners for requests where partial content can be rendered.

Skeletons should roughly match the final content dimensions to reduce layout shifts.

Do not block the whole application because one secondary request is slow.

---

# 21. REAL USER EXPERIENCE PRIORITY

Optimize for:

1. user can see something useful quickly
2. user understands that the application is working
3. user can interact as early as reasonably possible
4. slow secondary features do not block primary tasks
5. previously loaded information remains useful
6. temporary network problems do not destroy the whole UI
7. offline state is understandable
8. retrying is easy
9. data freshness remains correct

Do not optimize solely for Lighthouse-style scoring.

Real user behavior matters.

---

# 22. ACCESSIBILITY AND UX MUST REMAIN INTACT

Performance changes must not break:

- keyboard navigation
- screen readers
- focus management
- semantic HTML
- reduced motion
- accessible loading states
- accessible error messages
- form behavior
- touch interaction

A faster inaccessible page is not an acceptable optimization.

---

# 23. SECURITY REQUIREMENTS

Never weaken security for performance.

Do NOT:

- cache private responses publicly
- expose authentication data
- persist secrets in browser storage
- bypass authorization checks
- remove CSRF protections
- disable security headers without strong justification
- trust cached user state as an authorization mechanism

Service Worker and cache behavior must respect security boundaries.

---

# 24. DO NOT BLINDLY INSTALL EVERYTHING

Before adding a dependency:

1. Check whether the project already solves the problem.
2. Check whether Next.js provides the capability natively.
3. Check whether an installed dependency can already solve it.
4. Estimate bundle/runtime/build impact.
5. Consider maintenance burden.
6. Consider whether the dependency is needed in production or only tooling.

Prefer fewer dependencies.

---

# 25. CODE QUALITY

Changes must be:

- TypeScript-safe
- idiomatic
- maintainable
- minimal
- scoped
- production-ready

Avoid hacks that only improve synthetic benchmarks.

Avoid excessive abstraction.

Avoid creating a large performance framework for a small application.

---

# 26. VERIFICATION LOOP

After implementing changes:

### Build
Run the project's normal production build.

Examples:

npm run build
pnpm build
yarn build
bun run build

Use the package manager already used by the project.

### Type checking
Run the project's existing typecheck command.

### Linting
Run the project's existing lint command.

### Tests
Run relevant tests.

### Performance verification
Repeat the same performance measurements used during the baseline.

Where browser tooling is available, test:

- normal connection
- slow network
- high latency
- offline

Compare before vs after.

---

# 27. REGRESSION CHECK

After optimization, verify that:

- routes still work
- authentication still works
- forms still work
- mutations still work
- API behavior is correct
- personalized data remains private
- service worker does not interfere with updates
- cache invalidation works
- stale data does not persist incorrectly
- offline behavior is graceful
- online recovery works
- navigation still works
- images still work
- fonts still work
- analytics still works where required
- no hydration errors were introduced
- no new console errors appeared

---

# 28. PERFORMANCE BUDGETS

Use realistic budgets based on the actual application and target devices.

Do not enforce arbitrary numbers blindly.

Where appropriate, establish budgets for:

- total transferred bytes
- compressed JavaScript
- CSS
- images
- fonts
- third-party resources
- number of requests
- LCP
- TTFB
- INP

Existing project budgets take precedence.

If no project budgets exist, propose reasonable initial guardrails based on actual application characteristics.

---

# 29. PRIORITIZATION

Classify findings:

### CRITICAL
A bottleneck that substantially harms loading, usability, correctness, or network resilience.

### HIGH
A major issue that should be fixed.

### MEDIUM
A meaningful optimization with moderate impact.

### LOW
A minor optimization or polish item.

Prioritize by:

impact × frequency × user relevance × implementation risk

Do not spend 30 minutes fixing a tiny optimization while a major waterfall remains.

---

# 30. IMPLEMENTATION STRATEGY

Follow this sequence:

PHASE 1
Inspect architecture.

PHASE 2
Measure baseline.

PHASE 3
Identify highest-impact bottlenecks.

PHASE 4
Implement high-impact fixes.

PHASE 5
Implement poor-network resilience.

PHASE 6
Implement PWA/Service Worker only where appropriate.

PHASE 7
Optimize caching and data fetching.

PHASE 8
Optimize bundle/assets.

PHASE 9
Improve loading/error states.

PHASE 10
Run production build/tests.

PHASE 11
Measure again.

PHASE 12
Fix regressions.

PHASE 13
Produce final report.

Do not stop after finding problems.

Actually implement the appropriate fixes.

---

# 31. IMPORTANT: WORK WITH THE EXISTING PROJECT

Do not rewrite the entire application.

Do not migrate frameworks.

Do not replace major libraries unless absolutely necessary.

Do not replace the project's state management merely for performance.

Do not convert every component into Server Components automatically.

Do not add PWA functionality if the application does not benefit from it.

Do not introduce offline mutation queues unless the product semantics support them.

Do not aggressively cache data merely to make the application appear faster.

Do not trade correctness for speed.

---

# 32. FINAL REPORT

When finished, provide a concise but technically detailed report containing:

## A. Architecture Summary
Describe what the application is using.

## B. Baseline
List the important measured metrics before optimization.

## C. Problems Found
List the major bottlenecks and explain their impact.

## D. Changes Implemented
For each major change include:

- file
- change
- reason
- expected impact

## E. Poor Network Strategy
Explain exactly what happens during:

- normal connection
- slow connection
- unstable connection
- offline

## F. Caching Strategy
Explain:

- browser caching
- Service Worker caching
- Next.js caching
- API/data caching
- invalidation strategy

## G. Performance Results
Provide before/after measurements where available.

Do not fabricate measurements.

If a metric could not be measured, explicitly label it as:

"Hypothesis — not directly measured."

## H. Remaining Bottlenecks
Clearly identify anything that still limits performance.

## I. Risks / Tradeoffs
Explain any tradeoffs introduced by caching, persistence, PWA, prefetching, or adaptive behavior.

## J. Verification
State exactly which commands/tests/builds were run.

---

# 33. FINAL SUCCESS CRITERIA

Consider the task successful only when all of the following are true where applicable:

- initial payload has been minimized
- unnecessary requests have been removed
- request waterfalls have been reduced
- critical data fetches are parallelized
- unnecessary Client Components are reduced
- large client bundles are split
- images are appropriately optimized
- fonts are appropriately optimized
- unnecessary prefetching is reduced
- third-party scripts are controlled
- caching is intentional
- private data is not incorrectly cached
- slow requests have graceful loading states
- request failures have graceful recovery
- offline behavior is handled where appropriate
- previously available content remains useful when possible
- Service Worker behavior is correct where implemented
- application functionality remains intact
- production build succeeds
- tests/typecheck/lint succeed where available
- performance has been re-measured after changes
- no optimization is justified only by guesswork when measurable evidence was available

---

# 34. MOST IMPORTANT RULE

Do not optimize blindly.

Think like a performance engineer.

The correct question is not:

"How can I add more optimization?"

The correct question is:

"What is currently making this application slow for users on constrained networks, and what is the smallest reliable engineering change that produces a meaningful improvement?"

Measure it.
Find it.
Fix it.
Measure again.
Keep the improvement.
Reject changes that do not provide meaningful value.
