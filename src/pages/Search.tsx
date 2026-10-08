import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search as SearchIcon, FileText, ArrowRight, X, Clock, Sparkles, Loader2 } from 'lucide-react';
import { useSearchNotes, sanitizeHeadline } from '../hooks/useSearch';
import { formatDistanceToNow } from 'date-fns';

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialQuery = searchParams.get('q') || '';
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  // Sync debounced query and URL search params
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(queryInput);
      if (queryInput.trim()) {
        setSearchParams({ q: queryInput.trim() }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [queryInput, setSearchParams]);

  const { data: results = [], isLoading, isFetching } = useSearchNotes(debouncedQuery);

  const handleClear = () => {
    setQueryInput('');
    setDebouncedQuery('');
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      {/* Header & Search Bar */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
            <SearchIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Search Notes
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Database full-text search across titles and note contents
            </p>
          </div>
        </div>

        {/* Input */}
        <div className="relative">
          <SearchIcon className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Type keywords, phrases, or titles to search..."
            autoFocus
            className="w-full pl-11 pr-20 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {isFetching && (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
            )}
            {queryInput && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="flex-1 flex flex-col">
        {!debouncedQuery.trim() ? (
          <div className="my-auto py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 mx-auto flex items-center justify-center text-slate-400 mb-3">
              <Sparkles className="w-6 h-6 text-indigo-500" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Instant Full-Text Search
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              Search indexing queries your notes using PostgreSQL GIN indexing for fast, ranked search results.
            </p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-800"
              />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="my-auto py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-400 mb-2">
              <SearchIcon className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              No matching notes found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Try different keywords or check for spelling errors.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
              <span>
                Found {results.length} {results.length === 1 ? 'match' : 'matches'} for "{debouncedQuery}"
              </span>
            </div>

            {results.map((result) => (
              <div
                key={result.id}
                onClick={() => navigate(`/note/${result.id}`)}
                className="group p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700/60 hover:shadow-sm cursor-pointer transition flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                      {result.title || 'Untitled'}
                    </h2>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDistanceToNow(new Date(result.updated_at), { addSuffix: true })}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition" />
                  </div>
                </div>

                {result.snippet && (
                  <div
                    className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-6 border-l-2 border-indigo-100 dark:border-indigo-950"
                    dangerouslySetInnerHTML={{ __html: sanitizeHeadline(result.snippet) }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Search;
