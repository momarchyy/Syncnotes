import { useMemo } from 'react';
import { 
  BarChart2, 
  FileText, 
  Calendar, 
  Star, 
  Archive, 
  Trash2, 
  BookOpen, 
  Tag as TagIcon,
  TrendingUp,
  Activity as ActivityIcon
} from 'lucide-react';
import { useAnalytics } from '../hooks/useAnalytics';
import { format, parseISO } from 'date-fns';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Analytics() {
  const { data, isLoading } = useAnalytics();

  const stats = data?.stats;
  const notesPerMonth = data?.notesPerMonth || [];
  const topTags = data?.topTags || [];
  const weekdayActivity = data?.activityByWeekday || [];

  // Max value calculations for normalized charts
  const maxMonthly = useMemo(() => {
    if (!notesPerMonth.length) return 1;
    return Math.max(...notesPerMonth.map((m) => m.notes_created), 1);
  }, [notesPerMonth]);

  // Map 0-6 weekday activity
  const fullWeekdayData = useMemo(() => {
    const map = new Map<number, number>();
    weekdayActivity.forEach((item) => {
      map.set(item.weekday, item.actions);
    });

    return WEEKDAYS.map((name, idx) => ({
      name,
      weekday: idx,
      actions: map.get(idx) || 0,
    }));
  }, [weekdayActivity]);

  const maxWeekday = useMemo(() => {
    return Math.max(...fullWeekdayData.map((d) => d.actions), 1);
  }, [fullWeekdayData]);

  const maxTagCount = useMemo(() => {
    if (!topTags.length) return 1;
    return Math.max(...topTags.map((t) => t.note_count), 1);
  }, [topTags]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full animate-pulse space-y-6">
        <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-800" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
          <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
          <BarChart2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Note Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Database-aggregated metrics and productivity insights
          </p>
        </div>
      </div>

      {/* 6 Key Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Notes</span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white">
            {stats?.total_notes ?? 0}
          </span>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">This Month</span>
            <Calendar className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white">
            {stats?.notes_this_month ?? 0}
          </span>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Favorites</span>
            <Star className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white">
            {stats?.favorites ?? 0}
          </span>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Archived</span>
            <Archive className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white">
            {stats?.archived ?? 0}
          </span>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">In Trash</span>
            <Trash2 className="w-4 h-4 text-rose-500" />
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white">
            {stats?.in_trash ?? 0}
          </span>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Words</span>
            <BookOpen className="w-4 h-4 text-violet-500" />
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white">
            {Number(stats?.total_words ?? 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Two Column Visual Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Note Creation Chart */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Notes Created Per Month
            </h2>
          </div>

          {notesPerMonth.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400 py-12">
              No historical monthly data recorded yet.
            </div>
          ) : (
            <div className="flex-1 flex items-end gap-3 pt-6 pb-2 min-h-[180px]">
              {notesPerMonth.map((item) => {
                const heightPercent = Math.max(8, Math.round((item.notes_created / maxMonthly) * 100));
                const monthLabel = format(parseISO(item.month), 'MMM yy');

                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition">
                      {item.notes_created}
                    </span>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[40px] bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-t-md transition-all duration-300"
                    />
                    <span className="text-[10px] text-slate-400 font-medium">
                      {monthLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity by Day of Week Chart */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <ActivityIcon className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Activity by Day of Week
            </h2>
          </div>

          <div className="flex-1 flex items-end gap-3 pt-6 pb-2 min-h-[180px]">
            {fullWeekdayData.map((d) => {
              const heightPercent = maxWeekday > 0 ? Math.max(6, Math.round((d.actions / maxWeekday) * 100)) : 6;

              return (
                <div key={d.name} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition">
                    {d.actions}
                  </span>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full max-w-[36px] bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-t-md transition-all duration-300"
                  />
                  <span className="text-[10px] text-slate-400 font-medium">
                    {d.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Tags Breakdown */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <TagIcon className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Top Tags Usage
          </h2>
        </div>

        {topTags.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-8">
            No tags created yet. Add tags to your notes to view distribution here.
          </div>
        ) : (
          <div className="space-y-3">
            {topTags.map((tag) => {
              const percentage = Math.round((tag.note_count / maxTagCount) * 100);

              return (
                <div key={tag.tag_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      #{tag.name}
                    </span>
                    <span className="text-slate-400">
                      {tag.note_count} {tag.note_count === 1 ? 'note' : 'notes'}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${percentage}%` }}
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Analytics;
