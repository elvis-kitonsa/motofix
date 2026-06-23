// TermsConditions.tsx — the static terms & conditions screen for providers (the rules of
// working through MOTOFIX). Content only, no logic.

import { useNavigate, useLocation } from 'react-router-dom'
import type { ElementType } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CreditCard,
  FileText,
  Gavel,
  Lock,
  ShieldCheck,
  Star,
  Truck,
  UserCheck,
  Wrench,
} from 'lucide-react'

const Y = '#F59E0B'
const R = '#ff2d2d'

type SectionItem = {
  title: string
  Icon: ElementType
  accent: string
  body: string[]
  bullets?: string[]
}

const TERMS: SectionItem[] = [
  {
    title: '1. Acceptance of these terms',
    Icon: FileText,
    accent: Y,
    body: [
      'These Terms of Service govern your access to and use of MOTOFIX as a registered service provider, including the Provider app, job request flow, earnings management, location broadcasting, profile and credential management, and related support services.',
      'By creating a provider account, completing the onboarding process, accepting a job, or continuing to use the MOTOFIX Provider app, you agree to these terms. If you do not agree, you should not use the app.',
    ],
  },
  {
    title: '2. What MOTOFIX does for Service Providers',
    Icon: Truck,
    accent: '#60A5FA',
    body: [
      'MOTOFIX is a roadside assistance platform that connects service providers — including mechanics, technicians, and towing operators — with drivers who need help. The platform helps you receive job requests, navigate to the driver\'s location, complete the service, and receive payment.',
      'MOTOFIX provides tools for managing your availability, tracking active jobs, viewing job history, monitoring earnings, and communicating with the platform\'s support team.',
    ],
    bullets: [
      'MOTOFIX matches drivers with nearby available providers based on location, availability, and provider type.',
      'You are responsible for fulfilling the service described in each job request honestly and competently.',
      'Job availability depends on your location, network conditions, time of day, and demand in your area.',
    ],
  },
  {
    title: '3. Your account, profile, and credentials',
    Icon: UserCheck,
    accent: '#34D399',
    body: [
      'You are responsible for providing accurate, current, and complete information during registration and throughout your use of the platform, including your name, phone number, license number, service area, specializations, and any documents submitted for verification.',
      'You must not create an account on behalf of another person without their consent, misrepresent your qualifications, or submit falsified documents. MOTOFIX may suspend or terminate accounts found to contain false information.',
    ],
    bullets: [
      'Keep your login credentials and OTPs secure. Do not share access with anyone else.',
      'Notify MOTOFIX if your license expires, your contact information changes, or your service area changes significantly.',
      'Your MOTOFIX Provider Number (SPN) is unique to you and must not be shared or transferred.',
    ],
  },
  {
    title: '4. Job requests and dispatch',
    Icon: Briefcase,
    accent: R,
    body: [
      'When a driver submits a request that matches your availability and location, you will receive a job alert. You may accept or decline the request. Accepting a request creates a service commitment — the driver is notified and begins expecting your arrival.',
      'Once accepted, you are expected to navigate to the driver\'s location promptly, complete the service to a professional standard, and update your job status accurately through the app.',
    ],
    bullets: [
      'Repeatedly accepting and abandoning jobs without valid reason may result in warnings, reduced job visibility, or account suspension.',
      'If you cannot complete a job after accepting it, contact MOTOFIX support promptly so the driver can be reassigned.',
      'Estimated arrival times should reflect your genuine ability to reach the driver, not be used to secure acceptance.',
    ],
  },
  {
    title: '5. Professional conduct and quality',
    Icon: Wrench,
    accent: '#A78BFA',
    body: [
      'As a MOTOFIX service provider, you represent the platform when serving drivers. You are expected to behave professionally, communicate clearly, perform work competently, and treat every driver with respect and courtesy.',
      'MOTOFIX may review ratings, complaints, job records, and support reports to assess provider conduct. Poor conduct may result in re-training requirements, visibility restrictions, or account suspension.',
    ],
    bullets: [
      'Do not perform work beyond the scope of the requested service without explaining and agreeing on additional charges.',
      'Do not solicit payments outside the platform or attempt to collect cash in place of platform-facilitated transactions where applicable.',
      'Do not intimidate, threaten, deceive, or abuse drivers or platform support staff.',
    ],
  },
  {
    title: '6. Earnings, payouts, and payments',
    Icon: CreditCard,
    accent: '#22C55E',
    body: [
      'Earnings are calculated based on completed jobs, applicable platform rates, and any bonuses or adjustments shown in the app. MOTOFIX may deduct platform fees, corrections for disputed jobs, or other charges as disclosed in the app.',
      'Payouts are processed through the payment methods registered in your provider account. You are responsible for ensuring your mobile money number or bank details are correct. MOTOFIX is not responsible for payout failures caused by incorrect details.',
    ],
    bullets: [
      'Do not attempt to inflate earnings by falsifying job records, GPS data, or completion status.',
      'Payment disputes should be raised through official support channels within a reasonable time after the job.',
      'MOTOFIX may withhold payouts if fraud, unresolved disputes, or policy violations are under investigation.',
    ],
  },
  {
    title: '7. Availability and reliability',
    Icon: BadgeCheck,
    accent: '#38BDF8',
    body: [
      'When you mark yourself as available, drivers and the platform may rely on your presence in the area. Repeatedly going offline immediately after accepting requests, or staying online without genuinely being available, undermines the reliability of the platform.',
      'MOTOFIX may use availability patterns, job completion rates, and response times to assess provider reliability. Providers with consistently poor reliability metrics may be deprioritised in dispatch or receive fewer requests.',
    ],
  },
  {
    title: '8. Ratings and reviews',
    Icon: Star,
    accent: Y,
    body: [
      'After each job, drivers may rate and review your service. These ratings affect your profile visibility, dispatch priority, and standing on the platform. MOTOFIX may review and moderate ratings reported as fraudulent or abusive.',
      'You must not attempt to manipulate ratings by coercing drivers, submitting fake reviews, or engaging in review trading with other providers.',
    ],
    bullets: [
      'Maintain professionalism throughout every job to protect your rating.',
      'If you believe a rating is unfair or retaliatory, you may report it to MOTOFIX support for review.',
    ],
  },
  {
    title: '9. Safety and prohibited use',
    Icon: AlertTriangle,
    accent: R,
    body: [
      'You must use MOTOFIX responsibly and lawfully. You must not use the platform to engage in unsafe practices, deceptive billing, abusive behaviour, or conduct that endangers drivers, the public, or yourself.',
      'MOTOFIX may restrict, suspend, or permanently terminate your access if it detects misuse, repeated complaints, fraudulent job records, abusive conduct, or violation of these terms.',
    ],
    bullets: [
      'Do not perform work you are not qualified or equipped to do safely.',
      'Do not conduct roadside work in locations that put you or the driver at serious risk without taking appropriate precautions.',
      'Do not upload false, offensive, misleading, or unrelated content to the platform.',
      'Do not attempt to reverse-engineer, scrape, or disrupt the MOTOFIX platform or its APIs.',
    ],
  },
  {
    title: '10. Privacy and data handling',
    Icon: Lock,
    accent: '#C084FC',
    body: [
      'MOTOFIX processes your account information, phone number, location data, job history, uploaded credentials, device information, analytics, and support communications to operate and improve the platform.',
      'Your location is used while you are marked as available or on an active job. Some data is required for essential functions such as dispatch, earnings calculation, fraud prevention, safety, and support, even if general analytics are disabled.',
    ],
  },
  {
    title: '11. Liability and service limits',
    Icon: Gavel,
    accent: '#F97316',
    body: [
      'MOTOFIX provides tools to connect service providers with drivers. The platform does not guarantee a minimum number of jobs, earnings, payout amounts, or sustained demand in your area. Job availability depends on market conditions outside MOTOFIX\'s control.',
      'To the extent permitted by applicable law, MOTOFIX is not responsible for indirect losses, missed earnings, disputes with drivers, damage caused by third-party tools or parts, or consequences of inaccurate GPS data or network failures.',
    ],
  },
  {
    title: '12. Changes, suspension, and contact',
    Icon: ShieldCheck,
    accent: Y,
    body: [
      'MOTOFIX may update these terms as the platform evolves. Material changes may be communicated through the app, SMS, or email. Continued use after changes take effect means you accept the updated terms.',
      'For support, disputes, payment concerns, account issues, safety reports, or questions about these terms, contact the MOTOFIX support team through the app or the official support channels provided by MOTOFIX.',
    ],
  },
]

function Pill({ children, accent = Y }: { children: React.ReactNode; accent?: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: 26,
      padding: '0 11px',
      borderRadius: 999,
      background: `${accent}14`,
      border: `1px solid ${accent}33`,
      color: accent,
      fontSize: 11,
      fontWeight: 800,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

function Section({ item, index }: { item: SectionItem; index: number }) {
  const Icon = item.Icon
  return (
    <section style={{
      display: 'grid',
      gridTemplateColumns: '42px minmax(0, 1fr)',
      gap: 14,
      padding: '18px 0',
      borderTop: index === 0 ? 'none' : '1px solid var(--border-1)',
    }}>
      <div style={{
        width: 42,
        height: 42,
        borderRadius: 14,
        background: `${item.accent}14`,
        border: `1.5px solid ${item.accent}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'sticky',
        top: 84,
      }}>
        <Icon style={{ width: 18, height: 18, color: item.accent }} />
      </div>

      <div>
        <h2 style={{ color: 'var(--text-hi)', fontSize: 16, lineHeight: 1.25, fontWeight: 900, marginBottom: 10 }}>
          {item.title}
        </h2>
        {item.body.map((paragraph, i) => (
          <p key={i} style={{
            color: 'var(--text-md)',
            fontSize: 13,
            lineHeight: 1.72,
            marginBottom: i === item.body.length - 1 && !item.bullets ? 0 : 10,
          }}>
            {paragraph}
          </p>
        ))}
        {item.bullets && (
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {item.bullets.map((bullet, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: item.accent, marginTop: 8, flexShrink: 0,
                }} />
                <p style={{ color: 'var(--text-lo)', fontSize: 12, lineHeight: 1.55 }}>{bullet}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default function TermsConditions() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTab = (location.state as { returnTab?: string } | null)?.returnTab ?? 'home'

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--page-bg)', color: 'var(--text-hi)', paddingBottom: 44 }}>

      {/* ── Sticky header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--overlay-bg)', borderBottom: '1px solid var(--border-2)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      }}>
        <div style={{
          maxWidth: 760, margin: '0 auto',
          padding: 'max(env(safe-area-inset-top, 0px), 14px) 16px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={() => navigate('/dashboard', { state: { tab: returnTab } })}
            aria-label="Back"
            style={{
              width: 38, height: 38, borderRadius: 12,
              border: '1px solid var(--border-3)', background: 'var(--surface-3)',
              color: 'var(--text-md)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <ArrowLeft style={{ width: 18, height: 18 }} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ color: `${Y}bf`, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 800, marginBottom: 3 }}>
              MOTOFIX Legal
            </p>
            <h1 style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 19, letterSpacing: 0, lineHeight: 1.1 }}>
              Terms & Conditions
            </h1>
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '22px 16px 0' }}>

        {/* ── Hero block ── */}
        <div style={{
          borderRadius: 20, background: 'var(--surface-1)', border: '1px solid var(--border-2)',
          overflow: 'hidden', marginBottom: 18,
        }}>
          <div style={{
            padding: '22px 20px',
            background: `linear-gradient(135deg, ${Y}14, transparent 68%)`,
            borderBottom: '1px solid var(--border-1)',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: `${Y}18`, border: `1.5px solid ${Y}3d`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 15,
            }}>
              <FileText style={{ width: 24, height: 24, color: Y }} />
            </div>
            <h2 style={{ color: 'var(--text-hi)', fontSize: 23, lineHeight: 1.15, fontWeight: 900, marginBottom: 10 }}>
              The agreement for operating as a MOTOFIX Service Provider
            </h2>
            <p style={{ color: 'var(--text-md)', fontSize: 13, lineHeight: 1.65, maxWidth: 620 }}>
              These terms explain your rights and responsibilities as a mechanic, technician, or towing operator
              registered on the MOTOFIX platform — covering job acceptance, conduct, earnings, safety, and more.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
              <Pill>Last updated: 22 April 2026</Pill>
              <Pill accent="#A78BFA">Service Provider App</Pill>
              <Pill accent="#34D399">Mechanics & Towing</Pill>
            </div>
          </div>

          <div style={{ padding: '4px 20px 2px' }}>
            {TERMS.map((item, index) => (
              <Section key={item.title} item={item} index={index} />
            ))}
          </div>
        </div>

        {/* ── Safety reminder ── */}
        <div style={{
          borderRadius: 18, background: `${R}0d`, border: `1px solid ${R}26`,
          padding: '15px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <AlertTriangle style={{ width: 18, height: 18, color: R, flexShrink: 0, marginTop: 1 }} />
          <p style={{ color: 'var(--text-md)', fontSize: 12, lineHeight: 1.58 }}>
            Roadside work can be dangerous. Always prioritise your safety and the driver's safety. If there is
            injury, fire, violence, or immediate danger, contact public emergency services before proceeding
            with any roadside service.
          </p>
        </div>

      </main>
    </div>
  )
}
