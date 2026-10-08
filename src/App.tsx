export function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 border border-slate-200 dark:border-slate-700 text-center">
        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">SyncNotes</h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">
          Phase 0 scaffold is ready. Complete the Supabase setup steps in <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-xs">SETUP.md</code> to proceed to Phase 1.
        </p>
        <div className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-700 pt-4">
          Postgres • RLS • Realtime • Tiptap • Canvas
        </div>
      </div>
    </div>
  );
}

export default App;
