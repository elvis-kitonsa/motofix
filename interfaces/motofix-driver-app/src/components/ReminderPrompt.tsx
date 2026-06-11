import { toast } from 'sonner'
import { markItemChecked, type ChecklistItem, type ChecklistSection } from '@/lib/reminders'
import { addNotification } from '@/lib/notifications'

// Turn a checklist statement ("Check tyre pressure …") into a question
// ("Did you check tyre pressure …?").
function toQuestion(text: string): string {
  const t = text.trim()
  return `Did you ${t.charAt(0).toLowerCase()}${t.slice(1)}?`
}

function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/**
 * Pop a single interactive reminder question on screen ("Did you …? [Yes, done] [Not yet]")
 * and drop a matching entry in the notifications bell. "Yes, done" marks the item satisfied
 * so it leaves the due list; "Not yet" / swipe just dismisses (it stays due and rotates back).
 */
export function fireReminderPrompt(item: ChecklistItem, section: ChecklistSection) {
  const question = toQuestion(item.text)

  // Also surface it under the bell (at most once per item per day).
  addNotification({
    kind: 'reminder',
    title: `${section.emoji} ${section.label}`,
    body: question,
    link: '/reminders',
    dedupeKey: `rem:${item.id}:${dayKey()}`,
  })

  toast.custom(
    (t) => (
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'var(--overlay-bg)',
          border: `1px solid ${section.border}`,
          borderRadius: 16,
          padding: 14,
          boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>{section.emoji}</span>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: section.accent, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {section.label}
          </span>
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-hi)', lineHeight: 1.45, margin: '0 0 12px' }}>
          {question}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              markItemChecked(item.id)
              toast.dismiss(t)
              toast.success('Logged ✓', { description: 'Nice — one less thing to worry about.' })
            }}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: section.accent, color: '#0b0f14', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
          >
            Yes, done
          </button>
          <button
            onClick={() => toast.dismiss(t)}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border-3)', background: 'transparent', color: 'var(--text-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Not yet
          </button>
        </div>
      </div>
    ),
    { duration: 15000 },
  )
}
