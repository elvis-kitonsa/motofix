/**
 * MOTOBOT's face — the same white-head / dark-visor / amber-eyed robot used on the
 * welcome & spare-parts screens (SparePartsDealer `MotoBot`), cropped to the head so
 * it reads inside small circular icons (the floating launcher + chat header avatar).
 * Unique gradient IDs (mbf*) avoid clashing with the full-body robot's defs.
 */
export function MotobotFace({ size = 40 }: { size?: number }) {
  const AMBER = '#F59E0B'
  return (
    <svg width={size} height={size} viewBox="52 2 176 166" fill="none" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="mbfWhite" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E5EAF1" />
        </linearGradient>
        <linearGradient id="mbfVisor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2b35" />
          <stop offset="1" stopColor="#0d0d14" />
        </linearGradient>
        <radialGradient id="mbfEye" cx="0.5" cy="0.42" r="0.62">
          <stop offset="0" stopColor="#FFF1C9" />
          <stop offset="0.45" stopColor="#FBBF24" />
          <stop offset="1" stopColor="#F59E0B" />
        </radialGradient>
        <radialGradient id="mbfTip" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE9A8" />
          <stop offset="1" stopColor="#F59E0B" />
        </radialGradient>
      </defs>

      {/* antenna */}
      <line x1="150" y1="36" x2="158" y2="18" stroke={AMBER} strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="159" cy="15" r="6" fill="url(#mbfTip)" />
      {/* ears */}
      <rect x="60" y="84" width="11" height="28" rx="5.5" fill={AMBER} />
      <rect x="209" y="84" width="11" height="28" rx="5.5" fill={AMBER} />
      {/* head (white frame) */}
      <rect x="68" y="34" width="144" height="122" rx="46" fill="url(#mbfWhite)" />
      <path d="M92 52 Q140 40 188 52" stroke="#fff" strokeWidth="8" strokeLinecap="round" opacity="0.7" />
      {/* dark face screen */}
      <rect x="84" y="52" width="112" height="90" rx="32" fill="url(#mbfVisor)" />
      <rect x="94" y="60" width="40" height="12" rx="6" fill="#fff" opacity="0.08" />
      {/* glowing amber eyes + smile */}
      <ellipse cx="116" cy="94" rx="15" ry="18" fill="url(#mbfEye)" />
      <circle cx="121" cy="87" r="5" fill="#fff" />
      <ellipse cx="164" cy="94" rx="15" ry="18" fill="url(#mbfEye)" />
      <circle cx="169" cy="87" r="5" fill="#fff" />
      <path d="M122 118 Q140 132 158 118" stroke={AMBER} strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  )
}
