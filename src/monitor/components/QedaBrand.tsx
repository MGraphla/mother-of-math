/**
 * QedaBrand — wordmark + logo mark for the implementing partner (QEDA).
 *
 * QEDA = Quality Education Development Associates (qeda.ng) — a Nigerian
 * locally-led organisation driving education reform across Africa.
 *
 * Logo file: `public/qeda logo.jpeg` (referenced below with URL encoding for the space).
 */

type Size = 'sm' | 'md' | 'lg';

/** Resolves correctly if Vite `base` is not `/`. */
const QEDA_LOGO_PUBLIC_PATH = `${import.meta.env.BASE_URL}qeda%20logo.jpeg`;

const sizeMap: Record<Size, { logoMax: string; text: string; sub: string }> = {
  sm: { logoMax: 'max-h-9 max-w-[120px]',  text: 'text-base',  sub: 'text-[10px]' },
  md: { logoMax: 'max-h-11 max-w-[150px]', text: 'text-lg',   sub: 'text-[11px]' },
  lg: { logoMax: 'max-h-16 max-w-[200px]', text: 'text-2xl',  sub: 'text-xs'     },
};

export const QedaGlyph = ({ size = 'md', className = '', src }: { size?: Size; className?: string; src?: string }) => {
  const logoMax = sizeMap[size].logoMax;
  return (
    <div className={['flex shrink-0 items-center justify-center', className].join(' ')}>
      <img
        src={src || QEDA_LOGO_PUBLIC_PATH}
        alt="Logo"
        className={['h-auto w-auto object-contain', logoMax].join(' ')}
        draggable={false}
      />
    </div>
  );
};

export const QedaWordmark = ({
  size = 'md',
  tagline,
  className = '',
}: {
  size?: Size;
  tagline?: string;
  className?: string;
}) => {
  const s = sizeMap[size];
  return (
    <div className={['flex items-center gap-3', className].join(' ')}>
      <QedaGlyph size={size} />
      <div className="min-w-0">
        <div className={['font-bold tracking-tight text-white', s.text].join(' ')}>
          QEDA<span className="ml-1 font-normal text-emerald-300/80">·</span>
          <span className="ml-1 text-emerald-300/90">Monitor</span>
        </div>
        <div className={['uppercase tracking-[0.18em] text-emerald-300/70', s.sub].join(' ')}>
          {tagline ?? 'Quality Education Development'}
        </div>
      </div>
    </div>
  );
};

export const QEDA_BRAND = {
  name: 'QEDA',
  fullName: 'Quality Education Development Associates',
  product: 'MAMA Math',
  primary: '#0aa55b',
  accent: '#f5b81b',
  deep: '#0c8a4a',
  url: 'https://www.qeda.ng',
};
