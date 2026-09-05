# Admin login

This folder is a standalone `/adminlogin` route for the static site. It contains no registration path or registration link. It signs in against a **separate Supabase project** so that its Auth users and database are isolated from the public site.

## Connect the separate Supabase project

1. Create a new Supabase project specifically for admin authentication (for example, `arn-admin-auth`). Do not reuse a project that powers another application.
2. In **Authentication → Providers**, leave Email enabled and turn off all providers that the admins should not use.
3. In **Authentication → General Configuration**, turn off **Allow new users to sign up**. This is important: hiding a signup link alone does not prevent direct signup API requests.
4. In **Authentication → Users**, add the administrator account manually (or send that person an invitation). Enable email confirmation if the administrator should verify their email first.
5. In **Project Settings → API**, copy the project URL and the publishable key into `config.js`. Do not use a secret or `service_role` key.
6. In **Authentication → URL Configuration**, set the site URL and add the production `https://your-domain/adminlogin/` URL to Redirect URLs.

The login submits credentials only to the dedicated Supabase Auth project via `signInWithPassword`. On success it redirects to the protected `dashboard.html` page. The dashboard validates the current user session and returns visitors without a valid session to the login page.

## Local test

Serve the repository through a local HTTP server, then open `/adminlogin/`. Direct `file://` access is not suitable for authentication requests.

