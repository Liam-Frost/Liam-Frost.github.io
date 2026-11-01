# Security policy

## Supported versions

Security fixes are developed on `dev` and released through `main`. Only the latest
revision on `main` is supported; older commits and tags do not receive separate
security fixes. Deployments should track tested releases from `main`.

## Report a vulnerability privately

Use GitHub's [Report a vulnerability](https://github.com/Liam-Frost/Liam-Frost.github.io/security/advisories/new)
form. Do not open public issues or pull requests containing exploit details before
a fix is available.

Include the affected commit, relevant route or component, prerequisites, expected
and actual behavior, impact, and minimal reproduction steps. Remove passwords,
session cookies, OAuth tokens, personal data and other secrets from reports and logs.

Test only systems and data you own or are explicitly authorized to test. For local
reproduction, use a separate test database and uploads directory. Do not perform
destructive tests or denial-of-service tests against the public site.

Reports are handled on a best-effort basis by a solo maintainer. Please coordinate
public disclosure through the private report after a fix is available. No response
time or bounty is guaranteed.
