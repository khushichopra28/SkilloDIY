import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';

export type EventOpsLogoSize =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'sidebar'
  | 'header'
  | 'auth'
  | 'id-card'
  | 'custom';

export interface EventOpsLogoProps {
  /** Preset size of the logo */
  size?: EventOpsLogoSize;
  /** Custom explicit pixel width */
  width?: number;
  /** Custom explicit pixel height */
  height?: number;
  /** Destination route when the logo is clicked */
  href?: string;
  /** Accessible alt text describing the logo */
  alt?: string;
  /** Additional CSS class names */
  className?: string;
  /** Prioritize image loading for above-the-fold brand headers */
  priority?: boolean;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Render as an SVG <image> element for embedding inside SVG graphs / ID cards */
  asSvg?: boolean;
  /** SVG X coordinate (used when asSvg is true) */
  x?: number | string;
  /** SVG Y coordinate (used when asSvg is true) */
  y?: number | string;
}

const SIZE_PRESETS: Record<EventOpsLogoSize, { width: number; height: number }> = {
  xs: { width: 24, height: 30 },
  sm: { width: 36, height: 45 },
  md: { width: 44, height: 55 },
  header: { width: 50, height: 62 },
  sidebar: { width: 48, height: 60 },
  auth: { width: 72, height: 90 },
  lg: { width: 72, height: 90 },
  xl: { width: 96, height: 120 },
  'id-card': { width: 64, height: 72 },
  custom: { width: 48, height: 60 },
};

const DEFAULT_ALT = 'Skillo DIY Crafts — EventOps';

export default function EventOpsLogo({
  size = 'md',
  width,
  height,
  href,
  alt = DEFAULT_ALT,
  className = '',
  priority = false,
  style,
  asSvg = false,
  x = 0,
  y = 0,
}: EventOpsLogoProps) {
  const preset = SIZE_PRESETS[size] ?? SIZE_PRESETS.md;
  const finalWidth = width ?? preset.width;
  const finalHeight = height ?? preset.height;

  if (asSvg) {
    return (
      <image
        href="/skillo.png"
        x={x}
        y={y}
        width={finalWidth}
        height={finalHeight}
        preserveAspectRatio="xMidYMid meet"
        className={className}
        aria-label={alt}
      />
    );
  }

  const imageElement = (
    <Image
      src="/skillo.png"
      alt={alt}
      width={finalWidth}
      height={finalHeight}
      priority={priority}
      className={`eventops-logo-img ${className}`.trim()}
      style={{
        objectFit: 'contain',
        width: `${finalWidth}px`,
        height: `${finalHeight}px`,
        maxWidth: '100%',
        ...style,
      }}
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        className="eventops-logo-link"
        aria-label={alt}
        style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0 }}
      >
        {imageElement}
      </Link>
    );
  }

  return (
    <span
      className="eventops-logo-container"
      style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0 }}
    >
      {imageElement}
    </span>
  );
}

/** SVG sub-component helper for direct SVG embedding */
export function EventOpsLogoSvg(props: Omit<EventOpsLogoProps, 'asSvg'>) {
  return <EventOpsLogo {...props} asSvg />;
}
