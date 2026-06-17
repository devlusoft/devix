---
"@devlusoft/devix": none
---

Bumped baseline to 0.9.0-alpha.1 as major version prep, skipping 0.7.x and 0.8.x alphas. Previous 0.8.0-alpha tags existed in git but never reached npm due to publish failures during the semantic-release era; this release reconciles the npm registry with the actual development trajectory and establishes a clean cadence going forward. Release workflow migrated from semantic-release to changesets with OIDC trusted publishing.