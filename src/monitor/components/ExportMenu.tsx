import { useEffect, useRef, useState } from 'react';
import { Download, FileJson, FileSpreadsheet, FileText, FileType2, Globe, ChevronDown, Loader2 } from 'lucide-react';
import { runExport, type ExportFormat, type ExportPayload } from '../utils/exporters';

interface Props {
  /** Builds the payload lazily so we always export the freshest data. */
  build: () => ExportPayload;
  /** Optional label override. */
  label?: string;
  /** Compact mode (icon only, used in tight headers). */
  compact?: boolean;
  /** Disable when no data is ready yet. */
  disabled?: boolean;
}

const FORMATS: { id: ExportFormat; label: string; hint: string; icon: React.ElementType; tone: string }[] = [
  { id: 'pdf',   label: 'PDF',   hint: 'Branded report — print ready',      icon: FileType2,       tone: 'text-rose-300'    },
  { id: 'excel', label: 'Excel', hint: 'Spreadsheet (.xlsx) — opens in Excel', icon: FileSpreadsheet, tone: 'text-lime-300' },
  { id: 'word',  label: 'Word',  hint: 'Editable .doc, opens in Word',      icon: FileText,        tone: 'text-sky-300'     },
  { id: 'html',  label: 'HTML',  hint: 'Standalone styled web page',      icon: Globe,           tone: 'text-emerald-300' },
  { id: 'json',  label: 'JSON',  hint: 'Raw structured data',               icon: FileJson,        tone: 'text-amber-300'   },
];

const ExportMenu = ({ build, label = 'Export', compact = false, disabled = false }: Props) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handle = async (format: ExportFormat) => {
    if (disabled) return;
    try {
      setBusy(format);
      // Yield so the spinner paints before the (sync) generation work
      await new Promise((r) => setTimeout(r, 30));
      runExport(format, build());
    } catch (err) {
      console.error('[Export]', err);
      alert('Export failed. Please try again.');
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => !disabled && setOpen((s) => !s)}
        disabled={disabled}
        className={[
          'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
          disabled
            ? 'cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-600'
            : 'border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-emerald-200 hover:from-emerald-500/25 hover:to-emerald-500/10 hover:border-emerald-400/50',
        ].join(' ')}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {!compact && <span>{busy ? 'Generating…' : label}</span>}
        <ChevronDown className={['h-3 w-3 transition-transform', open ? 'rotate-180' : ''].join(' ')} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-emerald-500/20 bg-[#0a1410]/98 shadow-2xl shadow-black/60 backdrop-blur-md ring-1 ring-white/5 animate-in fade-in slide-in-from-top-2">
          <div className="border-b border-emerald-500/10 px-4 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400/80">
              Export this view
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              Branded for QEDA · auto-timestamped
            </div>
          </div>
          <ul className="py-1.5">
            {FORMATS.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => handle(f.id)}
                  disabled={busy !== null}
                  className="group flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
                >
                  <span className={['mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-800/70 ring-1 ring-slate-700 group-hover:ring-emerald-500/40', f.tone].join(' ')}>
                    {busy === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <f.icon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-100">{f.label}</span>
                    <span className="block text-[11px] text-slate-500">{f.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ExportMenu;
