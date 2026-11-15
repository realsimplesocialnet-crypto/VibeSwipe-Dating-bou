---
name: Server validation in the pnpm workspace
description: Why standalone server integration checks must preserve workspace dependency resolution.
---

Bundle workspace-owned dependencies when running standalone server integration checks. Do not externalize the entire package graph unless each import can resolve from the runner's package.

**Why:** Strict pnpm package isolation made a validation harness fail before executing: dependencies declared by the database package were not visible from the API package. Bundling ordinary workspace dependencies while explicitly externalizing native runtimes resolved this.

**How to apply:** Follow the server's bundling strategy for integration runners. Distinguish a harness import failure from a failing application check; do not install duplicate packages or bypass dependency safeguards to hide it.
