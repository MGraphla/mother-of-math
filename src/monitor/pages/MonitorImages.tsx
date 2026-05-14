import { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Heart } from 'lucide-react';
import { Card, PageHeader, LoadingState, EmptyState, KpiCard, SectionTitle, SearchInput, Badge } from '../components/ui';
import { getAllImages, getImagesGeneratedByTeacher } from '../services/monitorData';
import { format } from 'date-fns';

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

const MonitorImages = () => {
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [byTeacher, setByTeacher] = useState<{ teacherId: string; teacherName: string; imageCount: number }[]>([]);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<ImageRow | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [imgs, t] = await Promise.all([getAllImages(), getImagesGeneratedByTeacher()]);
        setImages(imgs as ImageRow[]);
        setByTeacher(t);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const favorites = images.filter((i) => i.is_favorite).length;
  const topTeachers = useMemo(
    () => byTeacher.filter((t) => t.imageCount > 0).sort((a, b) => b.imageCount - a.imageCount).slice(0, 8),
    [byTeacher]
  );

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return images;
    return images.filter(
      (i) =>
        (i.prompt || '').toLowerCase().includes(t) ||
        (i.user_name || '').toLowerCase().includes(t) ||
        (i.style || '').toLowerCase().includes(t)
    );
  }, [images, search]);

  if (loading)
    return (
      <>
        <PageHeader title="Image generation" icon={ImageIcon} subtitle="Every AI-generated visual created by teachers." />
        <LoadingState />
      </>
    );

  return (
    <>
      <PageHeader title="Image generation" icon={ImageIcon} subtitle="Every AI-generated visual created by teachers, the prompts used, and the top users of this feature." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total images" value={images.length} tone="rose" />
        <KpiCard label="Favourites" value={favorites} tone="amber" hint="Teachers' starred visuals" />
        <KpiCard label="Distinct creators" value={new Set(images.map((i) => i.user_id)).size} tone="cyan" />
        <KpiCard label="This week" value={images.filter((i) => new Date(i.created_at).getTime() > Date.now() - 7 * 86400000).length} tone="emerald" />
      </div>

      {topTeachers.length > 0 && (
        <Card className="mt-5">
          <SectionTitle title="Top image creators" />
          <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-4">
            {topTeachers.map((t, idx) => (
              <div key={t.teacherId} className="rounded-lg border border-slate-800/60 bg-slate-900/40 p-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-500">#{idx + 1}</div>
                <div className="truncate text-sm text-slate-100">{t.teacherName || 'Unknown'}</div>
                <div className="mt-1 text-xs text-rose-300">{t.imageCount.toLocaleString()} images</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mt-5">
        <SectionTitle
          title="All images"
          hint={`${filtered.length} of ${images.length}`}
          right={<div className="w-64"><SearchInput value={search} onChange={setSearch} placeholder="Search prompt, teacher, style…" /></div>}
        />
        {filtered.length === 0 ? (
          <EmptyState title="No matches" />
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
            {filtered.map((img) => (
              <button
                key={img.id}
                onClick={() => setPreview(img)}
                className="group overflow-hidden rounded-lg border border-slate-800/70 bg-slate-900/50 text-left transition-transform hover:scale-[1.02]"
              >
                {img.image_url ? (
                  <img src={img.image_url} alt={img.prompt} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="aspect-square w-full bg-slate-800" />
                )}
                <div className="p-2">
                  <div className="line-clamp-2 text-[11px] text-slate-300">{img.prompt || '(no prompt)'}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="truncate text-[10px] text-slate-500">{img.user_name || '—'}</span>
                    {img.is_favorite && <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-[#0b1020] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-100">{preview.user_name || 'Unknown teacher'}</div>
                <div className="text-xs text-slate-500">{format(new Date(preview.created_at), 'MMM d, yyyy HH:mm')} · {preview.aspect_ratio || '—'} {preview.style ? `· ${preview.style}` : ''}</div>
              </div>
              <button onClick={() => setPreview(null)} className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800">Close</button>
            </div>
            {preview.image_url && (
              <img src={preview.image_url} alt={preview.prompt} className="mb-3 max-h-[60vh] w-full rounded-lg border border-slate-800 object-contain" />
            )}
            <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 p-3 text-sm text-slate-200 whitespace-pre-wrap">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Prompt</div>
              {preview.prompt || '(no prompt)'}
            </div>
            {preview.enhanced_prompt && (
              <div className="mt-2 rounded-lg border border-slate-800/60 bg-slate-900/40 p-3 text-sm text-slate-300 whitespace-pre-wrap">
                <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Enhanced prompt</div>
                {preview.enhanced_prompt}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default MonitorImages;
