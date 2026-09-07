---
name: Vercel Git linking
description: Reliable way to change the GitHub repository connected to a Vercel project in this workspace.
---

Use Vercel's project link endpoint when the CLI cannot be installed:

- `DELETE /v9/projects/{projectId}/link`
- `POST /v9/projects/{projectId}/link` with `{"type":"github","repo":"org/repository"}`

**Why:** The Vercel CLI dependency tree can be blocked by the workspace package firewall, while the REST API remains available with the user's Vercel token.

**How to apply:** Confirm the target project and repository before replacing an existing link, then verify the project's `link` object and the latest deployment metadata after the GitHub push.