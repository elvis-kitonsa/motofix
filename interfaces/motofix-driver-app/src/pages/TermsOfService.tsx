// TermsOfService.tsx — the static terms-of-service screen (the rules of using MOTOFIX).
// Reached from Settings; content only, no logic.

import { useNavigate } from 'react-router-dom';
import type { ElementType } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  FileText,
  Gavel,
  LifeBuoy,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';

const Y = '#F59E0B';
const R = '#ff2d2d';

type SectionItem = {
  title: string;
  Icon: ElementType;
  accent: string;
  body: string[];
  bullets?: string[];
};

const TERMS: SectionItem[] = [
  {
    title: '1. Acceptance of these terms',
    Icon: FileText,
    accent: Y,
    body: [
      'These Terms of Service govern your access to and use of MOTOFIX, including the driver app, roadside assistance request flow, SOS dispatch tools, fault diagnosis features, payment or quote flows, and related support services.',
      'By creating an account, signing in, requesting assistance, submitting a claim, or continuing to use MOTOFIX, you agree to these terms. If you do not agree, you should not use the app.',
    ],
  },
  {
    title: '2. What MOTOFIX does',
    Icon: LifeBuoy,
    accent: '#60A5FA',
    body: [
      'MOTOFIX is a roadside assistance platform designed for drivers who need help with vehicle faults, breakdowns, towing needs, fuel issues, battery problems, tyre problems, emergency assistance, and related support.',
      'The app helps you describe a fault, share your location, request assistance, track request progress, communicate with support or providers where available, and receive updates about the status of your request.',
    ],
    bullets: [
      'MOTOFIX connects drivers with available mechanics, towing providers, or roadside responders.',
      'MOTOFIX may use location, request details, media, and diagnosis information to help route your request.',
      'Service availability depends on provider coverage, network conditions, time, location, and request type.',
    ],
  },
  {
    title: '3. Your account and information',
    Icon: UserCheck,
    accent: '#34D399',
    body: [
      'You are responsible for the accuracy of the information you provide, including your phone number, name, vehicle details, fault description, location, and any media or documents uploaded through the app.',
      'You are responsible for keeping access to your device, OTPs, and account secure. If you believe your account has been accessed without permission, contact MOTOFIX support as soon as possible.',
    ],
    bullets: [
      'Do not create accounts using false, misleading, or someone else\'s information.',
      'Do not share OTPs or account access with another person.',
      'Do not use the app to submit fake emergency requests or fraudulent claims.',
    ],
  },
  {
    title: '4. Location and dispatch',
    Icon: MapPin,
    accent: R,
    body: [
      'MOTOFIX uses your location to understand where assistance is needed and to help match your request with nearby service providers. Location is especially important for SOS and emergency assistance flows.',
      'You may be asked to allow GPS access before a request can continue. If location access is disabled, inaccurate, or unavailable, MOTOFIX may not be able to dispatch help correctly.',
    ],
    bullets: [
      'You should confirm that your pinned location is safe and accurate before submitting a request.',
      'If you move after submitting a request, you may need to update your location or contact support.',
      'Estimated arrival times are not guarantees and may change because of traffic, weather, distance, provider availability, or network delays.',
    ],
  },
  {
    title: '5. Service providers',
    Icon: BadgeCheck,
    accent: '#A78BFA',
    body: [
      'Mechanics, towing operators, responders, and other service providers may be independent third parties. MOTOFIX may verify or review providers, but the physical repair, towing, inspection, or roadside work is performed by the provider, not by the app itself.',
      'You should use reasonable judgment before accepting work, prices, parts, towing arrangements, or advice from a provider. Report unsafe, abusive, fraudulent, or unprofessional conduct immediately.',
    ],
    bullets: [
      'Provider ratings, verification status, distance, or availability do not guarantee a specific outcome.',
      'You may be asked to approve a quote before work begins or before payment is collected.',
      'Do not arrange unsafe roadside work in dangerous traffic, insecure areas, or places where stopping is prohibited.',
    ],
  },
  {
    title: '6. AI fault diagnosis',
    Icon: Sparkles,
    accent: '#FB923C',
    body: [
      'MOTOFIX may include AI-assisted diagnosis tools that help you describe a vehicle issue from text, photos, or chat messages. These tools are intended to support triage and request routing, not to replace a qualified mechanic, emergency responder, insurer, or professional inspection.',
      'AI outputs may be incomplete, inaccurate, or unsuitable for your specific vehicle or situation. You should not rely on AI diagnosis where safety, medical, legal, financial, or mechanical risk is significant.',
    ],
    bullets: [
      'Always follow road safety rules and move to a safe location where possible.',
      'Do not attempt repairs that you are not trained or equipped to perform.',
      'If there is injury, fire, crime, or immediate danger, contact emergency authorities first.',
    ],
  },
  {
    title: '7. Payments, quotes, and charges',
    Icon: CreditCard,
    accent: '#22C55E',
    body: [
      'Where payments or quotes are enabled, prices may include labour, parts, towing, platform fees, taxes, or other charges shown in the app or communicated by the provider. You are responsible for reviewing the quoted amount before approving it.',
      'Payment methods may include mobile money, card, cash, or other supported methods depending on availability. Some payment features may still be introduced, tested, or limited by deployment.',
    ],
    bullets: [
      'Do not approve a quote unless you understand what it covers.',
      'Refunds, disputes, failed collections, and provider payouts may be reviewed by MOTOFIX support.',
      'MOTOFIX may suspend payment features where fraud, misuse, or unresolved disputes are suspected.',
    ],
  },
  {
    title: '8. Insurance and claims features',
    Icon: ShieldCheck,
    accent: '#38BDF8',
    body: [
      'If insurance claim features are available, the app may allow you to submit incident details, photos, dates, times, locations, and descriptions. Submitting a claim through MOTOFIX does not guarantee approval, settlement, or coverage.',
      'You are responsible for submitting truthful and complete claim information. False statements, staged incidents, altered photos, or misleading documents may lead to claim rejection, account suspension, and referral to the relevant insurer or authority.',
    ],
  },
  {
    title: '9. Safety and prohibited use',
    Icon: AlertTriangle,
    accent: R,
    body: [
      'You must use MOTOFIX responsibly and lawfully. The platform must not be used to endanger yourself, service providers, other road users, or the public.',
      'MOTOFIX may restrict, suspend, or terminate access if it detects misuse, repeated fake requests, abusive conduct, fraud, interference with the system, or violation of these terms.',
    ],
    bullets: [
      'Do not submit false emergency requests.',
      'Do not threaten, harass, or abuse providers, support staff, or other users.',
      'Do not upload illegal, offensive, misleading, or unrelated content.',
      'Do not try to bypass security, reverse-engineer the app, scrape data, or disrupt the services.',
    ],
  },
  {
    title: '10. Privacy and data handling',
    Icon: Lock,
    accent: '#C084FC',
    body: [
      'MOTOFIX may process account information, phone numbers, location data, request history, uploaded media, device information, crash reports, analytics, payment references, and support communications to provide and improve the service.',
      'Your privacy settings may allow you to control some analytics, crash reporting, notification, and location preferences. Some data is still required for essential app functions such as authentication, dispatch, fraud prevention, safety, support, and legal compliance.',
    ],
  },
  {
    title: '11. Liability and service limits',
    Icon: Gavel,
    accent: '#F97316',
    body: [
      'MOTOFIX aims to provide a reliable roadside assistance experience, but the app is provided on an "as available" basis. We do not guarantee uninterrupted operation, error-free maps, perfect matching, exact arrival times, provider availability, or successful repair outcomes.',
      'To the extent permitted by applicable law, MOTOFIX is not responsible for indirect losses, missed appointments, loss of income, damage caused by third-party providers, delays, network failures, inaccurate location data, or decisions made solely from AI diagnosis.',
    ],
  },
  {
    title: '12. Changes, suspension, and contact',
    Icon: ShieldCheck,
    accent: '#F59E0B',
    body: [
      'MOTOFIX may update these terms as the app grows. Material changes may be communicated through the app, SMS, email, or another reasonable method. Continued use after changes take effect means you accept the updated terms.',
      'For support, disputes, safety reports, provider complaints, payment concerns, or questions about these terms, contact the MOTOFIX support team through the app or the official support channels provided by MOTOFIX.',
    ],
  },
];

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
  );
}

function Section({ item, index }: { item: SectionItem; index: number }) {
  const Icon = item.Icon;

  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: '42px minmax(0, 1fr)',
        gap: 14,
        padding: '18px 0',
        borderTop: index === 0 ? 'none' : '1px solid var(--border-1)',
      }}
    >
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
        <h2 style={{
          color: 'var(--text-hi)',
          fontSize: 16,
          lineHeight: 1.25,
          fontWeight: 900,
          marginBottom: 10,
        }}>
          {item.title}
        </h2>

        {item.body.map((paragraph, i) => (
          <p
            key={i}
            style={{
              color: 'var(--text-md)',
              fontSize: 13,
              lineHeight: 1.72,
              marginBottom: i === item.body.length - 1 && !item.bullets ? 0 : 10,
            }}
          >
            {paragraph}
          </p>
        ))}

        {item.bullets && (
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {item.bullets.map((bullet, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: item.accent,
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

export default function TermsOfService() {
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
              color: `${Y}bf`,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              fontWeight: 800,
              marginBottom: 3,
            }}>
              MOTOFIX Legal
            </p>
            <h1 style={{
              color: 'var(--text-hi)',
              fontWeight: 900,
              fontSize: 19,
              letterSpacing: 0,
              lineHeight: 1.1,
            }}>
              Terms of Service
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
            background: `linear-gradient(135deg, ${Y}14, transparent 68%)`,
            borderBottom: '1px solid var(--border-1)',
          }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: `${Y}18`,
              border: `1.5px solid ${Y}3d`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 15,
            }}>
              <FileText style={{ width: 24, height: 24, color: Y }} />
            </div>

            <h2 style={{
              color: 'var(--text-hi)',
              fontSize: 23,
              lineHeight: 1.15,
              letterSpacing: 0,
              fontWeight: 900,
              marginBottom: 10,
            }}>
              The agreement for using MOTOFIX roadside assistance
            </h2>

            <p style={{ color: 'var(--text-md)', fontSize: 13, lineHeight: 1.65, maxWidth: 620 }}>
              These terms explain how MOTOFIX works when you request help, share your location,
              use AI diagnosis, approve quotes, submit claim information, or communicate with
              support and service providers.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
              <Pill>Last updated: 22 April 2026</Pill>
              <Pill accent="#34D399">Driver App</Pill>
              <Pill accent={R}>SOS Assistance</Pill>
            </div>
          </div>

          <div style={{ padding: '4px 20px 2px' }}>
            {TERMS.map((item, index) => (
              <Section key={item.title} item={item} index={index} />
            ))}
          </div>
        </div>

        <div style={{
          borderRadius: 18,
          background: `${R}0d`,
          border: `1px solid ${R}26`,
          padding: '15px 16px',
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}>
          <AlertTriangle style={{ width: 18, height: 18, color: R, flexShrink: 0, marginTop: 1 }} />
          <p style={{ color: 'var(--text-md)', fontSize: 12, lineHeight: 1.58 }}>
            Roadside emergencies can be dangerous. MOTOFIX helps coordinate assistance, but you
            remain responsible for following traffic laws, staying in a safe location, and contacting
            public emergency services when there is injury, fire, violence, or immediate danger.
          </p>
        </div>
      </main>
    </div>
  );
}
