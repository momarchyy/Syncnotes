# SyncNotes: Supabase & Local Environment Setup Guide

Follow these manual steps to configure your Supabase backend before proceeding to **Phase 1**.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and log in or create a free account.
2. Click **New Project**.
3. Fill in:
   - **Name:** `syncnotes` (or any name you prefer)
   - **Database Password:** Choose a strong password and save it in your password manager.
   - **Region:** Select the region closest to you.
   - **Pricing Plan:** Free tier.
4. Click **Create new project** and wait 1–2 minutes for provisioning to finish.

---

## 2. Run Database Migrations

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar.
2. Click **+ New query**.
3. Open [`supabase/schema_all.sql`](supabase/schema_all.sql) from this repository, copy its entire contents, and paste them into the SQL Editor.
4. Click **Run** (or press `Cmd + Enter` / `Ctrl + Enter`).
5. Confirm the execution succeeds with `Success. No rows returned` (or green checkmark).

> **What this created:**
> - Tables: `profiles`, `user_settings`, `folders`, `notes`, `note_versions`, `tags`, `note_tags`, `attachments`, `drawings`, `note_collaborators`, `comments`, `note_links`, `activity_log`
> - Triggers: automatic profile creation on signup, `updated_at` timestamps, version history snapshots, activity audit log, folder cycle prevention
> - Row Level Security (RLS) on all 13 tables
> - Storage bucket: `note-files` (private, 5 MB limit) with storage RLS policies
> - RPC functions: `save_note` (optimistic concurrency), `restore_version`, `share_note`, `search_notes` (full-text search), `get_folder_path` (recursive CTE), `ping`
> - Realtime publications for `notes`, `drawings`, `comments`, `note_collaborators`
> - Analytics views: `v_note_stats`, `v_notes_per_month`, `v_top_tags`, `v_activity_by_weekday`

---

## 3. Configure Authentication

### Email Provider
1. Go to **Authentication** → **Providers** → **Email**.
2. Ensure **Enable Email provider** is turned **ON**.
3. **Important for testing:** Turn **OFF** **"Confirm email"** (Supabase's built-in email service on the free tier has strict rate limits; disabling confirmation allows instant signups during development).
4. Click **Save**.

### (Optional) Google OAuth Provider
If you want Google Sign-In:
1. In Google Cloud Console, create an OAuth 2.0 Client ID (Web application).
2. Set the Authorized redirect URI to your Supabase callback URL (shown under **Authentication** → **Providers** → **Google** in Supabase, format: `https://<project-ref>.supabase.co/auth/v1/callback`).
3. Copy the **Client ID** and **Client Secret** into the Supabase Google provider settings and toggle **Enable Sign in with Google** to **ON**.

---

## 4. Set Site URL & Redirects

1. Go to **Authentication** → **URL Configuration**.
2. Set **Site URL** to:
   ```
   http://localhost:5173
   ```
3. Under **Redirect URLs**, add:
   ```
   http://localhost:5173/**
   ```
   *(When deploying to production on Vercel later in Phase 12, add your production URL here as well).*
4. Click **Save**.

---

## 5. Copy API Credentials to Local `.env`

1. In the Supabase dashboard, navigate to **Project Settings** (gear icon) → **API**.
2. Find:
   - **Project URL** (e.g. `https://xyzcompany.supabase.co`)
   - **Project API keys** → `anon` `public` key (starts with `eyJ...`)
     *(⚠️ NEVER use the `service_role` key).*
3. In the project root, create a file named `.env` (or copy `.env.example`):
   ```bash
   cp .env.example .env
   ```
4. Paste your values into `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
   ```

---

## 6. Verify Row Level Security (RLS)

1. Open **Table Editor** in the Supabase dashboard.
2. Verify that every single table (`profiles`, `notes`, `folders`, `attachments`, etc.) has an active **RLS** badge displayed next to its name.

---

## 7. Setup Keep-Alive GitHub Secrets (Free Tier Maintenance)

Supabase free-tier projects auto-pause after ~7 days of inactivity. A GitHub Actions workflow ([`.github/workflows/keepalive.yml`](.github/workflows/keepalive.yml)) is included to ping the database every 3 days.

1. Once your repository is pushed to GitHub, go to **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** and add:
   - Name: `SUPABASE_URL` | Value: Your Supabase Project URL
   - Name: `SUPABASE_ANON_KEY` | Value: Your Supabase `anon` public key

---

## 8. Checkpoint Confirmation

Once you have completed steps 1 to 5:
1. Confirm that `.env` contains valid credentials.
2. Reply in Antigravity chat:
   ```
   Supabase setup is complete. Proceed with Phase 1.
   ```
