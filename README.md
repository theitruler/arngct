# A.R.N Growth Charitable Trust

A lightweight, responsive static website for A.R.N Growth Charitable Trust.

## Local preview

Serve the folder with any static HTTP server (for example, VS Code Live Server or `npx serve .`). Do not open the pages directly from the filesystem: program data is loaded with `fetch` and browsers block that request on `file://` URLs.

## Configuration

Copy `.env.example` to `.env` and set the production values. The static site does not expose or read `.env` in the browser; use these values in your host's environment settings and generate `js/config.js` during deployment if you need live contact or donation integrations.

- `SITE_URL`: canonical public URL.
- `CONTACT_EMAIL`: inbox for enquiries.
- `DONATION_URL`: secure hosted donation checkout URL.
- `CONTACT_FORM_ENDPOINT`: approved form-provider endpoint (such as Formspree).
- `VOLUNTEER_FORM_URL`: hosted volunteer application form.

Never put payment secrets, private API keys, or bank credentials into this static repository.
