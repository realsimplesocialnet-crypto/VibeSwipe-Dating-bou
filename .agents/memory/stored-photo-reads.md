---
name: Stored-photo reads
description: A sidecar storage upload succeeding does not prove the stored image can be served.
---

Validate both uploading a picture and reading it through the app's authenticated media route.

**Why:** Sidecar-signed uploads succeeded, but newer Google storage/auth libraries attempted project discovery during object reads and failed. A nonempty SDK project identifier avoided discovery for operations on explicit sidecar-authorized buckets. The same previously uploaded picture then returned an image response and decoded in both the avatar and photo gallery.

**How to apply:** When updating storage/auth libraries or restoring storage templates, check the read path too. Do not remove authentication, publish private photos, replace credentials, or treat successful uploads alone as proof that pictures work.
