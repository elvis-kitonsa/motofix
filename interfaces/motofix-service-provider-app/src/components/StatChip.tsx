import { C } from '@/styles/tokens'

interface Props {
  label: string
  value: string | number
  icon?: React.ElementType
  color?: string
}

export default function StatChip({ label, value, icon: Icon, color = C.amber }: Props) {
  return (
    <div style={{
      borderRadius: 18,
      padding: '14px 14px 12px',
      background: `linear-gradient(145deg, var(--surface-1) 0%, ${color}07 100%)`,
      border: `1.5px solid ${color}22`,
      boxShadow: `0 4px 16px ${color}12, 0 1px 4px rgba(0,0,0,0.04)`,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {Icon && (
        <div style={{
          width: 34, height: 34, borderRadius: 11,
          background: `${color}18`,
          border: `1px solid ${color}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon style={{ width: 17, height: 17, color }} />
        </div>
      )}
      <div>
        <p style={{
          fontSize: 22, fontWeight: 900, color: C.textHi,
          lineHeight: 1, letterSpacing: '-0.02em',
        }}>
          {value}
        </p>
        <p style={{
          fontSize: 10, color: C.textFaint, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.09em', marginTop: 4,
        }}>
          {label}
        </p>
      </div>
    </div>
  )
}
