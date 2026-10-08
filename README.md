# SyncNotes

A cloud-synced, collaborative note-taking web application built as a Database Management Systems project. All core business logic—authentication, access control, concurrency control, full-text search, and audit history—is enforced directly within PostgreSQL.

---

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Editor & Canvas:** Tiptap (rich-text with custom image & drawing extensions), Perfect-Freehand
- **State & Data Fetching:** TanStack React Query v5
- **Backend & Database:** Supabase (PostgreSQL 15+, Row Level Security, Realtime, Storage)
- **Deployment & Hosting:** Vercel, GitHub Actions (Keep-alive cron)

---

## Key Features

- **Rich Text & Freehand Drawing:** Markdown-compatible rich text, image upload/cropping, and responsive pressure-sensitive freehand drawings/markup.
- **Realtime Collaboration:** Live multi-device note synchronization, shared note permissions (Viewer, Commenter, Editor), and realtime threaded comments.
- **Optimistic Concurrency & Version History:** Version counter checks in `save_note` RPC detect concurrent write conflicts. Automatic snapshot history with one-click restore.
- **Database Full-Text Search:** Substring and prefix searching powered by PostgreSQL `to_tsvector`, GIN indexing, and `ts_headline` match highlighting.
- **Audit Activity & SQL Analytics:** System triggers log every note lifecycle event into `activity_log`. Database views power visual stat cards and productivity charts.
- **Hierarchical Folders & Tags:** Multi-level folder tree navigation and colored tags.

---

## Local Setup

### 1. Prerequisites
- Node.js (v18+)
- npm or pnpm
- Supabase account & project

### 2. Installation
```bash
git clone <repo-url> syncnotes
cd syncnotes
npm install
```

### 3. Environment Configuration
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
*(⚠️ Never use the `service_role` key in frontend code or in `.env`)*

### 4. Database Initialization
Run SQL migration files located in `supabase/migrations/` (from `001_core.sql` through `012_improve_search_notes.sql`) sequentially in the Supabase SQL Editor.

### 5. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Deployment (Vercel)

1. Push your repository to GitHub.
2. In Vercel, click **Add New Project** and import the repository.
3. Configure Environment Variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. The included `vercel.json` ensures client-side routing rewrites all requests to `/index.html`.
5. Update your Supabase Auth settings (**Authentication → URL Configuration**) with your production Vercel domain.
