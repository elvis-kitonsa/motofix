// Apply.tsx — the multi-step application form for someone wanting to join as a mechanic or
// tow provider: their details, provider type, specialisations and document uploads. Submitted
// for an admin to review (see the admin portal's Applications screens).

import { useState, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Wrench, Truck, User,
  Building2, Clock, Check, Settings, Upload,
  ShieldCheck, Globe, X, Plus, ImageIcon, Loader2,
} from 'lucide-react'
import { mechanicService } from '@/config/api'
import { toast } from 'sonner'

const SURFACE  = 'var(--surface-2)'
const BORDER   = 'var(--border-1)'
const BORDER_S = 'var(--border-1)'
const TEXT     = 'var(--text-hi)'
const MUTED    = 'var(--text-md)'
const FAINT    = 'var(--text-lo)'
const AMBER    = '#F59E0B'
const TEAL     = '#5EEAD4'
const INDIGO   = '#4F46E5'
const RED      = '#DC2626'

type ServiceType = 'mechanical' | 'towing' | 'both'
type OwnerType   = 'individual' | 'registered' | ''

const MECH_SERVICES = [
  'Engine & Mechanical Repairs', 'Electrical & Electronics',
  'Tire Services', 'Brakes & Suspension',
  'Air Conditioning', 'Body & Panel Beating',
  'General Servicing', 'Welding & Fabrication',
]
const TOW_SERVICES = [
  'Light Vehicles (Cars & SUVs)', 'Heavy Vehicles (Trucks & Buses)',
  'Motorcycles', 'Accident Recovery',
  'Long Distance Towing', 'Winching Services',
]
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TOTAL_STEPS = 6

export default function Apply() {
  const navigate = useNavigate()

  useLayoutEffect(() => {
    document.body.style.background = 'var(--bg)'
    return () => { document.body.style.background = '' }
  }, [])

  const [step, setStep]         = useState(0)
  const [exiting, setExiting]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)

  const [form, setForm] = useState({
    serviceType:   '' as ServiceType | '',
    ownershipType: '' as OwnerType,

    fullName: '', phone: '', email: '', nationalId: '',

    garageName: '', businessRegNo: '', address: '', town: '',
    depotAddress: '', website: '',

    workDays:       ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as string[],
    openTime:       '08:00', closeTime: '18:00',
    staffCount:     '', mechanicCount: '', truckCount: '',
    services:       [] as string[], towServices: [] as string[],
    customServices: [] as string[],
    maxTowDistance: '', emergency24h: false,

    nationalIdFile:  null as File | null,
    workDocType:     '' as 'permit' | 'attachment' | '',
    workDocFile:     null as File | null,
    workplacePhotos: [] as File[],
  })

  const set = (f: string, v: unknown) => setForm(p => ({ ...p, [f]: v }))

  const toggleArr = (f: 'services' | 'towServices' | 'workDays', val: string) =>
    setForm(p => ({
      ...p,
      [f]: (p[f] as string[]).includes(val)
        ? (p[f] as string[]).filter(x => x !== val)
        : [...(p[f] as string[]), val],
    }))

  const goTo = (target: number) => {
    setExiting(true)
    setTimeout(() => { setStep(target); setExiting(false) }, 260)
  }

  const selectType = (type: ServiceType) => {
    setExiting(true)
    setTimeout(() => { set('serviceType', type); setStep(1); setExiting(false) }, 260)
  }

  const selectOwnership = (type: OwnerType) => {
    setExiting(true)
    setTimeout(() => { set('ownershipType', type); setStep(2); setExiting(false) }, 260)
  }

  const back = () => {
    if (step === 0) navigate('/entry')
    else if (step === 1) { set('serviceType', ''); goTo(0) }
    else if (step === 2) { set('ownershipType', ''); goTo(1) }
    else goTo(step - 1)
  }

  // ── Validation ──────────────────────────────────────────────────
  const isInd = form.ownershipType === 'individual'
  const isReg = form.ownershipType === 'registered'

  const step2Ok = isInd
    ? !!(form.fullName.trim() && form.phone.trim().length >= 9 && form.nationalId.trim())
    : !!(form.fullName.trim() && form.phone.trim().length >= 9)

  const step3Ok = isInd
    ? !!(form.garageName.trim() && form.address.trim() && form.town.trim())
    : !!(form.garageName.trim() && form.businessRegNo.trim() && form.address.trim() && form.town.trim())

  const hasAnyService = form.services.length > 0 || form.towServices.length > 0 || form.customServices.length > 0
  const step4Ok = form.serviceType === 'both'
    ? !!(form.workDays.length > 0 && (form.mechanicCount.trim() || form.truckCount.trim()) && hasAnyService)
    : !!(hasAnyService && form.workDays.length > 0 && form.staffCount.trim())

  const step5Ok = isReg
    ? !!(form.workDocFile && form.workplacePhotos.length >= 1)
    : !!(form.nationalIdFile && form.workDocType && form.workDocFile && form.workplacePhotos.length >= 1)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const raw = form.phone.replace(/\D/g, '')
      const phone = raw.startsWith('256') ? '+' + raw
        : raw.startsWith('0') ? '+256' + raw.slice(1)
        : raw.length > 0 ? '+256' + raw : form.phone

      // Keep "both" distinct — these providers are the ones eligible for Breakdown Rescue jobs.
      const providerType = form.serviceType === 'towing' ? 'towing_provider' : form.serviceType === 'both' ? 'both' : 'mechanic'

      const fd = new FormData()
      fd.append('full_name', form.fullName.trim())
      fd.append('phone', phone)
      fd.append('provider_type', providerType)

      if (form.email.trim())        fd.append('email', form.email.trim())
      if (form.garageName.trim())   fd.append('business_name', form.garageName.trim())
      if (form.businessRegNo.trim()) fd.append('business_reg_number', form.businessRegNo.trim())

      const addr = [form.address.trim(), form.depotAddress.trim(), form.town.trim()].filter(Boolean).join(', ')
      if (addr) { fd.append('service_area', addr); fd.append('business_address', addr) }

      const allServices = [...form.services, ...form.towServices, ...form.customServices]
      if (allServices.length > 0) fd.append('specializations', allServices.join(', '))

      if (form.nationalIdFile)        fd.append('national_id',   form.nationalIdFile)
      if (form.workDocFile)           fd.append('certification',  form.workDocFile)
      if (form.workplacePhotos[0])    fd.append('profile_photo',  form.workplacePhotos[0])

      await mechanicService.submitApplication(fd)
      setSubmitted(true)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      const msg = detail?.message ?? (typeof detail === 'string' ? detail : null)
        ?? err.message ?? 'Failed to submit application'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', border: '2px solid rgba(245,158,11,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: '0 0 32px rgba(245,158,11,0.2)' }}>
          <Check style={{ width: 32, height: 32, color: AMBER }} />
        </div>
        <h1 style={{ color: TEXT, fontWeight: 900, fontSize: 24, letterSpacing: '-0.02em', marginBottom: 10 }}>Application Submitted!</h1>
        <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, maxWidth: 300, marginBottom: 8 }}>
          Your application has been sent to MOTOFIX administration for review.
        </p>
        <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, maxWidth: 300, marginBottom: 32 }}>
          You'll receive an SMS on <span style={{ color: TEXT, fontWeight: 600 }}>{form.phone}</span> once a decision has been made — usually within 1–2 business days.
        </p>
        <button onClick={() => navigate('/entry')}
          style={{ padding: '14px 32px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${AMBER}, #B45309)`, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(245,158,11,0.30)' }}>
          Back to Home
        </button>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes step-in  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes step-out { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(-14px)} }
        @keyframes spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .step-enter { animation: step-in  0.26s ease both; }
        .step-exit  { animation: step-out 0.26s ease both; }
        .type-card  { transition: transform 0.22s ease, border-color 0.2s, box-shadow 0.2s; }
        .type-card:hover { transform: translateY(-3px); }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0' }}>
          <button onClick={back}
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
            <ArrowLeft style={{ width: 16, height: 16 }} /> Back
          </button>
          {step > 0 && (
            <span style={{ fontSize: 11, color: FAINT, fontFamily: 'monospace', fontWeight: 700 }}>
              STEP {step} OF {TOTAL_STEPS}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {step > 0 && (
          <div style={{ padding: '10px 20px 0', maxWidth: 480, margin: '0 auto', width: '100%' }}>
            <div style={{ height: 3, background: BORDER_S, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(step / TOTAL_STEPS) * 100}%`, background: AMBER, borderRadius: 2, transition: 'width 0.35s ease' }} />
            </div>
          </div>
        )}

        {/* Content */}
        <div
          className={exiting ? 'step-exit' : 'step-enter'}
          style={{ flex: 1, padding: '28px 20px 48px', maxWidth: 480, margin: '0 auto', width: '100%' }}
        >

          {/* ─── Step 0: Service Type ─────────────────────────── */}
          {step === 0 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.28)', marginBottom: 14 }}>
                  <Settings style={{ width: 11, height: 11, color: AMBER }} />
                  <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: AMBER }}>New Application</span>
                </div>
                <h1 style={{ color: TEXT, fontWeight: 900, fontSize: 23, letterSpacing: '-0.02em', marginBottom: 8 }}>
                  What kind of service provider are you?
                </h1>
                <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.65 }}>
                  Choose the category that best describes your work.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button className="type-card" onClick={() => selectType('mechanical')}
                  style={{ textAlign: 'left', padding: 20, borderRadius: 18, border: '1.5px solid rgba(245,158,11,0.28)', background: SURFACE, cursor: 'pointer', boxShadow: '0 4px 18px rgba(245,158,11,0.10), 0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.26)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Wrench style={{ width: 20, height: 20, color: AMBER }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, color: TEXT, marginBottom: 2 }}>Mechanical Repairs</p>
                      <p style={{ fontSize: 12, color: MUTED }}>Garage, workshop or roadside mechanic</p>
                    </div>
                    <ArrowRight style={{ width: 15, height: 15, color: FAINT }} />
                  </div>
                </button>
                <button className="type-card" onClick={() => selectType('towing')}
                  style={{ textAlign: 'left', padding: 20, borderRadius: 18, border: '1.5px solid rgba(20,184,166,0.28)', background: SURFACE, cursor: 'pointer', boxShadow: '0 4px 18px rgba(20,184,166,0.10), 0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Truck style={{ width: 20, height: 20, color: TEAL }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, color: TEXT, marginBottom: 2 }}>Towing & Recovery</p>
                      <p style={{ fontSize: 12, color: MUTED }}>Tow truck operator or recovery company</p>
                    </div>
                    <ArrowRight style={{ width: 15, height: 15, color: FAINT }} />
                  </div>
                </button>
                <button className="type-card" onClick={() => selectType('both')}
                  style={{ textAlign: 'left', padding: 20, borderRadius: 18, border: '1.5px solid rgba(79,70,229,0.25)', background: SURFACE, cursor: 'pointer', boxShadow: '0 4px 18px rgba(79,70,229,0.08), 0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, gap: 3 }}>
                      <Wrench style={{ width: 14, height: 14, color: INDIGO }} />
                      <Truck  style={{ width: 14, height: 14, color: INDIGO }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, color: TEXT, marginBottom: 2 }}>Both</p>
                      <p style={{ fontSize: 12, color: MUTED }}>We offer mechanical repairs and towing</p>
                    </div>
                    <ArrowRight style={{ width: 15, height: 15, color: FAINT }} />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 1: How do you operate? ──────────────────── */}
          {step === 1 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.28)', marginBottom: 14 }}>
                  <Settings style={{ width: 11, height: 11, color: AMBER }} />
                  <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: AMBER }}>Registration Type</span>
                </div>
                <h1 style={{ color: TEXT, fontWeight: 900, fontSize: 23, letterSpacing: '-0.02em', marginBottom: 8 }}>
                  How do you operate?
                </h1>
                <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.65, maxWidth: 280, margin: '0 auto' }}>
                  This determines what information and documents we'll ask you to provide.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button className="type-card" onClick={() => selectOwnership('individual')}
                  style={{ textAlign: 'left', padding: 22, borderRadius: 18, border: '1.5px solid rgba(245,158,11,0.28)', background: SURFACE, cursor: 'pointer', boxShadow: '0 4px 18px rgba(245,158,11,0.10), 0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.26)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <User style={{ width: 20, height: 20, color: AMBER }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, color: TEXT, marginBottom: 4 }}>Individual / Sole Trader</p>
                      <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>You work independently under your own name. We'll verify you using your National ID and workplace documentation.</p>
                    </div>
                    <ArrowRight style={{ width: 15, height: 15, color: FAINT, marginTop: 4, flexShrink: 0 }} />
                  </div>
                </button>
                <button className="type-card" onClick={() => selectOwnership('registered')}
                  style={{ textAlign: 'left', padding: 22, borderRadius: 18, border: '1.5px solid rgba(20,184,166,0.28)', background: SURFACE, cursor: 'pointer', boxShadow: '0 4px 18px rgba(20,184,166,0.10), 0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <Building2 style={{ width: 20, height: 20, color: TEAL }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, color: TEXT, marginBottom: 4 }}>Registered Business</p>
                      <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>You operate a formally registered company. Must be submitted by the owner or person in charge. We'll need your registration number and business permits.</p>
                    </div>
                    <ArrowRight style={{ width: 15, height: 15, color: FAINT, marginTop: 4, flexShrink: 0 }} />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Contact / Account Details ───────────── */}
          {step === 2 && (
            <div>
              <StepHeader
                icon={<User style={{ width: 16, height: 16, color: AMBER }} />}
                title={isReg ? 'Owner / Contact Person' : 'Your Details'}
                sub={isReg
                  ? 'Provide the details of the business owner or the person responsible for this account.'
                  : 'Tell us about the person responsible for this account.'} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Field label={isReg ? "Owner / Contact Person's Full Name" : 'Full Name'} required>
                  <Input value={form.fullName} onChange={v => set('fullName', v)}
                    placeholder={isReg ? 'e.g. Jane Nakato (owner or director)' : 'e.g. John Mukasa'} />
                </Field>
                <Field label="Phone Number" required>
                  <Input type="tel" value={form.phone} onChange={v => set('phone', v)} placeholder="e.g. 0712345678" maxLength={10} digitsOnly />
                </Field>
                <Field label="Email Address" hint="optional">
                  <Input type="email" value={form.email} onChange={v => set('email', v)} placeholder="e.g. john@example.com" />
                </Field>
                {isInd && (
                  <Field label="National ID / Passport Number" required>
                    <Input value={form.nationalId} onChange={v => set('nationalId', v)} placeholder="e.g. CM91234567KEMU" />
                  </Field>
                )}
              </div>
              <NextBtn disabled={!step2Ok} onClick={() => goTo(3)}
                label={isReg ? 'Continue to Business Details' : 'Continue to Business Details'} />
            </div>
          )}

          {/* ─── Step 3: Business / Fleet Details ────────────── */}
          {step === 3 && (() => {
            const isTow  = form.serviceType === 'towing'
            const isBoth = form.serviceType === 'both'
            return (
              <div>
                <StepHeader
                  icon={<Building2 style={{ width: 16, height: 16, color: isTow ? TEAL : AMBER }} />}
                  title={isTow ? 'Company / Fleet Details' : isBoth ? 'Garage & Fleet Details' : 'Business Details'}
                  sub={isReg
                    ? 'Provide your registered business details exactly as they appear on your registration documents.'
                    : 'Tell us about your trading name and where you operate from.'} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  <Field label={isInd
                    ? (isTow ? 'Trading / Operating Name' : 'Your Trading Name')
                    : (isTow ? 'Company / Fleet Name' : isBoth ? 'Garage / Company Name' : 'Garage / Business Name')} required>
                    <Input value={form.garageName} onChange={v => set('garageName', v)}
                      placeholder={isInd
                        ? (isTow ? "e.g. John's Towing Services" : "e.g. John's Auto Repairs")
                        : (isTow ? 'e.g. Swift Towing & Recovery' : isBoth ? 'e.g. Total Auto & Towing' : 'e.g. Elite Motors Garage')} />
                  </Field>

                  {isReg && (
                    <Field label="Business Registration Number" required>
                      <Input value={form.businessRegNo} onChange={v => set('businessRegNo', v)} placeholder="e.g. 80020001234567" />
                    </Field>
                  )}

                  <Field label={isInd
                    ? (isTow ? 'Where do you primarily operate from?' : 'Your primary work location / area')
                    : (isTow ? 'Depot / Base Location' : 'Workshop / Physical Address')} required>
                    <Input value={form.address} onChange={v => set('address', v)}
                      placeholder={isInd
                        ? 'e.g. Nakawa, Kampala'
                        : (isTow ? 'e.g. Industrial Area, Namanve' : 'e.g. Plot 14, Jinja Road')} />
                  </Field>

                  {isBoth && (
                    <Field label="Tow Truck Depot Address" hint="if different from workshop">
                      <Input value={form.depotAddress} onChange={v => set('depotAddress', v)}
                        placeholder="e.g. Industrial Area, Namanve" />
                    </Field>
                  )}

                  <Field label="Town / City" required>
                    <Input value={form.town} onChange={v => set('town', v)} placeholder="e.g. Kampala" />
                  </Field>

                  {isReg && (
                    <Field label="Website / Social Media" hint="optional">
                      <div style={{ position: 'relative' }}>
                        <Globe style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: FAINT }} />
                        <input
                          type="url" value={form.website}
                          onChange={e => set('website', e.target.value)}
                          placeholder="e.g. www.elitemotors.co.ug"
                          style={{ ...iStyle, paddingLeft: 36 }}
                          onFocus={e => { e.target.style.borderColor = 'rgba(245,158,11,0.55)'; e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.11)' }}
                          onBlur={e  => { e.target.style.borderColor = BORDER_S; e.target.style.boxShadow = 'none' }}
                        />
                      </div>
                    </Field>
                  )}
                </div>
                <NextBtn disabled={!step3Ok} onClick={() => goTo(4)} label="Continue to Operations" />
              </div>
            )
          })()}

          {/* ─── Step 4: Operations ──────────────────────────── */}
          {step === 4 && (() => {
            const isTow  = form.serviceType === 'towing'
            const isBoth = form.serviceType === 'both'
            const aC = (c: 'amber' | 'teal') => c === 'amber'
              ? { color: AMBER, bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.45)', check: AMBER }
              : { color: TEAL,  bg: 'rgba(20,184,166,0.08)',  border: 'rgba(20,184,166,0.45)',  check: TEAL }
            const main = isTow ? aC('teal') : aC('amber')

            const ServiceList = ({ items, field, scheme }: {
              items: string[]
              field: 'services' | 'towServices'
              scheme: ReturnType<typeof aC>
            }) => {
              const selected = form[field] as string[]
              const allChecked = items.every(s => selected.includes(s))
              const [otherInput, setOtherInput] = useState('')
              const [showOtherInput, setShowOtherInput] = useState(form.customServices.length > 0)

              const toggleAll = () => {
                if (allChecked) {
                  setForm(p => ({ ...p, [field]: [] }))
                } else {
                  setForm(p => ({ ...p, [field]: [...items] }))
                }
              }

              const addCustom = () => {
                const val = otherInput.trim()
                if (!val || form.customServices.includes(val)) return
                setForm(p => ({ ...p, customServices: [...p.customServices, val] }))
                setOtherInput('')
              }

              const removeCustom = (val: string) =>
                setForm(p => ({ ...p, customServices: p.customServices.filter(x => x !== val) }))

              const CheckRow = ({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) => (
                <button type="button" onClick={onClick}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.18s', border: `1.5px solid ${checked ? scheme.border : BORDER_S}`, background: checked ? scheme.bg : SURFACE, width: '100%' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${checked ? scheme.border : BORDER_S}`, background: checked ? scheme.check : 'transparent', transition: 'all 0.18s' }}>
                    {checked && <Check style={{ width: 11, height: 11, color: '#fff', strokeWidth: 3 }} />}
                  </div>
                  <span style={{ fontSize: 13, color: checked ? TEXT : MUTED, fontWeight: checked ? 600 : 400 }}>{label}</span>
                </button>
              )

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* All */}
                  <CheckRow label="All" checked={allChecked} onClick={toggleAll} />

                  <div style={{ height: 1, background: BORDER_S, margin: '2px 0' }} />

                  {/* Standard items */}
                  {items.map(svc => (
                    <CheckRow key={svc} label={svc} checked={selected.includes(svc)} onClick={() => toggleArr(field, svc)} />
                  ))}

                  {/* Custom items */}
                  {form.customServices.map(svc => (
                    <button key={svc} type="button"
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, cursor: 'default', textAlign: 'left' as const, border: `1.5px solid ${scheme.border}`, background: scheme.bg, width: '100%' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${scheme.border}`, background: scheme.check }}>
                        <Check style={{ width: 11, height: 11, color: '#fff', strokeWidth: 3 }} />
                      </div>
                      <span style={{ fontSize: 13, color: TEXT, fontWeight: 600, flex: 1 }}>{svc}</span>
                      <button type="button" onClick={() => removeCustom(svc)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: '0 2px', lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                        <X style={{ width: 14, height: 14 }} />
                      </button>
                    </button>
                  ))}

                  {/* Other toggle */}
                  {!showOtherInput ? (
                    <button type="button" onClick={() => setShowOtherInput(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.18s', border: `1.5px dashed ${BORDER_S}`, background: 'transparent', width: '100%' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `2px dashed ${BORDER_S}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Plus style={{ width: 11, height: 11, color: MUTED }} />
                      </div>
                      <span style={{ fontSize: 13, color: MUTED }}>Other — add a custom service</span>
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        autoFocus
                        value={otherInput}
                        onChange={e => setOtherInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } if (e.key === 'Escape') { setShowOtherInput(false); setOtherInput('') } }}
                        placeholder="e.g. Fleet Management"
                        style={{ ...iStyle, flex: 1 }}
                        onFocus={e => { e.target.style.borderColor = `${scheme.border}`; e.target.style.boxShadow = `0 0 0 3px ${scheme.bg}` }}
                        onBlur={e  => { e.target.style.borderColor = BORDER_S; e.target.style.boxShadow = 'none' }}
                      />
                      <button type="button" onClick={addCustom}
                        style={{ padding: '0 16px', height: 46, borderRadius: 10, border: 'none', background: scheme.check, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
                        Add
                      </button>
                      <button type="button" onClick={() => { setShowOtherInput(false); setOtherInput('') }}
                        style={{ padding: '0 10px', height: 46, borderRadius: 10, border: `1.5px solid ${BORDER_S}`, background: 'transparent', color: MUTED, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        <X style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  )}
                </div>
              )
            }

            const SectionLabel = ({ color, children }: { color: string; children: React.ReactNode }) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <div style={{ height: 1, width: 14, background: color + '80' }} />
                <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color }}>{children}</span>
                <div style={{ height: 1, flex: 1, background: color + '33' }} />
              </div>
            )

            return (
              <div>
                <StepHeader
                  icon={<Clock style={{ width: 16, height: 16, color: isBoth ? INDIGO : main.color }} />}
                  title={isBoth ? 'Combined Operations' : isTow ? 'Fleet Operations' : 'Workshop Operations'}
                  sub={isBoth
                    ? 'Tell us about your workshop, fleet, and the full range of services you offer.'
                    : isTow
                    ? 'Tell drivers when your fleet is available and what recovery services you provide.'
                    : "Let drivers know when you're available and what repair services you offer."} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {(isTow || isBoth) && (
                    <Field label="24/7 Emergency Dispatch">
                      <button type="button" onClick={() => set('emergency24h', !form.emergency24h)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 12, cursor: 'pointer', width: '100%', textAlign: 'left' as const, transition: 'all 0.2s', border: `1.5px solid ${form.emergency24h ? aC('teal').border : BORDER_S}`, background: form.emergency24h ? aC('teal').bg : SURFACE }}>
                        <div style={{ width: 40, height: 22, borderRadius: 11, background: form.emergency24h ? TEAL : BORDER_S, transition: 'background 0.2s', position: 'relative', flexShrink: 0 }}>
                          <div style={{ position: 'absolute', top: 3, left: form.emergency24h ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </div>
                        <span style={{ fontSize: 13, color: form.emergency24h ? TEXT : MUTED, fontWeight: form.emergency24h ? 600 : 400 }}>
                          {form.emergency24h ? 'Yes — we respond to calls around the clock' : 'No — we operate within set hours only'}
                        </span>
                      </button>
                    </Field>
                  )}
                  <Field label="Days of Operation" required>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' as const }}>
                      {DAYS.map(d => (
                        <button key={d} type="button" onClick={() => toggleArr('workDays', d)}
                          style={{ padding: '8px 13px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: form.workDays.includes(d) ? 700 : 500, transition: 'all 0.18s', border: `1.5px solid ${form.workDays.includes(d) ? main.border : BORDER_S}`, background: form.workDays.includes(d) ? main.bg : SURFACE, color: form.workDays.includes(d) ? main.color : MUTED }}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </Field>
                  {!form.emergency24h && (
                    <Field label="Operating Hours" required>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input type="time" value={form.openTime} onChange={e => set('openTime', e.target.value)} style={{ ...iStyle, flex: 1 }} />
                        <span style={{ color: MUTED, fontSize: 13 }}>to</span>
                        <input type="time" value={form.closeTime} onChange={e => set('closeTime', e.target.value)} style={{ ...iStyle, flex: 1 }} />
                      </div>
                    </Field>
                  )}
                  {isBoth ? (
                    <>
                      <Field label="Number of Mechanics" required>
                        <Input type="number" value={form.mechanicCount} onChange={v => set('mechanicCount', v)} placeholder="e.g. 3" />
                      </Field>
                      <Field label="Number of Tow Trucks" required>
                        <Input type="number" value={form.truckCount} onChange={v => set('truckCount', v)} placeholder="e.g. 2" />
                      </Field>
                    </>
                  ) : (
                    <Field label={isTow ? 'Number of Tow Trucks' : 'Number of Mechanics'} required>
                      <Input type="number" value={form.staffCount} onChange={v => set('staffCount', v)} placeholder="e.g. 3" />
                    </Field>
                  )}
                  {(isTow || isBoth) && (
                    <Field label="Maximum Towing Distance (km)" hint="optional">
                      <Input type="number" value={form.maxTowDistance} onChange={v => set('maxTowDistance', v)} placeholder="e.g. 200" />
                    </Field>
                  )}
                  {isBoth ? (
                    <>
                      <div>
                        <SectionLabel color={AMBER}>Mechanical Repair Services</SectionLabel>
                        <div style={{ marginTop: 10 }}><ServiceList items={MECH_SERVICES} field="services" scheme={aC('amber')} /></div>
                      </div>
                      <div>
                        <SectionLabel color={TEAL}>Towing & Recovery — Vehicle Types</SectionLabel>
                        <div style={{ marginTop: 10 }}><ServiceList items={TOW_SERVICES} field="towServices" scheme={aC('teal')} /></div>
                      </div>
                    </>
                  ) : (
                    <Field label={isTow ? 'Vehicle Types Handled' : 'Services Offered'} required>
                      <ServiceList items={isTow ? TOW_SERVICES : MECH_SERVICES} field="services" scheme={main} />
                    </Field>
                  )}
                </div>
                <NextBtn disabled={!step4Ok} onClick={() => goTo(5)} label="Continue to Documents" />
              </div>
            )
          })()}

          {/* ─── Step 5: Documents & Verification ───────────── */}
          {step === 5 && (
            <div>
              <StepHeader
                icon={<ShieldCheck style={{ width: 16, height: 16, color: AMBER }} />}
                title="Verification Documents"
                sub={isReg
                  ? "Upload your business permits and workplace photos. All documents are reviewed by MOTOFIX before your account goes live."
                  : "All documents are required. We verify every provider before they go live on MOTOFIX."} />

              <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', marginBottom: 24 }}>
                <ShieldCheck style={{ width: 16, height: 16, color: RED, flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: RED, lineHeight: 1.6 }}>
                  {isReg
                    ? "Registered businesses must be submitted by the owner or person in charge. Business permits and workplace photos are required — no exceptions."
                    : "Providers without verifiable workplace documentation cannot be registered. All uploaded documents are reviewed by MOTOFIX administration."}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                {/* Individual: National ID */}
                {isInd && (
                  <Field label="National ID / Passport Photo" required>
                    <p style={{ fontSize: 11, color: MUTED, marginBottom: 8, lineHeight: 1.5 }}>
                      Upload a clear photo of the front of your National ID or passport.
                    </p>
                    <FileUpload
                      label="Tap to upload National ID / Passport"
                      file={form.nationalIdFile}
                      onChange={f => set('nationalIdFile', f)}
                    />
                  </Field>
                )}

                {/* Individual: work permit / attachment */}
                {isInd && (
                  <Field label="Workplace Verification Document" required>
                    <p style={{ fontSize: 11, color: MUTED, marginBottom: 8, lineHeight: 1.5 }}>
                      You must provide one of the following to prove your workplace affiliation.
                    </p>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                      {([
                        { val: 'permit',     label: 'Work Permit',         hint: 'Valid work permit issued to you' },
                        { val: 'attachment', label: 'Workplace Attachment', hint: 'Letter from employer or work site' },
                      ] as const).map(({ val, label, hint }) => (
                        <button key={val} type="button" onClick={() => { set('workDocType', val); set('workDocFile', null) }}
                          style={{ flex: 1, padding: '11px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'center' as const, transition: 'all 0.2s', border: `1.5px solid ${form.workDocType === val ? AMBER : BORDER_S}`, background: form.workDocType === val ? 'rgba(245,158,11,0.08)' : SURFACE }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: form.workDocType === val ? AMBER : TEXT, marginBottom: 2 }}>{label}</p>
                          <p style={{ fontSize: 10, color: FAINT, lineHeight: 1.4 }}>{hint}</p>
                        </button>
                      ))}
                    </div>
                    {form.workDocType && (
                      <FileUpload
                        label={`Tap to upload ${form.workDocType === 'permit' ? 'Work Permit' : 'Attachment Letter'}`}
                        file={form.workDocFile}
                        onChange={f => set('workDocFile', f)}
                        accept="image/*,.pdf"
                      />
                    )}
                  </Field>
                )}

                {/* Registered: business work permit / operating license */}
                {isReg && (
                  <Field label="Business Work Permit / Operating License" required>
                    <p style={{ fontSize: 11, color: MUTED, marginBottom: 8, lineHeight: 1.5 }}>
                      Upload the permit or license held by the owner or person in charge of this business.
                    </p>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                      {([
                        { val: 'permit',     label: 'Work Permit',      hint: 'Operating permit for the business' },
                        { val: 'attachment', label: 'Operating License', hint: 'Trade license or business license' },
                      ] as const).map(({ val, label, hint }) => (
                        <button key={val} type="button" onClick={() => { set('workDocType', val); set('workDocFile', null) }}
                          style={{ flex: 1, padding: '11px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'center' as const, transition: 'all 0.2s', border: `1.5px solid ${form.workDocType === val ? AMBER : BORDER_S}`, background: form.workDocType === val ? 'rgba(245,158,11,0.08)' : SURFACE }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: form.workDocType === val ? AMBER : TEXT, marginBottom: 2 }}>{label}</p>
                          <p style={{ fontSize: 10, color: FAINT, lineHeight: 1.4 }}>{hint}</p>
                        </button>
                      ))}
                    </div>
                    {form.workDocType && (
                      <FileUpload
                        label={`Tap to upload ${form.workDocType === 'permit' ? 'Work Permit' : 'Operating License'}`}
                        file={form.workDocFile}
                        onChange={f => set('workDocFile', f)}
                        accept="image/*,.pdf"
                      />
                    )}
                  </Field>
                )}

                {/* Place of work photos — both types */}
                <Field label="Place of Work Photos" required>
                  <p style={{ fontSize: 11, color: MUTED, marginBottom: 8, lineHeight: 1.5 }}>
                    {isReg
                      ? "Upload at least 1 photo of your business premises — workshop, yard, depot, or office (up to 4)."
                      : "Upload at least 1 photo of your workshop, garage, depot, or work site (up to 4). These help MOTOFIX and customers verify your operation."}
                  </p>
                  <PhotoGrid
                    photos={form.workplacePhotos}
                    onChange={files => set('workplacePhotos', files)}
                  />
                </Field>

                {/* Website — individual providers */}
                {isInd && (
                  <Field label="Website / Social Media" hint="optional">
                    <div style={{ position: 'relative' }}>
                      <Globe style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: FAINT }} />
                      <input
                        type="url" value={form.website}
                        onChange={e => set('website', e.target.value)}
                        placeholder="e.g. www.johnsmechanics.com or Facebook page"
                        style={{ ...iStyle, paddingLeft: 36 }}
                        onFocus={e => { e.target.style.borderColor = 'rgba(245,158,11,0.55)'; e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.11)' }}
                        onBlur={e  => { e.target.style.borderColor = BORDER_S; e.target.style.boxShadow = 'none' }}
                      />
                    </div>
                  </Field>
                )}

              </div>
              <NextBtn disabled={!step5Ok} onClick={() => goTo(6)} label="Review Application" />
            </div>
          )}

          {/* ─── Step 6: Review & Submit ─────────────────────── */}
          {step === 6 && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ color: TEXT, fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em', marginBottom: 6 }}>Review your application</h2>
                <p style={{ color: MUTED, fontSize: 13 }}>Check everything looks right before submitting.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                <ReviewCard title={isReg ? 'Owner / Contact Person' : 'Personal Details'} onEdit={() => goTo(2)}>
                  <ReviewRow label="Name"  value={form.fullName} />
                  <ReviewRow label="Phone" value={form.phone} />
                  {form.email && <ReviewRow label="Email" value={form.email} />}
                  {isInd && <ReviewRow label="National ID" value={form.nationalId} />}
                  <ReviewRow label="Type" value={isInd ? 'Individual / Sole Trader' : 'Registered Business'} />
                </ReviewCard>

                <ReviewCard
                  title={form.serviceType === 'towing' ? 'Company / Fleet' : form.serviceType === 'both' ? 'Garage & Fleet' : 'Business Details'}
                  onEdit={() => goTo(3)}>
                  <ReviewRow label="Name" value={form.garageName} />
                  {form.businessRegNo && <ReviewRow label="Reg No." value={form.businessRegNo} />}
                  <ReviewRow label={form.serviceType === 'towing' ? 'Depot' : 'Address'} value={`${form.address}, ${form.town}`} />
                  {form.depotAddress && <ReviewRow label="Depot" value={form.depotAddress} />}
                  {form.website && <ReviewRow label="Website" value={form.website} />}
                </ReviewCard>

                <ReviewCard title="Operations" onEdit={() => goTo(4)}>
                  {(form.serviceType === 'towing' || form.serviceType === 'both') && (
                    <ReviewRow label="24/7" value={form.emergency24h ? 'Yes' : 'No'} />
                  )}
                  <ReviewRow label="Days"  value={form.workDays.join(', ')} />
                  {!form.emergency24h && <ReviewRow label="Hours" value={`${form.openTime} – ${form.closeTime}`} />}
                  {form.serviceType === 'both' ? (
                    <>
                      {form.mechanicCount && <ReviewRow label="Mechanics"  value={form.mechanicCount} />}
                      {form.truckCount    && <ReviewRow label="Tow Trucks" value={form.truckCount} />}
                    </>
                  ) : (
                    <ReviewRow label={form.serviceType === 'towing' ? 'Trucks' : 'Staff'} value={form.staffCount} />
                  )}
                  {form.maxTowDistance && <ReviewRow label="Max Distance" value={`${form.maxTowDistance} km`} />}
                  {form.services.length > 0    && <ReviewRow label={form.serviceType === 'both' ? 'Repairs' : form.serviceType === 'towing' ? 'Vehicles' : 'Services'} value={form.services.join(', ')} />}
                  {form.towServices.length > 0 && <ReviewRow label="Towing" value={form.towServices.join(', ')} />}
                  {form.customServices.length > 0 && <ReviewRow label="Other Services" value={form.customServices.join(', ')} />}
                </ReviewCard>

                <ReviewCard title="Documents" onEdit={() => goTo(5)}>
                  {isInd && <ReviewRow label="National ID" value={form.nationalIdFile?.name ?? ''} />}
                  <ReviewRow
                    label={isReg
                      ? (form.workDocType === 'permit' ? 'Work Permit' : 'Operating License')
                      : (form.workDocType === 'permit' ? 'Work Permit' : 'Attachment')}
                    value={form.workDocFile?.name ?? ''} />
                  <ReviewRow label="Work Photos" value={`${form.workplacePhotos.length} photo${form.workplacePhotos.length !== 1 ? 's' : ''} uploaded`} />
                  {form.website && <ReviewRow label="Website" value={form.website} />}
                </ReviewCard>

              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ marginTop: 24, width: '100%', height: 50, borderRadius: 14, border: 'none', background: submitting ? 'rgba(245,158,11,0.4)' : `linear-gradient(135deg, ${AMBER}, #B45309)`, color: '#fff', fontWeight: 800, fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: submitting ? 'none' : '0 4px 20px rgba(245,158,11,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}>
                {submitting
                  ? <><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> Submitting…</>
                  : <>Submit Application <ArrowRight style={{ width: 16, height: 16 }} /></>}
              </button>
              <p style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: FAINT, lineHeight: 1.6 }}>
                Your application will be reviewed by MOTOFIX<br />administration within 1–2 business days.
              </p>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

// ── Shared sub-components ─────────────────────────────────────────

const iStyle: React.CSSProperties = {
  height: 46, padding: '0 14px', borderRadius: 10, width: '100%',
  background: SURFACE, border: `1.5px solid ${BORDER_S}`,
  color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s', fontFamily: 'inherit',
}

function Input({ value, onChange, placeholder, type = 'text', maxLength, digitsOnly }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; maxLength?: number; digitsOnly?: boolean
}) {
  const handleChange = (v: string) => {
    let val = digitsOnly ? v.replace(/\D/g, '') : v
    if (maxLength !== undefined) val = val.slice(0, maxLength)
    onChange(val)
  }
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={e => handleChange(e.target.value)}
      maxLength={maxLength}
      inputMode={digitsOnly ? 'numeric' : undefined}
      style={iStyle}
      onFocus={e => { e.target.style.borderColor = 'rgba(245,158,11,0.55)'; e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.11)' }}
      onBlur={e  => { e.target.style.borderColor = BORDER_S; e.target.style.boxShadow = 'none' }}
    />
  )
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 7 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{label}</span>
        {required && <span style={{ color: AMBER, marginLeft: 3 }}>*</span>}
        {hint && <span style={{ fontSize: 11, color: FAINT, marginLeft: 6 }}>({hint})</span>}
      </label>
      {children}
    </div>
  )
}

function StepHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.26)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        <h2 style={{ color: TEXT, fontWeight: 800, fontSize: 20, letterSpacing: '-0.01em' }}>{title}</h2>
      </div>
      <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6 }}>{sub}</p>
    </div>
  )
}

function NextBtn({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ marginTop: 28, width: '100%', height: 50, borderRadius: 14, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s', background: disabled ? 'rgba(255,255,255,0.07)' : `linear-gradient(135deg, ${AMBER}, #B45309)`, color: disabled ? FAINT : '#fff', boxShadow: disabled ? 'none' : '0 4px 16px rgba(245,158,11,0.30)' }}>
      {label} <ArrowRight style={{ width: 16, height: 16 }} />
    </button>
  )
}

function FileUpload({ label, accept = 'image/*', file, onChange }: {
  label: string; accept?: string; file: File | null; onChange: (f: File | null) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }}
        onChange={e => onChange(e.target.files?.[0] ?? null)} />
      <button type="button" onClick={() => ref.current?.click()}
        style={{ width: '100%', padding: '14px 16px', borderRadius: 12, cursor: 'pointer', border: `1.5px dashed ${file ? AMBER : BORDER_S}`, background: file ? 'rgba(245,158,11,0.05)' : SURFACE, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' as const, transition: 'all 0.2s' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: file ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {file ? <Check style={{ width: 18, height: 18, color: AMBER }} /> : <Upload style={{ width: 18, height: 18, color: FAINT }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: file ? TEXT : MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file ? file.name : label}
          </p>
          <p style={{ fontSize: 11, color: file ? AMBER : FAINT, marginTop: 2 }}>
            {file ? 'Tap to replace' : 'JPG, PNG or PDF'}
          </p>
        </div>
      </button>
    </>
  )
}

function PhotoGrid({ photos, onChange }: { photos: File[]; onChange: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const remove = (i: number) => onChange(photos.filter((_, idx) => idx !== i))
  return (
    <>
      <input ref={ref} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={e => {
          const added = Array.from(e.target.files ?? [])
          onChange([...photos, ...added].slice(0, 4))
          e.target.value = ''
        }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {photos.map((f, i) => (
          <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: BORDER_S }}>
            <img src={URL.createObjectURL(f)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button type="button" onClick={() => remove(i)}
              style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X style={{ width: 12, height: 12, color: '#fff' }} />
            </button>
          </div>
        ))}
        {photos.length < 4 && (
          <button type="button" onClick={() => ref.current?.click()}
            style={{ aspectRatio: '1', borderRadius: 10, border: `1.5px dashed ${BORDER_S}`, background: SURFACE, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {photos.length === 0
                ? <ImageIcon style={{ width: 16, height: 16, color: FAINT }} />
                : <Plus      style={{ width: 16, height: 16, color: FAINT }} />}
            </div>
            <span style={{ fontSize: 10, color: FAINT }}>{photos.length === 0 ? 'Add photo' : 'Add more'}</span>
          </button>
        )}
      </div>
      {photos.length > 0 && (
        <p style={{ fontSize: 11, color: FAINT, marginTop: 6 }}>{photos.length} of 4 photos added</p>
      )}
    </>
  )
}

function ReviewCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div style={{ background: SURFACE, borderRadius: 16, padding: 18, border: `1.5px solid ${BORDER_S}`, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: TEXT }}>{title}</span>
        <button onClick={onEdit} style={{ fontSize: 12, color: AMBER, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{children}</div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ fontSize: 12, color: MUTED, minWidth: 88, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: TEXT, fontWeight: 500, flex: 1 }}>{value}</span>
    </div>
  )
}
