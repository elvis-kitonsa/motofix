import type { ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Camera,
  Database,
  EyeOff,
  FileCheck,
  Fingerprint,
  Lock,
  MapPin,
  MessageSquare,
  Shield,
  Smartphone,
  UserRound,
} from 'lucide-react';

const Y = '#F59E0B';
const P = '#A78BFA';

type PolicySection = {
  title: string;
  Icon: ElementType;
  accent: string;
  body: string[];
  bullets?: string[];
};

const SECTIONS: PolicySection[] = [
  {
    title: '1. Information you provide',
    Icon: UserRound,
    accent: '#60A5FA',
    body: [
      'When you use MOTOFIX, you may provide personal and vehicle information such as your name, phone number, vehicle details, number plate, fault descriptions, request notes, support messages, and settings preferences.',
      'You may also provide documents, claim details, incident descriptions, or photos when using verification, insurance, support, or fault diagnosis features.',
    ],
    bullets: [
      'Account details help us identify you and keep your driver profile available across sessions.',
      'Vehicle and request details help us understand the type of help you need.',
      'Support messages help us investigate complaints, safety issues, failed requests, or payment concerns.',
    ],
  },
  {
    title: '2. Location information',
    Icon: MapPin,
    accent: '#ff2d2d',
    body: [
      'MOTOFIX uses location information to dispatch nearby assistance, show relevant providers, improve request tracking, support emergency/SOS flows, and help confirm where roadside help is needed.',
      'The app may use your GPS coordinates, typed location, reverse-geocoded address, and request destination. Background location depends on your device permissions and in-app settings.',
    ],
    bullets: [
      'Precise location is most important during active assistance requests.',
      'Disabling location access may prevent some request and tracking features from working properly.',
      'You should avoid sharing a location that puts you or a responder in danger.',
    ],
  },
  {
    title: '3. Photos, media, and documents',
    Icon: Camera,
    accent: '#FB923C',
    body: [
      'If you upload vehicle photos, fault images, claim photos, documents, or other media, MOTOFIX may process them to understand the issue, route your request, support AI diagnosis, review claims, or help resolve disputes.',
      'You should only upload content that is relevant to the request or feature you are using. Do not upload illegal, misleading, offensive, or unrelated material.',
    ],
  },
  {
    title: '4. AI diagnosis and chat data',
    Icon: MessageSquare,
    accent: '#34D399',
    body: [
      'MOTOFIX may process your fault descriptions, chat messages, and uploaded images through AI-assisted diagnosis tools. These tools help classify issues, suggest next steps, and prepare better roadside assistance requests.',
      'AI diagnosis is used to support triage and app experience. It is not a substitute for a professional mechanic, emergency responder, insurer, or safety authority.',
    ],
  },
  {
    title: '5. Device, app, and usage data',
    Icon: Smartphone,
    accent: '#38BDF8',
    body: [
      'We may collect technical information such as device type, app version, browser/runtime information, crash reports, error logs, network status, notification preferences, and general feature usage.',
      'This helps us keep the app reliable, investigate bugs, improve performance, detect misuse, and understand which features are working well for drivers.',
    ],
    bullets: [
      'You can control some analytics and crash-reporting preferences from Settings.',
      'Some technical logs may still be required for security, fraud prevention, diagnostics, or legal compliance.',
    ],
  },
  {
    title: '6. Authentication and security',
    Icon: Fingerprint,
    accent: P,
    body: [
      'MOTOFIX uses authentication information such as phone numbers, OTP verification, tokens, and stored session data to keep your account signed in and secure.',
      'Where biometric login is available, biometric checks are handled by your device. MOTOFIX does not receive or store your fingerprint or face data.',
    ],
  },
  {
    title: '7. Payments, quotes, and transaction data',
    Icon: FileCheck,
    accent: '#22C55E',
    body: [
      'If payments or quotes are enabled, MOTOFIX may process quote amounts, approval status, collection status, payment references, payout references, mechanic payout information, and transaction history.',
      'Payment data is used to process approved charges, show request and payment status, resolve disputes, detect fraud, and support financial records where required.',
    ],
  },
  {
    title: '8. Notifications and communications',
    Icon: Bell,
    accent: '#F472B6',
    body: [
      'We may contact you through push notifications, SMS, in-app messages, phone calls, or support channels about OTPs, active requests, provider updates, quotes, claims, safety alerts, account issues, and important service changes.',
      'You can manage some notification preferences in Settings. Critical messages related to security, OTPs, active requests, payments, or safety may still be sent when necessary.',
    ],
  },
  {
    title: '9. How we use your information',
    Icon: Database,
    accent: Y,
    body: [
      'We use your information to provide, maintain, secure, personalize, and improve MOTOFIX. This includes authentication, request creation, dispatch, provider matching, request tracking, diagnosis support, claims support, customer service, payments, analytics, and fraud prevention.',
      'We may also use information to comply with applicable law, enforce our terms, investigate safety incidents, and protect drivers, providers, MOTOFIX, and the public.',
    ],
  },
  {
    title: '10. Sharing your information',
    Icon: Shield,
    accent: '#F97316',
    body: [
      'We share information only where needed to operate MOTOFIX, provide roadside assistance, comply with law, or protect safety. For example, a service provider may need your request type, location, phone number, vehicle issue, and approved quote details to assist you.',
      'We may also share relevant information with payment processors, insurance partners, analytics or hosting providers, support tools, law enforcement, regulators, or emergency services where appropriate.',
    ],
    bullets: [
      'We do not sell your personal information.',
      'We aim to share only what is necessary for the specific service or purpose.',
      'Third-party services may have their own privacy practices and security obligations.',
    ],
  },
  {
    title: '11. Retention and deletion',
    Icon: Lock,
    accent: '#C084FC',
    body: [
      'MOTOFIX keeps information for as long as needed to provide services, maintain request history, resolve disputes, process payments or claims, comply with legal duties, prevent fraud, and improve the app.',
      'You may contact support to request access, correction, or deletion of your information. Some records may need to be retained where required for safety, legal, financial, security, or dispute-resolution reasons.',
    ],
  },
  {
    title: '12. Your choices and contact',
    Icon: EyeOff,
    accent: P,
    body: [
      'You can manage theme, notifications, location preferences, analytics sharing, crash reports, and biometric login from the Settings page. You can also manage operating-system permissions from your device settings.',
      'For privacy questions, data requests, or concerns about how MOTOFIX handles your information, contact the MOTOFIX support team through the app or official support channels.',
    ],
  },
];

function Chip({ children, accent = Y }: { children: React.ReactNode; accent?: string }) {
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
  );
}

function Section({ section, index }: { section: PolicySection; index: number }) {
  const Icon = section.Icon;

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
        background: `${section.accent}14`,
        border: `1.5px solid ${section.accent}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'sticky',
        top: 84,
      }}>
        <Icon style={{ width: 18, height: 18, color: section.accent }} />
      </div>

      <div>
        <h2 style={{
          color: 'var(--text-hi)',
          fontSize: 16,
          lineHeight: 1.25,
          fontWeight: 900,
          marginBottom: 10,
        }}>
          {section.title}
        </h2>

        {section.body.map((paragraph, i) => (
          <p
            key={i}
            style={{
              color: 'var(--text-md)',
              fontSize: 13,
              lineHeight: 1.72,
              marginBottom: i === section.body.length - 1 && !section.bullets ? 0 : 10,
            }}
          >
            {paragraph}
          </p>
        ))}

        {section.bullets && (
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {section.bullets.map((bullet, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: section.accent,
                  marginTop: 8,
                  flexShrink: 0,
                }} />
                <p style={{ color: 'var(--text-lo)', fontSize: 12, lineHeight: 1.55 }}>
                  {bullet}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--page-bg)',
      color: 'var(--text-hi)',
      paddingBottom: 44,
    }}>
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'var(--overlay-bg)',
        borderBottom: '1px solid var(--border-2)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}>
        <div style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: 'max(env(safe-area-inset-top, 0px), 14px) 16px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <button
            onClick={() => navigate('/settings', { replace: true, state: { skipSettingsIntro: true } })}
            aria-label="Back"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              border: '1px solid var(--border-3)',
              background: 'var(--surface-3)',
              color: 'var(--text-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ArrowLeft style={{ width: 18, height: 18 }} />
          </button>

          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              color: `${P}d9`,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              fontWeight: 800,
              marginBottom: 3,
            }}>
              MOTOFIX Privacy
            </p>
            <h1 style={{
              color: 'var(--text-hi)',
              fontWeight: 900,
              fontSize: 19,
              letterSpacing: 0,
              lineHeight: 1.1,
            }}>
              Privacy Policy
            </h1>
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '22px 16px 0' }}>
        <div style={{
          borderRadius: 20,
          background: 'var(--surface-1)',
          border: '1px solid var(--border-2)',
          overflow: 'hidden',
          marginBottom: 18,
        }}>
          <div style={{
            padding: '22px 20px',
            background: `linear-gradient(135deg, ${P}14, transparent 68%)`,
            borderBottom: '1px solid var(--border-1)',
          }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: `${P}18`,
              border: `1.5px solid ${P}3d`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 15,
            }}>
              <EyeOff style={{ width: 24, height: 24, color: P }} />
            </div>

            <h2 style={{
              color: 'var(--text-hi)',
              fontSize: 23,
              lineHeight: 1.15,
              letterSpacing: 0,
              fontWeight: 900,
              marginBottom: 10,
            }}>
              How MOTOFIX handles your data
            </h2>

            <p style={{ color: 'var(--text-md)', fontSize: 13, lineHeight: 1.65, maxWidth: 620 }}>
              This policy explains what information MOTOFIX collects, why we use it,
              when it may be shared, and the choices you have while using the driver app,
              SOS dispatch, AI diagnosis, payments, and insurance features.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
              <Chip>Last updated: 22 April 2026</Chip>
              <Chip accent="#34D399">Driver Data</Chip>
              <Chip accent="#ff2d2d">Location Aware</Chip>
            </div>
          </div>

          <div style={{ padding: '4px 20px 2px' }}>
            {SECTIONS.map((section, index) => (
              <Section key={section.title} section={section} index={index} />
            ))}
          </div>
        </div>

        <div style={{
          borderRadius: 18,
          background: `${P}0d`,
          border: `1px solid ${P}26`,
          padding: '15px 16px',
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}>
          <Lock style={{ width: 18, height: 18, color: P, flexShrink: 0, marginTop: 1 }} />
          <p style={{ color: 'var(--text-md)', fontSize: 12, lineHeight: 1.58 }}>
            Privacy controls in Settings affect optional preferences, but MOTOFIX still needs
            certain information to authenticate you, dispatch assistance, protect safety, prevent
            fraud, process active requests, and meet legal or support obligations.
          </p>
        </div>
      </main>
    </div>
  );
}
