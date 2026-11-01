# Repository maintenance

## Local quality checks

Use Node.js 22.22 or newer; GitHub Actions uses Node 22. From a clean checkout:

```sh
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

`npm run format` establishes the formatting baseline. Prettier skips generated
clients, build outputs, uploads, the lockfile, local agent configuration and
historical review records. ESLint checks recommended JavaScript/TypeScript rules
and React Hooks correctness. Intentional hook dependency exceptions must keep an
explanation; unused suppression directives fail the lint check.

The `CI` workflow runs for pushes to `main` and `dev`, and PRs targeting either
branch. Its stable required check name is `Quality checks`. The existing Docker
workflow builds the production image and checks the stack on `dev` pushes and PRs
to `main`; its check name is `smoke`. CI never uses production secrets or a
production database. Pages deployment remains separate and disables API fetching.

## GitHub settings

- `protect-main`: target `main`; require a PR with zero required approvals, passing
  `Quality checks` and `smoke`, and an up-to-date branch. Block deletion and force
  pushes. Keep the bypass list empty for routine administrator work as well.
- `protect-dev`: target `dev`; block deletion and force pushes, with no bypass
  actors. Direct ordinary pushes are allowed for the existing development flow.
- Dependabot alerts, security updates, secret scanning, push protection and private
  vulnerability reporting should remain enabled.
- CodeQL uses GitHub default setup. Do not also add a competing advanced workflow.
- Keep automatic deletion of head branches disabled while `dev` is long-lived.

Check names must match the names reported by Actions, not workflow filenames.
New required checks cannot pass until the workflow is pushed and runs on the PR.

## Dependency maintenance

`.github/dependabot.yml` checks the root npm workspace lockfile and Actions every
Monday at 09:00 Asia/Shanghai. Version updates group Prisma packages together,
React packages together, other minor/patch updates together, and Actions together.
Other major npm updates remain separate. Security updates have a separate group.
No automatic merge is configured; review release notes and passing checks.

The configuration deliberately targets the default branch. Dependabot security
updates need the configuration on `main`; it takes effect after the PR is merged.
Bring dependency changes from `main` back into `dev` before continuing development.

## Security review: 2026-11-01

GitHub CodeQL initially reported ten open alerts:

- **#10, polynomial regex in `normalizeAdminPath`: fixed locally.** Replace the
  potentially quadratic trailing-slash regex with two linear scans. Regression
  coverage includes long valid slash runs, invalid suffixes and all-slash input.
- **#8 and #9, incomplete HTML removal in imported descriptions:** remove complete
  tags and then remaining angle brackets so nested malformed tags cannot form
  markup after replacement. Steam import coverage includes nested hostile tags.
  Consumers still render these values as React text or textarea values. A future
  HTML rendering feature must use a maintained sanitizer; this cleanup is intended
  for plain-text display, not arbitrary HTML output.
- **#1–#7, missing rate limiting:** register `@fastify/rate-limit` before defining
  routes. The default is 600 requests per minute per client, shared across routes,
  including public/admin assets, metadata, login and logout. Health probes are
  exempt. Login retains its stricter eight-attempts-per-15-minute limiter. The
  regression test verifies a shared budget, `429`, `Retry-After`, IP isolation and
  health availability. Use the configured trusted proxy boundary so clients are
  identified correctly; IPv6 uses the plugin's subnet grouping. The in-memory
  bounded LRU store is single-instance protection, not distributed DDoS protection.
  Reassess limits for shared-IP visitors and normal asset bursts before VPS launch.

No alerts were automatically dismissed. Main-branch alert status updates after the
merged change is analyzed; PR checks validate the proposed fixes first. The scan
results are not a complete application security audit.

Dependency audit at this stage: production dependencies have zero reported
vulnerabilities. The complete tree reports twelve moderate affected packages
propagating one minimatch advisory, GHSA-g3hv-75wg-m249 (glob-parts amplification).
It is in the development lint toolchain. The installed supported ESLint and
TypeScript ESLint releases still depend on affected minimatch versions. Avoid an
untested cross-major override or `npm audit fix --force`; track upstream compatible
updates through Dependabot. Lint consumes repository-controlled patterns, but this
does not erase the advisory.

## Pending Pages HTTPS

The Pages API reports `www.twilightfrosty.com` as the custom domain and no issued
HTTPS certificate. Enabling enforcement returned `The certificate does not exist
yet`. Check **Settings → Pages** for DNS/certificate errors, compare the domain's
DNS records with GitHub's instructions, and enable **Enforce HTTPS** after issuance.
Do not remove or replace DNS records without checking the current records and
other services using the domain. HTTPS enforcement has not been completed.

GitHub's DNS health check confirms both the `www` domain and apex are proxied
through Cloudflare and currently reports `is_https_eligible: false`. The Cloudflare
DNS owner needs to review the origin records and proxy settings. GitHub recommends
the `www` CNAME point directly to `Liam-Frost.github.io`, rather than to the apex.
See [GitHub's domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
and [certificate troubleshooting](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

## Deployment boundary

This maintenance stage does not configure a VPS, production secrets, backups,
monitoring, container publishing or production releases. Those tasks remain in the
deployment plan. A release number alone would not provide a tested rollback path.
