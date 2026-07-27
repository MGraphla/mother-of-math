import { useMemo, useState } from 'react';
import {
  Image as ImageIcon,
  Heart,
  Filter,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  LayoutGrid,
  List,
  Wand2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  Card,
  PageHeader,
  LoadingState,
  EmptyState,
  KpiCard,
  SectionTitle,
  SearchInput,
  Badge,
  MonitorFetchErrorPage,
  MonitorFetchErrorBanner,
} from '../components/ui';
import { format, subDays } from 'date-fns';
import { getAllImages, getImagesGeneratedByTeacher } from '../services/monitorData';
import { useLiveData } from '../hooks/useLiveData';
import LiveIndicator from '../components/LiveIndicator';
import ExportMenu from '../components/ExportMenu';
import type { ExportPayload } from '../utils/exporters';

interface ImageRow {
  id: string;
  user_id: string;
  user_name: string;
  prompt: string;
  enhanced_prompt?: string;
  aspect_ratio: string;
  style?: string;
  image_url: string;
  is_favorite: boolean;
  created_at: string;
}

interface ImagesBundle {
  images: ImageRow[];
  byTeacher: { teacherId: string; teacherName: string; imageCount: number }[];
}

type RangeKey = '24h' | '7d' | '30d' | 'all';
const RANGES: { key: RangeKey; label: string; ms: number | null }[] = [
  { key: '24h', label: 'Last 24h', ms: 24 * 3600 * 1000 },
  { key: '7d', label: 'Last 7d', ms: 7 * 24 * 3600 * 1000 },
  { key: '30d', label: 'Last 30d', ms: 30 * 24 * 3600 * 1000 },
  { key: 'all', label: 'All time', ms: null },
];

type ViewMode = 'grid' | 'list';
type Status = 'all' | 'favorites';
type SortKey = 'newest' | 'oldest' | 'creator';

const MonitorImages = () => {
  const { data, loading, refreshing, paused, setPaused, lastUpdated, error, refresh } =
    useLiveData<ImagesBundle>(
      async () => {
        const [images, byTeacher] = await Promise.all([
          getAllImages(),
          getImagesGeneratedByTeacher(),
        ]);
        return { images: images as ImageRow[], byTeacher };
      },
      { intervalMs: 45_000 },
    );

  const images = data?.images ?? [];
  const byTeacher = data?.byTeacher ?? [];

  const [range, setRange] = useState<RangeKey>('30d');
  const [status, setStatus] = useState<Status>('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortKey>('newest');
  const [preview, setPreview] = useState<ImageRow | null>(null);

  /* ── Range filtering ───────────────────────────────────── */
  const rangeFiltered = useMemo(() => {
    const r = RANGES.find((x) => x.key === range);
    if (!r || r.ms === null) return images;
    const cutoff = Date.now() - r.ms;
    return images.filter((i) => new Date(i.created_at).getTime() >= cutoff);
  }, [images, range]);

  /* ── KPI stats ─────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = images.length;
    const favorites = images.filter((i) => i.is_favorite).length;
    const favRate = total ? Math.round((favorites / total) * 100) : 0;
    const distinctCreators = new Set(images.map((i) => i.user_id)).size;

    const now = Date.now();
    const week = now - 7 * 86400000;
    const prev = now - 14 * 86400000;
    const thisWeek = images.filter((i) => new Date(i.created_at).getTime() >= week).length;
    const prevWeek = images.filter((i) => {
      const t = new Date(i.created_at).getTime();
      return t >= prev && t < week;
    }).length;
    const change =
      prevWeek === 0
        ? thisWeek > 0
          ? 100
          : 0
        : Math.round(((thisWeek - prevWeek) / prevWeek) * 100);
    const direction =
      change > 2 ? ('up' as const) : change < -2 ? ('down' as const) : ('flat' as const);
    return {
      total,
      favorites,
      favRate,
      distinctCreators,
      thisWeek,
      prevWeek,
      delta: { value: change, direction },
    };
  }, [images]);

  /* ── Daily trend (last 14 days) ─────────────────────────── */
  const dailyTrend = useMemo(() => {
    const days: Record<string, { date: string; created: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, 'MMM d');
      days[key] = { date: key, created: 0 };
    }
    images.forEach((i) => {
      const key = format(new Date(i.created_at), 'MMM d');
      if (days[key]) days[key].created += 1;
    });
    return Object.values(days);
  }, [images]);

  /* ── Breakdowns ─────────────────────────────────────────── */
  const byAspect = useMemo(() => {
    const m = new Map<string, number>();
    rangeFiltered.forEach((i) => {
      const k = i.aspect_ratio || 'Unknown';
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()]
      .map(([aspect, count]) => ({ aspect, count }))
      .sort((a, b) => b.count - a.count);
  }, [rangeFiltered]);

  /** Use `styleLabel` not `style` — Recharts forwards payload keys to SVG/DOM; `style` must be a CSS object. */
  const byStyle = useMemo(() => {
    const m = new Map<string, number>();
    rangeFiltered.forEach((i) => {
      const k = i.style || 'Default';
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()]
      .map(([styleLabel, count]) => ({ styleLabel, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [rangeFiltered]);

  const topTeachers = useMemo(
    () =>
      byTeacher
        .filter((t) => t.imageCount > 0)
        .sort((a, b) => b.imageCount - a.imageCount)
        .slice(0, 8),
    [byTeacher],
  );
  const topTeacherMax = topTeachers[0]?.imageCount ?? 1;

  /* ── Filtered / sorted ──────────────────────────────────── */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let arr = rangeFiltered;
    if (status === 'favorites') arr = arr.filter((i) => i.is_favorite);
    if (term) {
      arr = arr.filter(
        (i) =>
          (i.prompt || '').toLowerCase().includes(term) ||
          (i.user_name || '').toLowerCase().includes(term) ||
          (i.style || '').toLowerCase().includes(term),
      );
    }
    const cmp = (a: ImageRow, b: ImageRow): number => {
      switch (sort) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'creator':
          return (a.user_name || '').localeCompare(b.user_name || '');
      }
    };
    return [...arr].sort(cmp);
  }, [rangeFiltered, status, search, sort]);

  /* ── Export payload ─────────────────────────────────────── */
  const buildExportPayload = (): ExportPayload => ({
    fileStem: `qeda-image-generation-${range}`,
    title: 'QEDA Education Monitor — Image Generation',
    subtitle: `${RANGES.find((r) => r.key === range)?.label}${status !== 'all' ? ` · favourites` : ''}${search ? ` · "${search}"` : ''}`,
    summary:
      `${stats.total.toLocaleString()} images generated by ${stats.distinctCreators} teachers. ` +
      `${stats.favorites.toLocaleString()} marked as favourites (${stats.favRate}%). ` +
      `${stats.thisWeek} generated in the last 7 days (${stats.delta.value > 0 ? '+' : ''}${stats.delta.value}% vs the previous 7 days).`,
    kpis: [
      { label: 'Total images', value: stats.total },
      { label: 'Favourites', value: stats.favorites, hint: `${stats.favRate}%` },
      { label: 'Distinct creators', value: stats.distinctCreators },
      { label: 'This week', value: stats.thisWeek, hint: `vs ${stats.prevWeek} prev` },
      { label: 'In selected range', value: rangeFiltered.length },
    ],
    tables: [
      {
        title: 'Images in current view',
        columns: ['Created', 'Teacher', 'Aspect', 'Style', 'Favourite', 'Prompt'],
        rows: filtered.map((i) => [
          format(new Date(i.created_at), 'yyyy-MM-dd HH:mm'),
          i.user_name ?? '—',
          i.aspect_ratio ?? '—',
          i.style ?? '—',
          i.is_favorite ? 'yes' : 'no',
          (i.prompt || '').slice(0, 220),
        ]),
      },
      {
        title: 'Top creators · all time',
        columns: ['Rank', 'Teacher', 'Images'],
        rows: topTeachers.map((t, i) => [i + 1, t.teacherName ?? '—', t.imageCount]),
      },
      {
        title: 'Aspect ratios in range',
        columns: ['Aspect', 'Count'],
        rows: byAspect.map((a) => [a.aspect, a.count]),
      },
      {
        title: 'Top styles in range',
        columns: ['Style', 'Count'],
        rows: byStyle.map((s) => [s.styleLabel, s.count]),
      },
    ],
  });

  /* ── Render ─────────────────────────────────────────────── */
  if (loading && !data)
    return (
      <>
        <PageHeader
          title="Image generation"
          icon={ImageIcon}
          subtitle="Every AI-generated visual created by teachers."
        />
        <LoadingState label="Loading images…" />
      </>
    );

  if (!loading && error && !data)
    return (
      <MonitorFetchErrorPage
        title="Image generation"
        icon={ImageIcon}
        subtitle="Every AI-generated visual created by teachers."
        error={error}
        onRetry={refresh}
      />
    );

  const TrendIcon =
    stats.delta.direction === 'up'
      ? TrendingUp
      : stats.delta.direction === 'down'
        ? TrendingDown
        : Minus;

  return (
    <>
      <PageHeader
        title="Image generation"
        icon={ImageIcon}
        subtitle="Every AI-generated visual created by teachers, the prompts used, and the top users of this feature."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveIndicator
              lastUpdated={lastUpdated}
              refreshing={refreshing}
              paused={paused}
              onTogglePause={() => setPaused(!paused)}
              onRefresh={refresh}
              intervalMs={45_000}
            />
            <ExportMenu build={buildExportPayload} disabled={loading} />
          </div>
        }
      />

      {error && data && <MonitorFetchErrorBanner error={error} onRetry={refresh} />}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total images" value={stats.total} icon={ImageIcon} tone="rose" />
        <KpiCard
          label="Favourites"
          value={stats.favorites}
          icon={Heart}
          tone="amber"
          hint={`${stats.favRate}% favourited`}
        />
        <KpiCard
          label="Distinct creators"
          value={stats.distinctCreators}
          tone="cyan"
        />
        <KpiCard
          label="This week"
          value={stats.thisWeek}
          icon={Sparkles}
          tone="emerald"
          hint={`${stats.prevWeek} previous`}
          delta={{ value: stats.delta.value, direction: stats.delta.direction, label: 'vs prev 7d' }}
        />
      </div>

      {/* Daily trend */}
      <Card className="mt-5">
        <SectionTitle
          title="Last 14 days · image generation"
          hint="Pattern of AI visual creation."
          right={
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-300 ring-1 ring-rose-500/20">
              <TrendIcon className="h-3 w-3" /> {stats.delta.value > 0 ? '+' : ''}
              {stats.delta.value}% week over week
            </div>
          }
        />
        <div className="h-60 px-2 pb-3">
          {dailyTrend.every((d) => d.created === 0) ? (
            <EmptyState title="No images generated in the last 14 days" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="imgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: '#0b1020',
                    border: '1px solid #1e293b',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="created"
                  stroke="#fb7185"
                  fill="url(#imgGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Range + status chips */}
      <Card className="mt-5 p-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="ml-1 mr-1 h-3.5 w-3.5 text-slate-500" />
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={[
                  'rounded-full px-3 py-1.5 text-[12px] transition-colors',
                  range === r.key
                    ? 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/40'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                ].join(' ')}
              >
                {r.label}
              </button>
            ))}
            <span className="ml-2 text-[11px] text-slate-500">
              {rangeFiltered.length.toLocaleString()} in range
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="ml-1 mr-1 text-[11px] uppercase tracking-wider text-slate-500">
              Filter
            </span>
            {(
              [
                ['all', 'All'],
                ['favorites', 'Favourites only'],
              ] as [Status, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setStatus(k)}
                className={[
                  'rounded-full px-3 py-1.5 text-[12px] transition-colors',
                  status === k
                    ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/40'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Aspect ratio + style mix */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <SectionTitle title="Aspect ratios" hint={`${byAspect.length} variants used`} />
          <div className="h-72 px-2 pb-3">
            {byAspect.length === 0 ? (
              <EmptyState title="No data" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byAspect}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="aspect" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#0b1020',
                      border: '1px solid #1e293b',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="#fb7185" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <SectionTitle
            title="Top styles in range"
            hint="Which artistic styles teachers reach for most."
          />
          <div className="h-72 px-2 pb-3">
            {byStyle.length === 0 ? (
              <EmptyState title="No styles tagged yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byStyle} layout="vertical" margin={{ left: 30, right: 12 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <YAxis
                    dataKey="styleLabel"
                    type="category"
                    stroke="#94a3b8"
                    fontSize={11}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0b1020',
                      border: '1px solid #1e293b',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {byStyle.map((_, i) => (
                      <Cell
                        key={i}
                        fill={['#fb7185', '#fbbf24', '#a78bfa', '#22d3ee', '#34d399', '#60a5fa', '#fb923c', '#c084fc', '#f472b6', '#4ade80'][i % 10]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Top creator leaderboard */}
      {topTeachers.length > 0 && (
        <Card className="mt-5">
          <SectionTitle
            title="Top image creators · all time"
            right={<Trophy className="h-4 w-4 text-amber-400" />}
          />
          <div className="grid gap-2 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
            {topTeachers.slice(0, 8).map((t, i) => {
              const pct = Math.round((t.imageCount / topTeacherMax) * 100);
              return (
                <div
                  key={t.teacherId}
                  className="rounded-lg border border-slate-800/70 bg-gradient-to-br from-slate-900/70 to-slate-900/30 p-3 transition-all hover:border-rose-500/40 hover:bg-rose-500/5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                        i === 0
                          ? 'bg-amber-500 text-amber-950'
                          : i === 1
                            ? 'bg-slate-300 text-slate-900'
                            : i === 2
                              ? 'bg-orange-700 text-white'
                              : 'bg-slate-700 text-slate-300',
                      ].join(' ')}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-100">
                        {t.teacherName || 'Unknown'}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        {t.imageCount.toLocaleString()} images
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Search / sort / view toggle */}
      <Card className="mt-5 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-80">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search prompt, teacher, style…"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="mr-1 text-slate-500">Sort:</span>
              {(
                [
                  ['newest', 'Newest'],
                  ['oldest', 'Oldest'],
                  ['creator', 'Creator'],
                ] as [SortKey, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setSort(k)}
                  className={[
                    'rounded-full px-3 py-1.5 transition-colors',
                    sort === k
                      ? 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/40'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/40 p-0.5">
              <button
                onClick={() => setView('grid')}
                title="Grid view"
                className={[
                  'rounded px-2 py-1 text-[11px]',
                  view === 'grid'
                    ? 'bg-rose-500/20 text-rose-200'
                    : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setView('list')}
                title="List view"
                className={[
                  'rounded px-2 py-1 text-[11px]',
                  view === 'list'
                    ? 'bg-rose-500/20 text-rose-200'
                    : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Gallery / list */}
      <Card className="mt-5">
        <div className="flex items-center justify-between border-b border-slate-800/70 px-5 py-3 text-[11px] text-slate-500">
          <span>
            {filtered.length.toLocaleString()} of {images.length.toLocaleString()} images
          </span>
          <span className="hidden sm:inline">Click any image for the full prompt</span>
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title="No matches"
            hint="Try a wider time range or clear search / favourites filter."
          />
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
            {filtered.map((img) => (
              <button
                key={img.id}
                onClick={() => setPreview(img)}
                className="group overflow-hidden rounded-lg border border-slate-800/70 bg-slate-900/50 text-left transition-transform hover:scale-[1.02] hover:border-rose-500/40"
              >
                {img.image_url ? (
                  <img
                    src={img.image_url}
                    alt={img.prompt}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="aspect-square w-full bg-slate-800" />
                )}
                <div className="p-2">
                  <div className="line-clamp-2 text-[11px] text-slate-300">
                    {img.prompt || '(no prompt)'}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] text-slate-500">
                      {img.user_name || '—'}
                    </span>
                    {img.is_favorite && (
                      <Heart className="h-3 w-3 shrink-0 fill-rose-400 text-rose-400" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Image</th>
                  <th className="px-4 py-3">Prompt</th>
                  <th className="px-4 py-3">Creator</th>
                  <th className="px-4 py-3">Style</th>
                  <th className="px-4 py-3">Aspect</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr
                    key={i.id}
                    onClick={() => setPreview(i)}
                    className="cursor-pointer border-b border-slate-800/40 transition-colors hover:bg-rose-500/5"
                  >
                    <td className="px-5 py-2">
                      {i.image_url && (
                        <img
                          src={i.image_url}
                          alt=""
                          loading="lazy"
                          className="h-10 w-10 rounded border border-slate-800 object-cover"
                        />
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-300">
                      <div className="line-clamp-1 max-w-md">{i.prompt || '—'}</div>
                    </td>
                    <td className="px-4 py-2 text-slate-300">{i.user_name || '—'}</td>
                    <td className="px-4 py-2">
                      <Badge tone="slate">{i.style || 'Default'}</Badge>
                    </td>
                    <td className="px-4 py-2 text-slate-300">{i.aspect_ratio || '—'}</td>
                    <td className="px-4 py-2 text-xs text-slate-400">
                      {format(new Date(i.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {i.is_favorite && <Heart className="ml-auto h-3.5 w-3.5 fill-rose-400 text-rose-400" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-rose-500/20 bg-[#0a1410] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">
                  {preview.user_name || 'Unknown teacher'}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span>{format(new Date(preview.created_at), 'MMM d, yyyy HH:mm')}</span>
                  {preview.aspect_ratio && (
                    <>
                      <span>·</span>
                      <Badge tone="slate">{preview.aspect_ratio}</Badge>
                    </>
                  )}
                  {preview.style && (
                    <>
                      <span>·</span>
                      <Badge tone="rose">{preview.style}</Badge>
                    </>
                  )}
                  {preview.is_favorite && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 text-rose-300">
                        <Heart className="h-3 w-3 fill-rose-400 text-rose-400" /> Favourite
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {preview.image_url && (
                <img
                  src={preview.image_url}
                  alt={preview.prompt}
                  className="mb-3 max-h-[60vh] w-full rounded-lg border border-slate-800 object-contain"
                />
              )}
              <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 p-3 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">
                  <Wand2 className="h-3 w-3" /> Prompt
                </div>
                {preview.prompt || '(no prompt)'}
              </div>
              {preview.enhanced_prompt && (
                <div className="mt-2 rounded-lg border border-slate-800/60 bg-slate-900/40 p-3 text-sm text-slate-300 whitespace-pre-wrap">
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">
                    Enhanced prompt
                  </div>
                  {preview.enhanced_prompt}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MonitorImages;
