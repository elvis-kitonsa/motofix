import { C } from '@/styles/tokens'

interface Props {
  icon: React.ElementType
  title: string
  subtitle: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon: Icon, title, subtitle, action }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: C.surface3, border: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
      }}>
        <Icon style={{ width: 24, height: 24, color: C.textFaint }} />
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: C.textHi, marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5, maxWidth: 260 }}>{subtitle}</p>
      {action && (
        <button onClick={action.onClick}
          style={{
            marginTop: 20, padding: '10px 24px', borderRadius: 12,
            background: `linear-gradient(135deg, ${C.amber}, ${C.amberDark})`,
            color: '#000', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
          }}>
          {action.label}
        </button>
      )}
    </div>
  )
}
