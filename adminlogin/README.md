# Admin login

This folder is a standalone `/adminlogin` route for the static site. It contains no registration path or registration link. Authentication and gallery content use the **arngct** Supabase project (`cceozfitsruqzvybzuey`). Stride data remains in its separate running project.

## Authentication configuration

1. Use the existing **arngct** project for admin authentication and gallery storage.
2. In **Authentication → Providers**, leave Email enabled and turn off all providers that the admins should not use.
3. In **Authentication → General Configuration**, turn off **Allow new users to sign up**. This is important: hiding a signup link alone does not prevent direct signup API requests.
4. In **Authentication → Users**, add the administrator account manually (or send that person an invitation). Enable email confirmation if the administrator should verify their email first.
5. In **Project Settings → API**, copy the project URL and the publishable key into `config.js`. Do not use a secret or `service_role` key.
6. In **Authentication → URL Configuration**, set the site URL and add the production `https://your-domain/adminlogin/` URL to Redirect URLs.

The login submits credentials only to the dedicated Supabase Auth project via `signInWithPassword`. On success it redirects to the protected `dashboard.html` page. The dashboard validates the current user session and returns visitors without a valid session to the login page.

## Local test

Serve the repository through a local HTTP server, then open `/adminlogin/`. Direct `file://` access is not suitable for authentication requests.

## Gallery images

Open **Gallery images** below Stride in the sidebar. It is an independent page at `/adminlogin/gallery.html`.

1. Select or drag in multiple photos and videos (up to 50 MB per file).
2. Choose existing event/category tags from the dropdown, or choose **Add new tag**. Click **Apply to all**, or choose different tags per file. Each file requires an internal description and 1–8 tags; tags are normalized to lowercase. Descriptions/file names are not shown on the public gallery.
3. Click **Upload & publish**. Files upload using TUS with progress and retries. Keep the page open until the batch finishes. Successful files automatically leave the queue and release their local previews. Failed files remain available to retry.
4. Use the media library to edit titles/tags or delete media from both the gallery and storage.

JPEG, PNG, WebP, GIF, MP4, WebM and MOV are accepted. MP4/WebM is recommended for browser playback. All media is intended for public display; the Storage bucket is public. Unfinished uploads are excluded from the public gallery listing and can be removed from the admin library. The file URL itself is public once uploaded.

Media bytes live in the `gallery-media` Storage bucket; titles, tags, paths and publication state live in `public.gallery_media`. The deployed schema is recorded in `../supabase/gallery-schema.sql` (remote migration: `add_event_gallery`). Browser settings are in `../js/gallery-config.js`; these contain only a publishable key.

Database and Storage policies require the server-controlled Auth `app_metadata.role` to equal `admin` for writes. The existing administrator already has this role. Any future gallery administrator must receive this role through trusted Supabase administration; user-editable metadata is never used for permissions.

## Verification

`tests/gallery.cjs` uses Playwright against a local server on port 4173 (`GALLERY_TEST_URL` can override it). Run `node tests/gallery.cjs` with `playwright` resolvable by Node. The browser channel defaults to `msedge`; set `PLAYWRIGHT_CHANNEL` to another installed Chromium channel if needed. The tests make a live anonymous read, verify the login redirect, and intercept every test API write. They cover tags, pagination, image/video viewing, batch upload, failed-publication retry, editing, deletion, file limits, mobile overflow and script errors. Screenshots go into the ignored `tests/output/` directory.

Live database checks verified admin access, anonymous publication visibility, non-admin write denial, and rollback cleanup. The Supabase security advisor reported no gallery findings; the existing project warning about disabled leaked-password protection remains unchanged.

## Programs

The independent **Programs** sidebar link below Gallery images opens `/adminlogin/programs.html`. Create, edit, or delete programs and choose **Ongoing**, **Upcoming / future**, or **Completed**. Add a description, location, schedule, and either an image URL or an uploaded JPG/PNG/WebP (up to 5 MB). Published programs appear on the website; drafts are visible only to admins.

Program records use `public.programs` in **arngct**. Uploaded program pictures use its `program-images` bucket. The original tree-planting program was migrated into the database by `add_managed_programs`; the JSON file and JSON loading code were removed. The schema is recorded in `../supabase/programs-schema.sql`.

Run `node tests/serve.cjs` for a preview, then `node tests/programs.cjs` for browser checks (with Playwright resolvable by Node). Live tests only read data; write tests use intercepted API fixtures. Gallery tests additionally verify hidden names, the glass viewer, playing videos without controls, tag creation/selection, and successful upload queue clearing.
