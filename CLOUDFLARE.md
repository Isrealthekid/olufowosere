# Cloudflare Workers deployment

This project currently deploys a static-assets Worker named `olufowosere`.

Keep these settings in the connected GitHub project's Cloudflare dashboard:

- Root directory: `/`
- Deploy command: `npx wrangler deploy`
- Version command: `npx wrangler versions upload`
- Build command: can remain empty, because `wrangler.jsonc` runs `npm run build` before deployment. Setting it to `npm run build` is also safe, but repeats the build.

`wrangler.jsonc` selects `dist` as the public directory. The build generates `dist/published-chats.js` from `data/chats.json`. The browser reads this published snapshot when `/api/chats` is unavailable, so a static deployment can display the complete timeline.

Commit and push the deployment changes to the connected production branch to trigger Cloudflare. These local files do not affect production until that deployment finishes.

This fixes public message display only. `server.mjs` is the local Node server; Workers does not run it with `npm start` in this static configuration. `PORT` is not used. `ADMIN_PASSWORD` alone does not enable an admin backend. Production admin saves require a Worker API and persistent storage, which are not included in this static deployment.

Do not upload `.env` or set the repository root as the assets directory.
