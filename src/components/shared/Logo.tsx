import { cn } from '@/lib/utils';
import logoPrimary from '@/assets/logo/logo-primary.svg';
import logoWhite from '@/assets/logo/logo-white.svg';

interface LogoProps {
  variant?: 'primary' | 'inverse';
  className?: string;
  showWordmark?: boolean;
  size?: number;
}

/**
 * SAIACS brand logo.
 *
 * Primary = navy (Foundations #1A2549) on light backgrounds.
 * Inverse = white on dark (Foundations / Traditions) backgrounds.
 *
 * Brand rules enforced:
 *  - No rotation, stretching, or cropping (we render at a fixed aspect ratio).
 *  - Clear space ≥ height of the pillar (we pad the wordmark accordingly).
 *  - No gradients or shadows (no filter classes applied).
 */
export function Logo({ variant = 'primary', className, showWordmark = true, size = 40 }: LogoProps) {
  const src = variant === 'primary' ? logoPrimary : logoWhite;
  const textColor = variant === 'primary' ? '#1A2549' : '#F0F7FA';

  return (
    <div className={cn('inline-flex items-center gap-3', className)} aria-label="SAIACS — South Asia Institute of Advanced Christian Studies">
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0"
        style={{ display: 'block' }}
      />
      {showWordmark && (
        <div className="leading-tight" style={{ color: textColor }}>
          <div className="font-display text-[11px] font-bold uppercase tracking-wider">South Asia</div>
          <div className="font-display text-[11px] font-bold uppercase tracking-wider">Institute of Advanced</div>
          <div className="font-display text-[11px] font-bold uppercase tracking-wider">Christian Studies</div>
        </div>
      )}
    </div>
  );
}
