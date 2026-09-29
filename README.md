# A.R.N Growth Charitable Trust

A lightweight, responsive static website for A.R.N Growth Charitable Trust.

## Unlisted sanitary pad campaign

Visit `/sanitarypad` directly. Its standalone source is `sanitarypad/index.html`; it has no shared navbar/footer, no inbound site links, and a `noindex, nofollow` meta tag. The page is public to anyone who knows the URL.

The mobile layout has four native swipe carousels with keyboard controls, arrows, position dots, and reduced-motion support. Illustrations and fonts are self-hosted in `assets/sanitarypad/`; `PROMPTS.md` records the image-generation prompts and the font folder includes the open-source licenses. All illustrations follow the first generated hero's gouache-and-pencil style. Campaign statistics and the buy-one-give-one offer are supplied by the reference brief, rather than independently sourced.

The waiting-list dialog submits JSON with `name`, `email`, `contact` (mobile number), `consent`, `source: "sanitarypad"`, and `message` to the separate `WAITLIST_WEBHOOK_URL` in `.env`. It does not change the general contact form endpoint. Success is shown only after an HTTP success response; failed submissions preserve the entered details. Browser tests mock the endpoint and never submit real enquiries.

After changing `WAITLIST_WEBHOOK_URL`, run `node scripts/generate-waitlist-config.cjs` (Node 20.12 or newer). This exports only the public endpoint to `js/sanitarypad-config.js`; it never exposes the rest of `.env`. The local preview server generates it on startup when `.env` is present. For deployment, run that command with `.env` or the host's `WAITLIST_WEBHOOK_URL` environment variable and publish the generated JS alongside the site. The checked-in JS also supports hosts without a build step. Do not publish `.env`.

The current production webhook is `https://n8n.arngct.org/webhook/saniatrypad` (the path spelling matches the configured workflow). Configure its Webhook node for **POST**, accepting JSON, publish/activate the workflow, and allow your exact website origins in **Allowed Origins (CORS)**, including `http://127.0.0.1:5500` and `http://127.0.0.1:4173` for local testing. The original `/webhook-test/` URL only works while **Listen for Test Event** is active and should not be used for ongoing registrations.

If the browser still requests an old webhook after you edit `.env`, run `node scripts/generate-waitlist-config.cjs`, deploy `js/sanitarypad-config.js` and the updated page, then hard-refresh. VS Code Live Server does not read `.env` or run the generator; editing `.env` alone cannot change the endpoint used by a static page. A stopped test webhook can return a 404 without CORS headers, which the browser reports as a CORS failure. Compare the requested URL in the Network panel with the generated config before changing CORS settings.

Clean routing is included for Apache (`.htaccess`, requiring mod_rewrite), Netlify/Cloudflare Pages (`_redirects`), and Vercel (`vercel.json`). Other static servers can serve the `sanitarypad/index.html` directory index; the page normalizes a trailing slash in the address bar. For nginx or a host without directory-index support, internally map the exact `/sanitarypad` route to `/sanitarypad/index.html`. Upload the new assets, page, CSS, JS, and applicable host routing file together. Existing public pages are unchanged.

Preview with `node tests/serve.cjs` and open `http://127.0.0.1:4173/sanitarypad`. Run `node tests/sanitarypad.cjs` with Playwright available to verify phone/desktop layouts, direct-route reload, gestures, keyboard controls, and the waiting-list dialog.

## Local preview

Serve the folder with any static HTTP server (for example, VS Code Live Server or `npx serve .`). Do not open the pages directly from the filesystem: program data is loaded with `fetch` and browsers block that request on `file://` URLs.

## Configuration

Copy `.env.example` to `.env` and set the production values. The static site does not expose or read `.env` in the browser; use these values in your host's environment settings and generate `js/config.js` during deployment if you need live contact or donation integrations.

- `SITE_URL`: canonical public URL.
- `CONTACT_EMAIL`: inbox for enquiries.
- `DONATION_URL`: secure hosted donation checkout URL.
- `CONTACT_FORM_ENDPOINT`: approved form-provider endpoint (such as Formspree).
- `WAITLIST_WEBHOOK_URL`: sanitary pad waiting-list n8n webhook; exported by `scripts/generate-waitlist-config.cjs`.
- `VOLUNTEER_FORM_URL`: hosted volunteer application form.

Never put payment secrets, private API keys, or bank credentials into this static repository.

## Event gallery

`gallery.html` displays photos and videos stored in the **arngct** Supabase project, with category/tag filters and a keyboard-accessible media viewer. The shared header and footer link to it from every public page.

Admins upload and manage media at `adminlogin/gallery.html`, reached through the separate **Gallery images** sidebar link. See `adminlogin/README.md` for upload instructions, access rules, storage limits, and verification details. The Supabase schema and bucket are already provisioned; publish the updated static files through the website's usual hosting workflow to make the new pages available on the live domain.

## Managed programs

Program content is loaded from the arngct Supabase `programs` table. Manage ongoing, upcoming, and completed programs at `/adminlogin/programs.html`. The previous JSON file has been removed, and its existing program was preserved in the database. Public visitors can filter by status; admins can upload program images, edit details, keep drafts, or delete programs.
