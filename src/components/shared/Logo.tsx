import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'primary' | 'inverse';
  className?: string;
  showWordmark?: boolean;
}

/**
 * SAIACS brand logo placeholder.
 *
 * Drop the real SVG files at `src/assets/logo/logo-primary.svg` and
 * `src/assets/logo/logo-inverse.svg` and swap out the inner JSX here.
 *
 * Brand rules enforced:
 *  - Never rotate, stretch, or crop the mark
 *  - Clear space ≥ height of the pillar (left padding on the wordmark)
 *  - Use navy on light backgrounds; white on dark
 */
export function Logo({ variant = 'primary', className, showWordmark = true }: LogoProps) {
  const onLight = variant === 'primary';
  const markFill = onLight ? '#1A2549' : '#F0F7FA';
  const textFill = onLight ? '#1A2549' : '#F0F7FA';

  return (
    <div className={cn('inline-flex items-center gap-3', className)} aria-label="SAIACS">
      {/* Placeholder mark — replace with real SVG */}
      <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0" aria-hidden="true">
        <rect x="8" y="18" width="24" height="16" fill={markFill} />
        <rect x="10" y="20" width="3" height="12" fill={onLight ? '#F0F7FA' : '#1A2549'} />
        <rect x="15" y="20" width="3" height="12" fill={onLight ? '#F0F7FA' : '#1A2549'} />
        <rect x="20" y="20" width="3" height="12" fill={onLight ? '#F0F7FA' : '#1A2549'} />
        <rect x="25" y="20" width="3" height="12" fill={onLight ? '#F0F7FA' : '#1A2549'} />
        <path d="M20 4 L28 16 L12 16 Z" fill={markFill} />
        <rect x="19" y="1" width="2" height="6" fill={markFill} />
        <rect x="17" y="3" width="6" height="2" fill={markFill} />
      </svg>
      {showWordmark && (
        <div className="leading-tight" style={{ color: textFill }}>
          <div className="font-display text-[11px] font-bold uppercase tracking-wider">South Asia</div>
          <div className="font-display text-[11px] font-bold uppercase tracking-wider">Institute of Advanced</div>
          <div className="font-display text-[11px] font-bold uppercase tracking-wider">Christian Studies</div>
        </div>
      )}
    </div>
  );
}
