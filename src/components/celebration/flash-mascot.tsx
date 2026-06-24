// FLASH — the Big Shot Pictures mascot: a friendly studio spotlight on legs with a
// glowing yellow lens for a face, throwing a thumbs-up. Hand-built flat-vector art
// (no external asset) so it stays crisp at any size and is cheap to animate. The
// charcoal + brand yellow here are illustration colors (a brand mark), intentionally
// literal rather than themed — the mascot looks the same in light and dark.

const INK = '#15151C' // charcoal housing
const INK_SOFT = '#2A2A35' // lens rim / shading
const YELLOW = '#FACC15' // brand yellow — the lens "face"
const YELLOW_HI = '#FDE68A' // highlight

export interface FlashMascotProps {
  className?: string
  /** Decorative by default; pass a label to expose it to assistive tech. */
  title?: string
}

/** The FLASH spotlight mascot as a self-contained SVG. */
export function FlashMascot({ className, title }: FlashMascotProps) {
  return (
    <svg
      viewBox="0 0 200 240"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="flash-lens" cx="0.4" cy="0.36" r="0.72">
          <stop offset="0" stopColor={YELLOW_HI} />
          <stop offset="0.6" stopColor={YELLOW} />
          <stop offset="1" stopColor="#EAB308" />
        </radialGradient>
      </defs>

      {/* soft glow halo behind the lens */}
      <circle cx="100" cy="96" r="86" fill={YELLOW} opacity="0.16" />

      {/* legs + feet */}
      <rect x="76" y="178" width="15" height="38" rx="7.5" fill={INK} />
      <rect x="109" y="178" width="15" height="38" rx="7.5" fill={INK} />
      <ellipse cx="80" cy="220" rx="17" ry="8" fill={INK} />
      <ellipse cx="120" cy="220" rx="17" ry="8" fill={INK} />

      {/* spotlight housing / body */}
      <rect x="54" y="74" width="92" height="116" rx="36" fill={INK} />

      {/* top handle */}
      <path d="M82 70 q18 -22 36 0" stroke={INK} strokeWidth="10" strokeLinecap="round" />

      {/* left arm */}
      <path d="M58 126 q-26 8 -30 32" stroke={INK} strokeWidth="14" strokeLinecap="round" />
      <circle cx="27" cy="160" r="11" fill={INK} />

      {/* right arm raised into a thumbs-up */}
      <path d="M144 120 q30 0 33 -36" stroke={INK} strokeWidth="14" strokeLinecap="round" />
      <g transform="translate(177,80)">
        <circle r="13" fill={INK} />
        <rect x="-3.5" y="-23" width="8" height="17" rx="4" fill={INK} />
      </g>

      {/* lens rim + glowing face */}
      <circle cx="100" cy="96" r="54" fill={INK_SOFT} />
      <circle cx="100" cy="96" r="45" fill="url(#flash-lens)" />

      {/* face */}
      <circle cx="84" cy="90" r="6.5" fill={INK} />
      <circle cx="116" cy="90" r="6.5" fill={INK} />
      <path d="M81 108 q19 17 38 0" stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none" />

      {/* lens shine */}
      <circle cx="82" cy="78" r="9" fill={YELLOW_HI} opacity="0.85" />
    </svg>
  )
}
