import { cn } from '@/lib/utils';
import wordmarkFoundations from '@/assets/logo/wordmark-foundations.svg';
import wordmarkWhite from '@/assets/logo/wordmark-white.svg';
import logoMarkPrimary from '@/assets/logo/logo-primary.svg';
import logoMarkWhite from '@/assets/logo/logo-white.svg';

interface LogoProps {
  /** 'primary' = brand navy on light backgrounds; 'inverse' = white on dark. */
  variant?: 'primary' | 'inverse';
  /** When true, shows just the square logomark (no wordmark). */
  markOnly?: boolean;
  className?: string;
  /** Pixel height. Width follows the SVG's natural aspect ratio. */
  size?: number;
}

/**
 * SAIACS brand logo.
 *
 * Renders the official wordmark SVG (mark + stacked "South Asia Institute of
 * Advanced Christian Studies" text, supplied in brand colors) by default.
 * Pass `markOnly` for tight spaces where only the square logomark is used.
 *
 * Brand rules enforced:
 *  - No rotation, stretching, or cropping (rendered at natural aspect ratio).
 *  - Clear space ≥ height of the pillar (wrap with padding or CSS as needed).
 *  - No gradients or shadows (no filter classes applied).
 */
export function Logo({ variant = 'primary', markOnly = false, className, size = 64 }: LogoProps) {
  const src = markOnly
    ? variant === 'primary' ? logoMarkPrimary : logoMarkWhite
    : variant === 'primary' ? wordmarkFoundations : wordmarkWhite;

  return (
    <img
      src={src}
      alt="SAIACS — South Asia Institute of Advanced Christian Studies"
      height={size}
      className={cn('block shrink-0 select-none', className)}
      style={{ height: size, width: 'auto' }}
      draggable={false}
    />
  );
}
