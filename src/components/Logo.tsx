type Props = { size?: number; inverse?: boolean; className?: string };

/** Isotipo AV: una A y una V entrelazadas con el punto de equilibrio. */
export function Mark({ size = 40, inverse = false, className }: Props) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className={className}>
      <g fill="none" stroke={inverse ? '#F8F4EF' : 'var(--eucalipto)'} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 78 L50 18 L82 78" />
        <path d="M26 38 L50 86 L74 38" />
      </g>
      <circle cx="50" cy="53" r="5.5" fill={inverse ? '#E2A98F' : 'var(--arcilla)'} />
    </svg>
  );
}

export function Lockup() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <Mark size={40} />
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontFamily: 'var(--font-titulos)', fontSize: 22, fontWeight: 500, color: 'var(--tinta)' }}>Masajes AV</span>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.14em', color: 'var(--tinta-suave)', marginTop: 4 }}>
          MA. ALEJANDRA VILLANUEVA
        </span>
      </span>
    </span>
  );
}
