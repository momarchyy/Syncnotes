import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search as SearchIcon, 
  FileText, 
  ArrowRight, 
  X, 
  Clock, 
  Sparkles, 
  Loader2, 
  ArrowUpDown, 
  Filter, 
  Star, 
  Archive, 
  Folder as FolderIcon,
  Tag as TagIcon
} from 'lucide-react';
import { useSearchNotes, sanitizeHeadline, type SearchResult } from '../hooks/useSearch';
import { useFolders } from '../hooks/useFolders';
import { useTags } from '../hooks/useTags';
import { formatDistanceToNow } from 'date-fns';

type SortOption = 'relevance' | 'newest' | 'oldest' | 'title_asc' | 'title_desc';
type MatchTarget = 'all' | 'title' | 'content';
type ScopeOption = 'all' | 'favorites' | 'archived';

/**
 * Highlights matches of query within a plain text string.
 */
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <span>{text}</span>;

  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-amber-200/90 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 px-0.5 rounded font-semibold"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </span>
  );
}

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialQuery = searchParams.get('q') || '';
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  // Filter & Sort States
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [matchTarget, setMatchTarget] = useState<MatchTarget>('all');
  const [scope, setScope] = useState<ScopeOption>('all');
  const [selectedTagId, setSelectedTagId] = useState<string>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Metadata for filters
  const { data: folders = [] } = useFolders();
  const { data: tags = [] } = useTags();

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

  const { data: rawResults = [], isLoading, isFetching } = useSearchNotes(debouncedQuery);

  // Filter and Sort results
  const filteredAndSortedResults = useMemo(() => {
    let list = [...rawResults];

    // Filter by match target (title vs content)
    if (matchTarget === 'title') {
      list = list.filter((item) => item.titleMatches);
    } else if (matchTarget === 'content') {
      list = list.filter((item) => item.contentMatches);
    }

    // Filter by scope (favorites / archived)
    if (scope === 'favorites') {
      list = list.filter((item) => item.is_favorite);
    } else if (scope === 'archived') {
      list = list.filter((item) => item.is_archived);
    }

    // Filter by tag
    if (selectedTagId !== 'all') {
      list = list.filter((item) => item.tags?.some((t) => t.id === selectedTagId));
    }

    // Filter by folder
    if (selectedFolderId !== 'all') {
      list = list.filter((item) => item.folder_id === selectedFolderId);
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
      case 'oldest':
        list.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
        break;
      case 'title_asc':
        list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'title_desc':
        list.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        break;
      case 'relevance':
      default:
        list.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
    }

    return list;
  }, [rawResults, matchTarget, scope, selectedTagId, selectedFolderId, sortBy]);

  const activeFiltersCount = (matchTarget !== 'all' ? 1 : 0) +
    (scope !== 'all' ? 1 : 0) +
    (selectedTagId !== 'all' ? 1 : 0) +
    (selectedFolderId !== 'all' ? 1 : 0);

  const handleClear = () => {
    setQueryInput('');
    setDebouncedQuery('');
    setSearchParams({}, { replace: true });
  };

  const resetFilters = () => {
    setMatchTarget('all');
    setScope('all');
    setSelectedTagId('all');
    setSelectedFolderId('all');
    setSortBy('relevance');
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      {/* Header & Search Bar */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
            <SearchIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Search Notes
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Database full-text and partial match search across titles and content
            </p>
          </div>
        </div>

        {/* Input & Action Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search by keywords, titles, or partial words (e.g. 'ol')..."
              autoFocus
              className="w-full pl-11 pr-20 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
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

          {/* Toggle Filter Button */}
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition shrink-0 ${
              showFilters || activeFiltersCount > 0
                ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filter</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter & Sort Controls Panel */}
        {showFilters && (
          <div className="mt-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {/* Sort By */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
                  Sort:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="relevance">Most Relevant</option>
                  <option value="newest">Recently Updated</option>
                  <option value="oldest">Oldest Updated</option>
                  <option value="title_asc">Title (A → Z)</option>
                  <option value="title_desc">Title (Z → A)</option>
                </select>
              </div>

              {/* Match Target */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Target:</span>
                <select
                  value={matchTarget}
                  onChange={(e) => setMatchTarget(e.target.value as MatchTarget)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Title & Content</option>
                  <option value="title">Title Only</option>
                  <option value="content">Content Only</option>
                </select>
              </div>

              {/* Scope */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Status:</span>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as ScopeOption)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Notes</option>
                  <option value="favorites">Favorites Only</option>
                  <option value="archived">Archived Only</option>
                </select>
              </div>

              {/* Tag Filter */}
              {tags.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <TagIcon className="w-3.5 h-3.5 text-indigo-500" />
                    Tag:
                  </span>
                  <select
                    value={selectedTagId}
                    onChange={(e) => setSelectedTagId(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">All Tags</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Folder Filter */}
              {folders.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <FolderIcon className="w-3.5 h-3.5 text-indigo-500" />
                    Folder:
                  </span>
                  <select
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">All Folders</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reset Filters */}
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium ml-auto"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      <div className="flex-1 flex flex-col">
        {!debouncedQuery.trim() ? (
          <div className="my-auto py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 mx-auto flex items-center justify-center text-slate-400 mb-3">
              <Sparkles className="w-6 h-6 text-indigo-500" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Full-Text & Partial Word Search
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              Search by title or content. Partial prefixes like 'ol' will match 'oll', 'rolling', and titles automatically.
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
        ) : filteredAndSortedResults.length === 0 ? (
          <div className="my-auto py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-400 mb-2">
              <SearchIcon className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              No matching notes found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {activeFiltersCount > 0
                ? 'Try resetting your filters or adjusting your search term.'
                : 'Try different keywords or partial words.'}
            </p>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 px-3 py-1.5 text-xs bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg hover:underline font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
              <span>
                Found {filteredAndSortedResults.length} {filteredAndSortedResults.length === 1 ? 'match' : 'matches'} for "{debouncedQuery}"
              </span>
              <span className="text-[11px] text-slate-400">
                Sorted by {sortBy.replace('_', ' ')}
              </span>
            </div>

            {filteredAndSortedResults.map((result: SearchResult) => (
              <div
                key={result.id}
                onClick={() => navigate(`/note/${result.id}`)}
                className="group p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700/60 hover:shadow-sm cursor-pointer transition flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                      <HighlightedText text={result.title || 'Untitled'} query={debouncedQuery} />
                    </h2>

                    {/* Match Badges */}
                    {result.titleMatches && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
                        Title Match
                      </span>
                    )}
                    {result.is_favorite && (
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                    )}
                    {result.is_archived && (
                      <Archive className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDistanceToNow(new Date(result.updated_at), { addSuffix: true })}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition" />
                  </div>
                </div>

                {/* Tags and Folder Badges */}
                {result.tags && result.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pl-6">
                    {result.tags.map((tag) => (
                      <span
                        key={tag.id}
                        style={{ color: tag.color }}
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium"
                      >
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Highlighted Snippet */}
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
