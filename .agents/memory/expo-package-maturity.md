---
name: Expo package maturity
description: Handling Expo SDK dependency alignment when the expected release is not yet installable.
---

When Expo's package installer requires a just-published package version that the workspace package firewall still blocks for maturity, keep the currently installed compatible version and record the warning. Do not bypass the maturity restriction or force-install the package.

**Why:** The package registry and the workspace's maturity policy can become briefly out of sync immediately after an Expo release.

**How to apply:** Check `expo install --check` and `expo-doctor`; retry only when the blocked package is available through the normal install path.
