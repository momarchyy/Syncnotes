# SyncNotes Code Map

## Where to Look
| Feature | Files |
| :--- | :--- |
| **auth** | `src/contexts/AuthContext.tsx`, `src/hooks/useAuth.ts`, `src/pages/Auth.tsx`, `src/components/layout/ProtectedRoute.tsx`, `supabase/migrations/001_core.sql`, `supabase/migrations/002_security.sql` |
| **autosave** | `src/components/editor/NoteEditor.tsx`, `src/hooks/useNotes.ts`, `supabase/migrations/003_logic.sql`, `supabase/migrations/007_fix_save_note.sql` |
| **realtime** | `src/hooks/useNotes.ts`, `src/components/editor/NoteEditor.tsx`, `src/hooks/useComments.ts`, `src/components/editor/DrawingCanvas.tsx`, `src/components/editor/NoteAnnotationLayer.tsx`, `supabase/migrations/003_logic.sql` |
| **images** | `src/lib/imageUpload.ts`, `src/lib/signedUrlCache.ts`, `src/components/editor/ImageCropModal.tsx`, `src/components/editor/StorageImageNode.tsx`, `supabase/migrations/008_storage_setup.sql` |
| **drawing** | `src/components/editor/DrawingCanvas.tsx`, `src/components/editor/DrawingNode.tsx`, `src/components/editor/NoteAnnotationLayer.tsx`, `supabase/migrations/001_core.sql` |
| **versions** | `src/hooks/useVersions.ts`, `src/components/editor/VersionHistoryDrawer.tsx`, `src/components/editor/ConflictDialog.tsx`, `supabase/migrations/009_version_interval_10s.sql`, `supabase/migrations/010_fix_restore_version.sql`, `supabase/migrations/011_sequential_snapshot_numbering.sql` |
| **sharing** | `src/hooks/useCollaborators.ts`, `src/components/editor/ShareModal.tsx`, `supabase/migrations/002_security.sql`, `supabase/migrations/006_fix_notes_policies.sql` |
| **comments** | `src/hooks/useComments.ts`, `src/components/editor/CommentsDrawer.tsx`, `supabase/migrations/001_core.sql`, `supabase/migrations/002_security.sql`, `supabase/migrations/003_logic.sql` |
| **search** | `src/hooks/useSearch.ts`, `src/pages/Search.tsx`, `src/pages/Notes.tsx`, `supabase/migrations/001_core.sql`, `supabase/migrations/003_logic.sql` |
| **activity** | `src/hooks/useActivity.ts`, `src/pages/Activity.tsx`, `supabase/migrations/001_core.sql`, `supabase/migrations/002_security.sql`, `supabase/migrations/003_logic.sql` |
| **analytics** | `src/hooks/useAnalytics.ts`, `src/pages/Analytics.tsx`, `supabase/migrations/004_views.sql` |

---

## File Index

### `src/`
- `src/App.tsx`: Root React router and global provider composition (`App`).
- `src/index.css`: Global Tailwind CSS rules and base layout styles.
- `src/main.tsx`: Application entry point mounting root React DOM tree.
- `src/vite-env.d.ts`: TypeScript compiler declarations for Vite client environment variables.

### `src/contexts/`
- `src/contexts/AuthContext.tsx`: Supabase authentication state management and session provider (`AuthContext`, `AuthProvider`, `useAuthContext`).

### `src/hooks/`
- `src/hooks/useActivity.ts`: React Query hook fetching paginated user activity events (`useActivityLog`).
- `src/hooks/useAnalytics.ts`: React Query hook aggregating statistics from views (`useAnalytics`).
- `src/hooks/useAuth.ts`: Convenience wrapper hook consuming the authentication context (`useAuth`).
- `src/hooks/useCollaborators.ts`: React Query hooks for collaborator management and role checks (`useCollaborators`, `useAddCollaborator`, `useUpdateCollaboratorRole`, `useRemoveCollaborator`, `useNoteRole`).
- `src/hooks/useComments.ts`: React Query hooks and realtime subscriptions for note discussion threads (`useNoteComments`, `useAddComment`, `useDeleteComment`).
- `src/hooks/useFolders.ts`: React Query hooks for folder CRUD operations and folder breadcrumbs (`useFolders`, `useFolder`, `useFolderPath`, `useCreateFolder`, `useUpdateFolder`, `useDeleteFolder`).
- `src/hooks/useNotes.ts`: React Query hooks for note querying, filtering, mutations, and realtime sync (`useNotes`, `useNote`, `useCreateNote`, `useUpdateNote`, `useSaveNote`, `useTrashNote`, `useRestoreNote`, `useDeleteNotePermanently`, `useSetNoteFolder`, `useNotesRealtime`).
- `src/hooks/useSearch.ts`: React Query hook for full-text search RPC and headline sanitizer (`useSearchNotes`, `sanitizeHeadline`).
- `src/hooks/useTags.ts`: React Query hooks for creating, deleting, and assigning tags to notes (`useTags`, `useNoteTags`, `useCreateTag`, `useDeleteTag`, `useAddTagToNote`, `useRemoveTagFromNote`).
- `src/hooks/useVersions.ts`: React Query hooks for fetching note snapshot history and restoring past versions (`useNoteVersions`, `useRestoreVersion`).

### `src/lib/`
- `src/lib/imageUpload.ts`: Client-side image validation, WebP compression, and Supabase Storage upload helpers (`validateImage`, `compressToWebP`, `uploadNoteImage`).
- `src/lib/signedUrlCache.ts`: In-memory caching layer with TTL expiration for Supabase private storage signed URLs (`getCachedSignedUrl`, `cacheSignedUrl`, `getOrFetchSignedUrl`).
- `src/lib/supabase.ts`: Supabase client singleton initialized with environment variables (`supabase`).

### `src/types/`
- `src/types/database.ts`: TypeScript type definitions matching the PostgreSQL schema and RPC signatures (`Database`, `Tables`, `Enums`, `Json`).

### `src/pages/`
- `src/pages/Activity.tsx`: Audit trail view grouping note operations and version edits by date (`Activity`).
- `src/pages/Analytics.tsx`: Metrics view displaying stat cards and SVG/CSS charts for notes and tag activity (`Analytics`).
- `src/pages/Auth.tsx`: User authentication view for sign-in, registration, and OAuth flows (`Auth`).
- `src/pages/Notes.tsx`: Main dashboard managing the note list, search/filter views, and note editor mounting (`Notes`).
- `src/pages/Search.tsx`: Dedicated full-text search page with debounced query and highlighted snippets (`Search`).

### `src/components/layout/`
- `src/components/layout/Layout.tsx`: Root dashboard shell organizing top bar, sidebar, and child route outlets (`Layout`).
- `src/components/layout/ProtectedRoute.tsx`: Route guard redirecting unauthenticated sessions to `/auth` (`ProtectedRoute`).
- `src/components/layout/Sidebar.tsx`: Navigation sidebar with system views, folder tree navigation, and tag filters (`Sidebar`).
- `src/components/layout/TopBar.tsx`: Top header navigation bar with user profile menu and mobile sidebar toggle (`TopBar`).

### `src/components/notes/`
- `src/components/notes/NoteCard.tsx`: Card item presenting note summary, tags, pinned status, and action menus (`NoteCard`).

### `src/components/editor/`
- `src/components/editor/CommentsDrawer.tsx`: Slide-over drawer interface for viewing, submitting, and deleting note comments (`CommentsDrawer`).
- `src/components/editor/ConflictDialog.tsx`: Modal dialog for resolving concurrent edit conflicts between local and remote versions (`ConflictDialog`).
- `src/components/editor/DrawingCanvas.tsx`: Full-screen collaborative canvas for freehand sketches with brush and color tools (`DrawingCanvas`).
- `src/components/editor/DrawingNode.tsx`: Tiptap custom Node extension embedding inline vector sketches inside documents (`DrawingNode`).
- `src/components/editor/ImageCropModal.tsx`: Modal dialog enabling users to crop and rotate images before upload (`ImageCropModal`).
- `src/components/editor/NoteAnnotationLayer.tsx`: Transparent drawing canvas overlay allowing users to annotate notes directly (`NoteAnnotationLayer`).
- `src/components/editor/NoteEditor.tsx`: Main editor container integrating Tiptap, toolbar, autosave, and drawer dialogs (`NoteEditor`).
- `src/components/editor/ShareModal.tsx`: Modal dialog to invite collaborators by email and assign Viewer/Editor permissions (`ShareModal`).
- `src/components/editor/StorageImageNode.tsx`: Tiptap custom Node extension that resolves and displays secure signed images (`StorageImageNode`).
- `src/components/editor/Toolbar.tsx`: Formatting toolbar supporting rich text styles, lists, images, and drawing triggers (`Toolbar`).
- `src/components/editor/VersionHistoryDrawer.tsx`: Slide-over drawer showing snapshot history with diff comparison and version restore (`VersionHistoryDrawer`).

### `src/components/ui/`
- `src/components/ui/ErrorBoundary.tsx`: React error boundary component providing a graceful error recovery fallback (`ErrorBoundary`).
- `src/components/ui/Modal.tsx`: Accessible dialog wrapper supporting keyboard dismissal, backdrop, and transitions (`Modal`).
- `src/components/ui/Toast.tsx`: Application toast notification provider and hook (`ToastProvider`, `useToast`).

### `supabase/migrations/`
- `supabase/migrations/001_core.sql`: Schema definitions for core tables (`profiles`, `notes`, `folders`, `tags`, `drawings`, `comments`, `note_collaborators`).
- `supabase/migrations/002_security.sql`: Row-Level Security (RLS) policies defining ownership and role-based collaborator access.
- `supabase/migrations/003_logic.sql`: Stored functions, triggers, activity log events, and full-text search indexing.
- `supabase/migrations/004_views.sql`: Database view `notes_with_details` aggregating note tags and collaborators.
- `supabase/migrations/005_grants.sql`: Permission grants on schemas, tables, and routines for authenticated and anon roles.
- `supabase/migrations/006_fix_notes_policies.sql`: Fix for recursive RLS policy loops on `notes` and `note_collaborators`.
- `supabase/migrations/007_fix_save_note.sql`: Stored procedure `save_note` handling optimistic concurrency checks and snapshot creation.
- `supabase/migrations/008_storage_setup.sql`: Storage bucket configuration and security policies for `note-attachments`.
- `supabase/migrations/009_version_interval_10s.sql`: Adjusted version history snapshot capture throttle interval to 10 seconds.
- `supabase/migrations/010_fix_restore_version.sql`: Stored procedure `restore_note_version` and RLS permission fixes for note restoration.
- `supabase/migrations/011_sequential_snapshot_numbering.sql`: Stored procedure snapshot interval set to 1 minute with continuous version numbering.
