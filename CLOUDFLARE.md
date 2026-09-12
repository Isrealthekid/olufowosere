# Cloudflare Workers deployment

This project deploys a Worker named `olufowosere`, serving static assets plus a persistent portfolio API.

Keep these settings in the connected GitHub project's Cloudflare dashboard:

- Root directory: `/`
- Deploy command: `npx wrangler deploy`
- Version command: `npx wrangler versions upload`
- Build command: can remain empty, because `wrangler.jsonc` runs `npm run build` before deployment. Setting it to `npm run build` is also safe, but repeats the build.

`wrangler.jsonc` selects `dist` as the public directory and `worker.mjs` as the API entry point. The build generates public chat and settings snapshots. They seed a fresh deployment and provide a read-only fallback when the API cannot be reached.

Commit and push the deployment changes to the connected production branch to trigger Cloudflare. These local files do not affect production until that deployment finishes.

The `PORTFOLIO_DATA` Durable Object binding and `v1` SQLite migration create persistent storage on deployment. Keep `ADMIN_PASSWORD` configured as a Worker runtime secret. `PORT` is only used by the local Node server.

Production admin edits and contact replies live in the Durable Object, not the GitHub JSON files. Redeploying code does not overwrite saved production settings or chats. On the first request, bundled data seeds any missing settings or chat record. Use `/admins` to change production content after deployment.

The contact inbox is private, authenticated, capped at 500 replies, and supports deletion. Sending is rate-limited, same-origin, and idempotent. The reply is acknowledged only after storage succeeds. Contact messages are not forwarded to email.

Photos uses Google's embedded folder view. In `/admins`, set a Google Drive folder URL and share the folder as “Anyone with the link” with Viewer access. The design gallery fetches directly from Google Drive; there is no API key or private account connection. CV accepts one public HTTPS document link. GitHub and project links are editable alongside the visitor contact prompt.

Validate with `npm test`, `npx wrangler deploy --dry-run`, and optionally `npx wrangler dev --local --port 8787`. `node tests/worker-check.mjs` checks a running local Worker. Do not run that check against production.

Do not upload `.env` or set the repository root as the assets directory.

Photos now uses the Drive files.list API and a native grid, replacing embeddedfolderview. Enable Google Drive API in a Google Cloud project and set GOOGLE_DRIVE_API_KEY as a Cloudflare Worker secret (and in .env for local use). Restrict the key to Google Drive API. The key never appears in public settings. The configured folder and images must allow public viewing. Listings are cached for five minutes; selecting a photo opens the on-page viewer.

