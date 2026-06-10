import { C } from '@/styles/tokens'

interface Props {
  lines?: number
  height?: number
}

export default function SkeletonCard({ lines = 3, height }: Props) {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <div style={{
        borderRadius: 14, padding: 16,
        background: C.surface2, border: `1px solid ${C.border}`,
        height: height ? `${height}px` : 'auto',
        overflow: 'hidden',
      }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} style={{
            height: 14, borderRadius: 7,
            marginBottom: i < lines - 1 ? 12 : 0,
            width: i === lines - 1 ? '60%' : i % 2 === 0 ? '100%' : '80%',
            background: `linear-gradient(90deg, ${C.surface3} 25%, ${C.surface2} 50%, ${C.surface3} 75%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s ease-in-out infinite',
          }} />
        ))}
      </div>
    </>
  )
}
