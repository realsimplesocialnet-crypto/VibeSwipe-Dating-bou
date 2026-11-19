---
name: Development schema prompts
description: Handling Drizzle's interactive schema-conflict prompts in the non-interactive workspace shell.
---

When `drizzle-kit push` stops at an interactive schema/table conflict in the workspace shell, do not switch to `push-force`. Inspect the actual development schema and apply only the specifically approved additive change through a safe, reviewable path; verify columns, foreign keys, and indexes afterward. Do not use a narrow `tablesFilter` to work around the prompt: Drizzle treats excluded tables as absent and may propose recreating unrelated tables or replacing constraints.

**Why:** The development database has existing schema details that can make Drizzle's table resolver request a rename decision. The normal command exits in the non-TTY shell, force mode could make a destructive choice without review, and filtering the live schema can produce a misleading diff.

**How to apply:** Before changing schema, compare the full Drizzle model with development tables and constraints. Keep production untouched unless separately approved; do not assume an interactive prompt is permission to rename or drop data. Treat repeated default-only diffs as a representation mismatch until verified, and never force them.
