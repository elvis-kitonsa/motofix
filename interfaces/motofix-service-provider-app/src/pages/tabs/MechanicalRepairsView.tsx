import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowLeft, Search, X, ChevronRight, ChevronDown, Send, Bot, User, Paperclip, Mic, MicOff, Image, FileAudio, X as XIcon } from 'lucide-react'

/* ── Car systems data ───────────────────────────────────────── */
const CAR_SYSTEMS = [
  {
    id: 'engine', name: 'Engine', emoji: '🔧', color: '#F59E0B',
    desc: 'Internal combustion, oil, timing',
    issues: [
      { name: 'Engine Overheating', symptoms: ['Temperature warning light on', 'Steam rising from bonnet', 'Sweet/burning smell', 'Coolant loss'], tips: ['Check coolant level first — top up if low', 'Inspect radiator for leaks or blockage', 'Test water pump and thermostat', 'Check radiator cap seal', 'Look for cracked hoses'] },
      { name: 'Oil Leak', symptoms: ['Dark spots under the vehicle', 'Burning oil smell while driving', 'Low oil warning light', 'Blue/grey exhaust smoke'], tips: ['Identify exact leak source before doing anything else', 'Common spots: valve cover gasket, drain plug, oil filter', 'Clean the engine and run it to locate the leak', 'Replace worn gaskets or seals — do not over-tighten'] },
      { name: 'Engine Won\'t Start', symptoms: ['No cranking sound', 'Cranks but won\'t fire', 'Clicking noise only', 'Engine turns over slowly'], tips: ['Check battery voltage — should read 12.4V+', 'Test starter motor and solenoid', 'Check fuel pump — listen for hum when key turns to ON', 'Inspect spark plugs and ignition coils', 'Check for fault codes with OBD scanner'] },
      { name: 'Rough Idle / Misfires', symptoms: ['Engine shaking at idle', 'Loss of power', 'Poor fuel economy', 'Check engine light flashing'], tips: ['Check spark plugs — replace if worn or fouled', 'Test ignition coils one at a time', 'Clean or replace dirty fuel injectors', 'Check for vacuum leaks — listen for hissing', 'Inspect MAF and oxygen sensors'] },
      { name: 'Timing Belt / Chain', symptoms: ['Ticking noise from engine', 'Engine won\'t start suddenly', 'Slapping noise at startup'], tips: ['Timing belt should be replaced every 60–100k km', 'Never run engine if timing belt is suspected broken — valve damage', 'Check timing marks carefully before reassembly', 'Always replace tensioner and idler with belt'] },
    ],
  },
  {
    id: 'tyres', name: 'Tyres', emoji: '🛞', color: '#60A5FA',
    desc: 'Flats, pressure, alignment, wear',
    issues: [
      { name: 'Flat Tyre', symptoms: ['Vehicle pulling to one side', 'Vibration through steering', 'Visible deflation', 'Thumping noise'], tips: ['Engage hazard lights immediately', 'Park well off the road before changing', 'Loosen wheel nuts before jacking', 'Never work under a vehicle supported only by a jack', 'Check spare tyre pressure before fitting'] },
      { name: 'Tyre Wear Patterns', symptoms: ['Centre wear: overinflation', 'Edge wear: underinflation', 'One-side wear: alignment issue', 'Cupping/scalloping: suspension problem'], tips: ['Check tyre pressure monthly — correct to vehicle placard', 'Rotate tyres every 10,000 km', 'Get wheel alignment when fitting new tyres or after hitting a pothole', 'Uneven wear often means worn shocks — inspect suspension'] },
      { name: 'Tyre Pressure Issues', symptoms: ['TPMS warning light', 'Poor fuel economy', 'Handling feels vague', 'Tyres look low visually'], tips: ['Always check cold pressure (before driving)', 'Refer to sticker inside driver\'s door for correct PSI', 'Don\'t forget the spare when checking', 'Temperature drops 1 PSI per 5°C — recheck seasonally'] },
    ],
  },
  {
    id: 'battery', name: 'Battery', emoji: '🔋', color: '#4ADE80',
    desc: 'Charging, jump starts, replacement',
    issues: [
      { name: 'Dead Battery', symptoms: ['No power when turning key', 'Dim lights', 'Rapid clicking from starter', 'Battery warning light'], tips: ['Jump start: red to dead+ → red to good+ → black to good- → black to bare metal on dead car', 'Run engine for 20–30 min after jump to recharge', 'Test battery with multimeter: 12.6V = good, below 12.0V = replace', 'Check for parasitic drain if battery keeps dying'] },
      { name: 'Battery Not Charging', symptoms: ['Battery warning light while driving', 'Voltage reads below 13.5V while running', 'Lights dim while driving', 'Battery keeps going flat'], tips: ['Test alternator output — should be 13.8–14.7V at idle', 'Check alternator belt for wear or slipping', 'Inspect battery terminals for corrosion — clean with baking soda', 'Test voltage regulator if alternator output is unstable'] },
      { name: 'Corroded Terminals', symptoms: ['White/blue powder on terminals', 'Slow cranking', 'Electrical issues', 'Battery voltage drops suddenly'], tips: ['Disconnect negative terminal first, then positive', 'Clean with baking soda and warm water', 'Use a wire brush or terminal cleaner', 'Apply petroleum jelly after cleaning to prevent recurrence', 'Reconnect positive first, then negative'] },
    ],
  },
  {
    id: 'brakes', name: 'Brakes', emoji: '🛑', color: '#F87171',
    desc: 'Pads, discs, fluid, ABS',
    issues: [
      { name: 'Squealing Brakes', symptoms: ['High-pitched squeal when braking', 'Noise stops when brake is released', 'Grinding when severe'], tips: ['Squeal = wear indicator touching disc — replace pads now', 'Grinding = metal-to-metal — replace pads AND discs', 'Check pad thickness: minimum 3mm', 'Dust or moisture causes temporary squeal — this is normal'] },
      { name: 'Soft / Spongy Brake Pedal', symptoms: ['Pedal sinks to floor', 'Reduced braking power', 'Pedal feels different from usual'], tips: ['Likely air in the brake lines — needs bleeding', 'Check brake fluid level in reservoir', 'Inspect all brake lines and hoses for leaks', 'Check master cylinder if fluid is full but pedal is still soft', 'Do NOT drive if pedal goes to floor — serious safety risk'] },
      { name: 'Vehicle Pulls When Braking', symptoms: ['Car pulls left or right under braking', 'One wheel locking up', 'Uneven pad wear'], tips: ['Check caliper — may be seized on the pulling side', 'Inspect brake hoses for internal collapse', 'Check for contaminated pads (oil or fluid)', 'Verify both sides have matching pads and disc condition'] },
      { name: 'Brake Fluid', symptoms: ['Low fluid level', 'Dark/dirty fluid', 'Brake warning light'], tips: ['Brake fluid should be clear to light yellow — dark = contaminated', 'Replace fluid every 2 years or when moisture content is high', 'DOT 4 is most common — never mix DOT types', 'Low fluid = either leak or worn pads (normal) — always check both'] },
    ],
  },
  {
    id: 'electrical', name: 'Electrical', emoji: '⚡', color: '#A78BFA',
    desc: 'Fuses, lights, sensors, wiring',
    issues: [
      { name: 'Fuse Problems', symptoms: ['Specific component not working', 'Fuse box shows blown fuse', 'Circuit keeps blowing fuses'], tips: ['Find the correct fuse box (usually under dash and in engine bay)', 'Never replace a fuse with higher amperage — find the cause', 'Test fuses with a test light or multimeter', 'Repeatedly blown fuse = short circuit — trace the wiring'] },
      { name: 'Warning Lights', symptoms: ['Check engine light', 'ABS light', 'Airbag light', 'Service lights'], tips: ['Use an OBD2 scanner to read fault codes — essential for diagnosis', 'Check engine light flashing = active misfire — reduce load immediately', 'ABS light alone doesn\'t disable normal brakes', 'Airbag light = do NOT disturb wiring — safety system risk'] },
      { name: 'Alternator Failure', symptoms: ['Battery warning light', 'Electrical systems failing while driving', 'Whining noise from engine bay', 'Burning rubber smell'], tips: ['Test output: should be 13.8–14.7V at idle with accessories on', 'Inspect serpentine belt first — simple fix if worn', 'Check alternator diodes — AC ripple on DC output means diode failure', 'Replace brushes before full alternator if accessible'] },
    ],
  },
  {
    id: 'cooling', name: 'Cooling', emoji: '💧', color: '#38BDF8',
    desc: 'Radiator, coolant, thermostat',
    issues: [
      { name: 'Coolant Leak', symptoms: ['Puddle under car (sweet smell)', 'Reservoir keeps emptying', 'Overheating', 'White exhaust smoke'], tips: ['Pressure test the cooling system to find leaks', 'Check radiator, hoses, heater core, water pump weep hole', 'White exhaust smoke = coolant in combustion chamber — head gasket', 'Never open radiator cap when engine is hot — severe burn risk'] },
      { name: 'Thermostat Failure', symptoms: ['Engine takes too long to warm up (stuck open)', 'Engine overheats quickly (stuck closed)', 'Temperature gauge erratic'], tips: ['Stuck open: heater won\'t heat, engine runs cold — replace thermostat', 'Stuck closed: overheating within minutes — replace immediately', 'Thermostats are cheap — always replace when doing water pump or timing belt'] },
    ],
  },
  {
    id: 'transmission', name: 'Transmission', emoji: '⚙️', color: '#FB923C',
    desc: 'Gearbox, clutch, fluid',
    issues: [
      { name: 'Clutch Problems (Manual)', symptoms: ['Slipping under load', 'Hard to engage gears', 'Grinding when changing', 'Clutch pedal to floor'], tips: ['Slipping = worn clutch plate — replacement needed', 'Hard pedal = worn cable or hydraulic issue', 'Grinding = synchroniser wear or clutch not fully disengaging', 'Adjust clutch pedal free-play first — often overlooked'] },
      { name: 'Automatic Gearbox Issues', symptoms: ['Harsh shifts', 'Slipping between gears', 'Delayed engagement', 'Gearbox warning light'], tips: ['Check ATF level and condition — burnt smell = damage', 'Change transmission fluid every 60k km', 'Solenoid or valve body issues are common causes of harsh shifts', 'Never tow a vehicle with auto trans beyond short distances'] },
    ],
  },
  {
    id: 'suspension', name: 'Suspension', emoji: '🚗', color: '#34D399',
    desc: 'Shocks, struts, steering',
    issues: [
      { name: 'Worn Shock Absorbers', symptoms: ['Bouncing after bumps', 'Nose diving under braking', 'Body roll in corners', 'Cupped tyre wear'], tips: ['Bounce test: push each corner — car should settle in 1–2 bounces', 'Replace in axle pairs — never one side only', 'Worn shocks increase stopping distance by up to 20%', 'Check for oil leaks on shock body'] },
      { name: 'Steering Problems', symptoms: ['Loose/vague steering', 'Vibration through wheel', 'Noise when turning', 'Pulling to one side'], tips: ['Check power steering fluid level', 'Inspect tie rod ends and ball joints for play', 'Vibration at highway speed = wheel balance issue', 'Noise when turning = CV joint or power steering pump'] },
    ],
  },
  {
    id: 'fuel', name: 'Fuel System', emoji: '⛽', color: '#FBBF24',
    desc: 'Pump, injectors, filter',
    issues: [
      { name: 'Fuel Pump Failure', symptoms: ['Car won\'t start (no pump hum)', 'Engine stutters at high load', 'Loss of power going uphill', 'Whining from fuel tank'], tips: ['Listen for pump hum for 2 sec when key turns to ON — silence = pump issue', 'Test fuel pressure at rail — spec varies by vehicle', 'Check fuel filter first — blockage can mimic pump failure', 'Strainer in tank can clog — often replaced with pump'] },
      { name: 'Dirty Fuel Injectors', symptoms: ['Rough idle', 'Poor fuel economy', 'Hesitation on acceleration', 'Black smoke'], tips: ['Use fuel injector cleaner in tank as first step', 'Professional ultrasonic cleaning for badly clogged injectors', 'Test injector spray pattern — should be fine mist, not stream', 'Check fuel pressure regulator if all injectors seem affected'] },
    ],
  },
  {
    id: 'exhaust', name: 'Exhaust', emoji: '💨', color: '#9CA3AF',
    desc: 'Pipes, catalytic converter, DPF',
    issues: [
      { name: 'Exhaust Leaks', symptoms: ['Ticking/popping noise', 'Smell of exhaust inside cabin', 'Louder engine note', 'Failed emissions test'], tips: ['Carbon black soot around joints = leak location', 'Run engine in dark — visible wisps of smoke reveal leaks', 'Exhaust leaks before O2 sensor affect fuel trim', 'Do NOT ignore cabin exhaust smell — carbon monoxide risk'] },
      { name: 'Catalytic Converter', symptoms: ['Rotten egg smell', 'Check engine light (O2 sensor codes)', 'Reduced power', 'Rattling from under car'], tips: ['Rattling = substrate broken inside — replace cat', 'Rich running damages cats — fix fuel/ignition issues first', 'Cat theft is common — check vehicle underside for signs', 'DPF (diesel) — ensure enough highway driving to regenerate'] },
    ],
  },
]

/* ── AI keyword responses ────────────────────────────────────── */
const AI_RESPONSES: Array<{ keywords: string[]; response: string }> = [
  { keywords: ['overheat', 'hot', 'temperature', 'steam', 'coolant', 'radiator'], response: '🌡️ **Overheating** is one of the most common engine issues. First, pull over safely and turn the engine off — never open the radiator cap hot.\n\n**Check:**\n• Coolant level in the reservoir (cold engine only)\n• Radiator for leaks, blockage, or bent fins\n• Upper radiator hose — squeeze when warm, should feel firm but not rock-hard\n• Fan operation — both electric fan and viscous fan\n\nIf coolant is full and clean, suspect the **thermostat** (cheap, easy fix) or **water pump**. White smoke from exhaust + overheating = head gasket — serious, don\'t run the engine.' },
  { keywords: ['battery', 'dead', 'won\'t start', 'wont start', 'click', 'jump'], response: '🔋 **Battery / Starting issues** — here\'s a quick diagnostic:\n\n• **Nothing at all (no click):** Check battery terminals for corrosion. Voltage below 10V = battery is dead\n• **Single click:** Starter solenoid — check battery voltage under load\n• **Rapid clicking:** Battery has some charge but too low to crank. Jump start needed\n• **Cranks but won\'t fire:** Fuel or spark issue — not battery\n\n**Jump start sequence:** Red to dead+ → Red to good+ → Black to good- → Black to bare metal on dead car. Run for 20 min minimum after.' },
  { keywords: ['brake', 'squeal', 'grind', 'pedal', 'pull', 'stopping'], response: '🛑 **Brake diagnosis:**\n\n• **Squealing:** Wear indicator hitting the disc — replace pads now. Ignore and it becomes grinding (costly)\n• **Grinding:** Metal on metal — pads AND disc need replacement\n• **Soft pedal:** Air in lines or fluid leak — bleed brakes and inspect lines\n• **Pulling left/right:** Seized caliper or uneven pad wear on one side\n• **Vibration when braking:** Warped disc — measure disc thickness variation or replace\n\n⚠️ Never ignore brake issues — they are safety-critical.' },
  { keywords: ['oil', 'leak', 'smoke', 'blue smoke', 'burning'], response: '🔧 **Oil issues:**\n\n• **Blue/grey smoke from exhaust:** Oil burning in combustion — worn valve seals (more on startup) or piston rings (more under load)\n• **Oil leak location tips:** Clean the engine, run it, then use a UV dye and blacklight to pinpoint the source\n• **Common leak points:** Valve cover gasket, rocker cover, sump drain plug, oil filter housing, crankshaft seals\n• **Oil consumption without smoke or leaks:** Check PCV valve — a stuck closed PCV builds crankcase pressure and forces oil past seals\n\nAlways fix the root cause before just topping up.' },
  { keywords: ['flat', 'tyre', 'tire', 'pressure', 'puncture'], response: '🛞 **Tyre diagnosis:**\n\n• **Flat tyre:** Engage hazards, park safely. Loosen nuts before jacking. Never use a space saver spare above 80 km/h or for more than 100 km\n• **Slow puncture:** Soapy water over tyre to find bubbles. Remove foreign object only when ready to repair — it\'s plugging the hole\n• **Pressure:** Check cold (before driving). Refer to door sticker for correct PSI — not the tyre sidewall max\n• **Tyre wear patterns tell a story:** Centre wear = overinflated, edge wear = underinflated, one-side wear = alignment issue' },
  { keywords: ['clutch', 'gear', 'gearbox', 'transmission', 'slip', 'grind'], response: '⚙️ **Clutch / Gearbox:**\n\n• **Clutch slip:** Engine revs rise but speed doesn\'t follow — worn clutch plate. Avoid if possible and replace soon\n• **Grinding gears:** Either clutch not fully disengaging (adjust pedal free-play) or worn synchros\n• **Stiff clutch pedal:** Check clutch cable tension or hydraulic fluid level\n• **Auto gearbox:** Check ATF level and colour. Burnt smell = damage already done. Service interval is typically 60,000 km\n\nClutch adjustments are often overlooked — always check free-play before condemning the clutch.' },
  { keywords: ['electric', 'light', 'fuse', 'alternator', 'charging', 'warning'], response: '⚡ **Electrical diagnosis:**\n\n• **Single component not working:** Check its fuse first — quick and free\n• **Battery warning light while driving:** Alternator output low — test with multimeter at battery. Should read 13.8–14.7V with engine running\n• **Multiple warning lights at once:** Often a voltage drop or faulty chassis earth — check earth straps\n• **Check engine light:** Always scan for fault codes first (OBD2 scanner). The light alone tells you nothing specific\n\n⚠️ Never replace a fuse with a higher rating — trace and fix the short circuit first.' },
  { keywords: ['suspension', 'shock', 'bounce', 'steering', 'vibrat', 'pull'], response: '🚗 **Suspension & Steering:**\n\n• **Bounce test:** Push each corner of the car down and release. It should settle in 1–2 movements. More = worn shocks\n• **Vibration at speed:** Usually wheel balance (cheap fix) or worn tyres\n• **Vibration under braking:** Warped brake discs\n• **Noise over bumps:** Worn strut top mounts or anti-roll bar bushes — cheap parts, labour-intensive\n• **Pulling to one side:** Alignment, tyre pressure difference, or brake caliper sticking\n\nAlways replace shocks in axle pairs.' },
]

function getAIResponse(input: string): string {
  const lower = input.toLowerCase()
  const match = AI_RESPONSES.find(r => r.keywords.some(k => lower.includes(k)))
  return match?.response ??
    '🔍 I don\'t have a specific guide for that yet. Try describing the **symptom** (e.g. "engine making knocking noise" or "car pulling to the left") for a more accurate suggestion.\n\nOr browse the **Categories** tab to find the relevant car system and detailed guides.'
}

/* ── Video data (placeholders) ──────────────────────────────── */
const VIDEOS = [
  { id: 1, title: 'How to Diagnose Engine Overheating', duration: '8:24', category: 'Engine', thumb: '🌡️', views: '142K' },
  { id: 2, title: 'Changing Brake Pads Step by Step', duration: '12:05', category: 'Brakes', thumb: '🛑', views: '89K' },
  { id: 3, title: 'Jump Starting a Dead Battery Safely', duration: '5:38', category: 'Battery', thumb: '🔋', views: '203K' },
  { id: 4, title: 'Reading OBD2 Fault Codes', duration: '9:11', category: 'Electrical', thumb: '⚡', views: '67K' },
  { id: 5, title: 'Tyre Change on the Roadside', duration: '7:47', category: 'Tyres', thumb: '🛞', views: '115K' },
  { id: 6, title: 'Coolant System Pressure Test', duration: '11:20', category: 'Cooling', thumb: '💧', views: '44K' },
  { id: 7, title: 'Diagnosing a Clutch Slip', duration: '6:55', category: 'Transmission', thumb: '⚙️', views: '58K' },
  { id: 8, title: 'Finding & Fixing Oil Leaks', duration: '14:30', category: 'Engine', thumb: '🔧', views: '91K' },
  { id: 9, title: 'Wheel Bearing Noise: How to Find It', duration: '8:00', category: 'Suspension', thumb: '🚗', views: '73K' },
  { id: 10, title: 'Fuel Injector Cleaning Guide', duration: '10:15', category: 'Fuel', thumb: '⛽', views: '38K' },
  { id: 11, title: 'Alternator Testing & Replacement', duration: '15:44', category: 'Electrical', thumb: '⚡', views: '52K' },
  { id: 12, title: 'Suspension Bounce Test Explained', duration: '4:22', category: 'Suspension', thumb: '🚗', views: '29K' },
]

type MediaType = 'image' | 'video' | 'audio'
type ChatMessage = {
  role: 'user' | 'ai'
  id: number
  text?: string
  mediaType?: MediaType
  mediaSrc?: string
  mediaName?: string
}

interface Props { onBack: () => void }

export default function MechanicalRepairsView({ onBack }: Props) {
  const [activeTab,       setActiveTab]       = useState<'browse' | 'ai' | 'videos'>('browse')
  const [searchQuery,     setSearchQuery]     = useState('')
  const [selectedSystem,  setSelectedSystem]  = useState<typeof CAR_SYSTEMS[0] | null>(null)
  const [expandedIssue,   setExpandedIssue]   = useState<string | null>(null)
  const [messages,        setMessages]        = useState<ChatMessage[]>([
    { role: 'ai', id: 0, text: '👋 Hi! I\'m your mechanical assistant. Describe any car problem or symptom and I\'ll give you a diagnostic guide.\n\nYou can also attach photos, videos, or voice notes using the 📎 button below.' },
  ])
  const [inputText,      setInputText]      = useState('')
  const [videoFilter,    setVideoFilter]    = useState('All')
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [isRecording,    setIsRecording]    = useState(false)
  const [recordSecs,     setRecordSecs]     = useState(0)

  const chatEndRef      = useRef<HTMLDivElement>(null)
  const inputRef        = useRef<HTMLInputElement>(null)
  const imageInputRef   = useRef<HTMLInputElement>(null)
  const audioInputRef   = useRef<HTMLInputElement>(null)
  const mediaRecRef     = useRef<MediaRecorder | null>(null)
  const audioChunksRef  = useRef<Blob[]>([])
  const recordTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  /* Auto-focus input when switching to AI tab */
  useEffect(() => {
    if (activeTab === 'ai') setTimeout(() => inputRef.current?.focus(), 150)
  }, [activeTab])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = () => {
    const text = inputText.trim()
    if (!text) return
    const userMsg: ChatMessage = { role: 'user', id: Date.now(), text }
    const aiMsg:   ChatMessage = { role: 'ai',   id: Date.now() + 1, text: getAIResponse(text) }
    setMessages(prev => [...prev, userMsg, aiMsg])
    setInputText('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  /* Media file handler */
  const handleMediaFile = useCallback((file: File) => {
    const src = URL.createObjectURL(file)
    const mediaType: MediaType = file.type.startsWith('image') ? 'image'
      : file.type.startsWith('video') ? 'video' : 'audio'
    const msg: ChatMessage = { role: 'user', id: Date.now(), mediaType, mediaSrc: src, mediaName: file.name }
    setMessages(prev => [...prev, msg])
    if (mediaType === 'image') {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'ai', id: Date.now(), text: '📸 Got the image. Based on what\'s visible, check for any visible damage, fluid residue, or wear marks. Can you describe what you\'re seeing or what the issue is? I\'ll give you a targeted diagnostic.' }])
      }, 600)
    } else if (mediaType === 'video') {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'ai', id: Date.now(), text: '🎥 Video received. Watch for unusual movement, smoke, leaks, or sounds in the clip. Describe the main symptom you captured and I\'ll walk you through the diagnosis.' }])
      }, 600)
    }
  }, [])

  /* Voice recording */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      audioChunksRef.current = []
      rec.ondataavailable = e => audioChunksRef.current.push(e.data)
      rec.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const src  = URL.createObjectURL(blob)
        setMessages(prev => [...prev, { role: 'user', id: Date.now(), mediaType: 'audio', mediaSrc: src, mediaName: 'Voice message' }])
        stream.getTracks().forEach(t => t.stop())
        setTimeout(() => {
          setMessages(prev => [...prev, { role: 'ai', id: Date.now(), text: '🎤 Voice note received. I\'ve noted your message. If you can type the main symptom (e.g. "knocking noise from engine") I can give you a more detailed diagnostic guide.' }])
        }, 500)
      }
      rec.start()
      mediaRecRef.current = rec
      setIsRecording(true)
      setRecordSecs(0)
      recordTimerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000)
    } catch {
      alert('Microphone access denied. Please allow microphone permissions.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecRef.current?.stop()
    setIsRecording(false)
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
  }, [])

  /* Search across all systems */
  const searchResults = searchQuery.length > 1
    ? CAR_SYSTEMS.flatMap(sys =>
        sys.issues
          .filter(issue =>
            issue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            issue.symptoms.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
            sys.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map(issue => ({ ...issue, systemName: sys.name, systemColor: sys.color, systemEmoji: sys.emoji }))
      )
    : []

  const videoCategories = ['All', ...Array.from(new Set(VIDEOS.map(v => v.category)))]
  const filteredVideos  = videoFilter === 'All' ? VIDEOS : VIDEOS.filter(v => v.category === videoFilter)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      animation: 'mrv-slide-in 0.3s cubic-bezier(0.4,0,0.2,1)',
      maxWidth: 480, margin: '0 auto',
    }}>
      <style>{`
        @keyframes mrv-slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .mrv-tab-btn { transition: color 0.2s, border-color 0.2s; }
        .mrv-tab-btn:hover { color: var(--text-hi) !important; }
        .mrv-system-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.12) !important; }
        .mrv-system-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .mrv-issue-row:hover { background: var(--surface-3) !important; }
        .mrv-issue-row { transition: background 0.15s ease; }
        .mrv-send-btn:hover { filter: brightness(1.15); transform: scale(1.05); }
        .mrv-send-btn { transition: filter 0.15s, transform 0.15s; }
        .mrv-video-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important; }
        .mrv-video-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        @keyframes mrv-rec-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px',
        background: 'var(--header-bg)',
        borderBottom: '1px solid var(--border-2)',
        flexShrink: 0,
        paddingTop: 'max(14px, env(safe-area-inset-top, 14px))',
      }}>
        <button
          onClick={onBack}
          style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: 'var(--surface-2)', border: '1px solid var(--border-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft style={{ width: 18, height: 18, color: 'var(--text-hi)' }} />
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 17, lineHeight: 1 }}>Mechanical Repairs</p>
          <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 2 }}>Guides · AI Assistant · Tutorials</p>
        </div>
        <span style={{ fontSize: 24 }}>🔧</span>
      </div>

      {/* Search bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-2)', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--surface-2)', borderRadius: 14,
          border: '1px solid var(--border-2)', padding: '10px 14px',
        }}>
          <Search style={{ width: 16, height: 16, color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search car parts, issues, symptoms…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-hi)', fontSize: 14,
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <X style={{ width: 15, height: 15, color: 'var(--text-dim)' }} />
            </button>
          )}
        </div>

        {/* Search results inline */}
        {searchResults.length > 0 && (
          <div style={{
            marginTop: 10, background: 'var(--surface-1)', borderRadius: 14,
            border: '1px solid var(--border-2)', overflow: 'hidden',
          }}>
            {searchResults.slice(0, 5).map((issue, i) => (
              <div
                key={i}
                className="mrv-issue-row"
                onClick={() => {
                  const sys = CAR_SYSTEMS.find(s => s.name === issue.systemName)!
                  setSelectedSystem(sys)
                  setExpandedIssue(issue.name)
                  setSearchQuery('')
                  setActiveTab('browse')
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', cursor: 'pointer',
                  borderBottom: i < searchResults.length - 1 ? '1px solid var(--border-2)' : 'none',
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{issue.systemEmoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'var(--text-hi)', fontWeight: 700, fontSize: 13, lineHeight: 1 }}>{issue.name}</p>
                  <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 3 }}>{issue.systemName}</p>
                </div>
                <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-ghost)', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}
        {searchQuery.length > 1 && searchResults.length === 0 && (
          <p style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', marginTop: 10 }}>No results for "{searchQuery}"</p>
        )}
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border-2)',
        flexShrink: 0, background: 'var(--bg)',
      }}>
        {(['browse', 'ai', 'videos'] as const).map(tab => (
          <button
            key={tab}
            className="mrv-tab-btn"
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, height: 44, background: 'transparent', border: 'none',
              borderBottom: activeTab === tab ? '2px solid #F59E0B' : '2px solid transparent',
              color: activeTab === tab ? '#F59E0B' : 'var(--text-dim)',
              fontWeight: activeTab === tab ? 800 : 600,
              fontSize: 13, cursor: 'pointer',
              textTransform: 'capitalize',
              letterSpacing: '0.02em',
            }}
          >
            {tab === 'browse' ? '📋 Browse' : tab === 'ai' ? '🤖 AI Guide' : '▶️ Videos'}
          </button>
        ))}
      </div>

      {/* Content — overflow:hidden so each tab controls its own scroll */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ── Browse tab ─────────────────────────────────────── */}
        {activeTab === 'browse' && !selectedSystem && (
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' as const, padding: '16px 16px 32px' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, marginBottom: 14 }}>
              Car Systems — {CAR_SYSTEMS.length} categories
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {CAR_SYSTEMS.map(sys => (
                <div
                  key={sys.id}
                  className="mrv-system-card"
                  onClick={() => { setSelectedSystem(sys); setExpandedIssue(null) }}
                  style={{
                    background: 'var(--surface-1)', borderRadius: 18,
                    border: `1.5px solid ${sys.color}30`,
                    padding: '16px 14px', cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 13, marginBottom: 10,
                    background: `${sys.color}15`, border: `1.5px solid ${sys.color}35`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                  }}>
                    {sys.emoji}
                  </div>
                  <p style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 14, lineHeight: 1, marginBottom: 5 }}>{sys.name}</p>
                  <p style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.4, marginBottom: 8 }}>{sys.desc}</p>
                  <p style={{ color: sys.color, fontSize: 11, fontWeight: 700 }}>{sys.issues.length} guides →</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── System detail view ─────────────────────────────── */}
        {activeTab === 'browse' && selectedSystem && (
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' as const, padding: '16px 16px 32px' }}>
            {/* Back to categories */}
            <button
              onClick={() => { setSelectedSystem(null); setExpandedIssue(null) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              <ArrowLeft style={{ width: 15, height: 15, color: 'var(--text-dim)' }} />
              <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>All Systems</span>
            </button>

            {/* System header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20,
              padding: '14px 16px', borderRadius: 18,
              background: `${selectedSystem.color}12`,
              border: `1.5px solid ${selectedSystem.color}30`,
            }}>
              <span style={{ fontSize: 30 }}>{selectedSystem.emoji}</span>
              <div>
                <p style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 18, lineHeight: 1 }}>{selectedSystem.name}</p>
                <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 4 }}>{selectedSystem.desc}</p>
              </div>
            </div>

            <p style={{ color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, marginBottom: 12 }}>
              Common Issues
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedSystem.issues.map(issue => (
                <div key={issue.name} style={{
                  background: 'var(--surface-1)', borderRadius: 16,
                  border: '1px solid var(--border-2)', overflow: 'hidden',
                }}>
                  {/* Issue header */}
                  <div
                    className="mrv-issue-row"
                    onClick={() => setExpandedIssue(expandedIssue === issue.name ? null : issue.name)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', cursor: 'pointer',
                    }}
                  >
                    <p style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 14 }}>{issue.name}</p>
                    <ChevronDown style={{
                      width: 16, height: 16, color: 'var(--text-dim)', flexShrink: 0,
                      transform: expandedIssue === issue.name ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }} />
                  </div>

                  {/* Expanded content */}
                  {expandedIssue === issue.name && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-2)' }}>
                      {/* Symptoms */}
                      <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 12, marginBottom: 8 }}>
                        Symptoms
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
                        {issue.symptoms.map((s, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: selectedSystem.color, flexShrink: 0, marginTop: 6 }} />
                            <p style={{ color: 'var(--text-md)', fontSize: 13, lineHeight: 1.5 }}>{s}</p>
                          </div>
                        ))}
                      </div>

                      {/* Tips */}
                      <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                        What to Check
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {issue.tips.map((tip, i) => (
                          <div key={i} style={{
                            display: 'flex', gap: 10, padding: '10px 12px',
                            background: 'var(--surface-2)', borderRadius: 12,
                          }}>
                            <span style={{ color: selectedSystem.color, fontWeight: 900, fontSize: 12, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                            <p style={{ color: 'var(--text-md)', fontSize: 13, lineHeight: 1.55 }}>{tip}</p>
                          </div>
                        ))}
                      </div>

                      {/* Ask AI button */}
                      <button
                        onClick={() => {
                          setActiveTab('ai')
                          const prompt = issue.name
                          const aiMsg: ChatMessage = { role: 'ai', id: Date.now(), text: getAIResponse(prompt) }
                          setMessages(prev => [...prev, { role: 'user', id: Date.now() - 1, text: `Tell me about: ${prompt}` }, aiMsg])
                        }}
                        style={{
                          marginTop: 12, width: '100%', height: 40, borderRadius: 12,
                          background: `${selectedSystem.color}15`, border: `1px solid ${selectedSystem.color}35`,
                          color: selectedSystem.color, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        <Bot style={{ width: 14, height: 14 }} /> Ask AI about this
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI tab ────────────────────────────────────────── */}
        {activeTab === 'ai' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Hidden file inputs */}
            <input ref={imageInputRef} type="file" accept="image/*,video/*" capture="environment" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaFile(f); e.target.value = ''; setAttachMenuOpen(false) }} />
            <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaFile(f); e.target.value = ''; setAttachMenuOpen(false) }} />

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', scrollbarWidth: 'none' as const, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: msg.role === 'ai' ? 'rgba(245,158,11,0.15)' : 'rgba(96,165,250,0.15)',
                    border: `1.5px solid ${msg.role === 'ai' ? 'rgba(245,158,11,0.4)' : 'rgba(96,165,250,0.4)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {msg.role === 'ai'
                      ? <Bot  style={{ width: 15, height: 15, color: '#F59E0B' }} />
                      : <User style={{ width: 15, height: 15, color: '#60A5FA' }} />}
                  </div>

                  {/* Bubble */}
                  <div style={{
                    maxWidth: '78%', borderRadius: msg.role === 'ai' ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                    background: msg.role === 'ai' ? 'var(--surface-2)' : 'rgba(96,165,250,0.12)',
                    border: `1px solid ${msg.role === 'ai' ? 'var(--border-2)' : 'rgba(96,165,250,0.25)'}`,
                    overflow: 'hidden',
                  }}>
                    {/* Image */}
                    {msg.mediaType === 'image' && msg.mediaSrc && (
                      <img src={msg.mediaSrc} alt="attachment"
                        style={{ width: '100%', maxWidth: 240, display: 'block', borderRadius: 'inherit' }} />
                    )}
                    {/* Video */}
                    {msg.mediaType === 'video' && msg.mediaSrc && (
                      <video src={msg.mediaSrc} controls
                        style={{ width: '100%', maxWidth: 240, display: 'block', borderRadius: 'inherit' }} />
                    )}
                    {/* Audio */}
                    {msg.mediaType === 'audio' && msg.mediaSrc && (
                      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', background: 'rgba(96,165,250,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <FileAudio style={{ width: 14, height: 14, color: '#60A5FA' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: 'var(--text-hi)', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                            {msg.mediaName ?? 'Audio'}
                          </p>
                          <audio src={msg.mediaSrc} controls style={{ width: '100%', height: 28 }} />
                        </div>
                      </div>
                    )}
                    {/* Text */}
                    {msg.text && (
                      <div style={{ padding: '10px 14px' }}>
                        {msg.text.split('\n').map((line, i) => (
                          <p key={i} style={{ color: 'var(--text-hi)', fontSize: 13, lineHeight: 1.6, marginBottom: i < msg.text!.split('\n').length - 1 ? 4 : 0 }}>
                            {line.replace(/\*\*(.*?)\*\*/g, (_, m) => m)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quick chips */}
            <div style={{ padding: '6px 16px', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
              {['Engine overheating', 'Dead battery', 'Squealing brakes', 'Oil leak', 'Flat tyre'].map(chip => (
                <button key={chip}
                  onClick={() => {
                    const userMsg: ChatMessage = { role: 'user', id: Date.now(), text: chip }
                    const aiMsg:   ChatMessage = { role: 'ai',   id: Date.now() + 1, text: getAIResponse(chip) }
                    setMessages(prev => [...prev, userMsg, aiMsg])
                  }}
                  style={{
                    flexShrink: 0, padding: '5px 12px', borderRadius: 20,
                    background: 'var(--surface-2)', border: '1px solid var(--border-3)',
                    color: 'var(--text-md)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>{chip}</button>
              ))}
            </div>

            {/* Attach menu pop-up */}
            {attachMenuOpen && (
              <>
                <div onClick={() => setAttachMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                <div style={{
                  position: 'absolute', bottom: 72, left: 16, zIndex: 20,
                  background: 'var(--overlay-bg)', borderRadius: 16,
                  border: '1px solid var(--border-3)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                  overflow: 'hidden',
                }}>
                  {[
                    { icon: <Image style={{ width: 18, height: 18, color: '#60A5FA' }} />, label: 'Photo / Video', bg: 'rgba(96,165,250,0.12)', action: () => imageInputRef.current?.click() },
                    { icon: <FileAudio style={{ width: 18, height: 18, color: '#4ADE80' }} />, label: 'Audio File', bg: 'rgba(74,222,128,0.12)', action: () => audioInputRef.current?.click() },
                    { icon: <Mic style={{ width: 18, height: 18, color: '#F59E0B' }} />, label: 'Record Voice', bg: 'rgba(245,158,11,0.12)', action: () => { setAttachMenuOpen(false); startRecording() } },
                  ].map((item, i) => (
                    <button key={i} onClick={item.action}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '13px 18px', background: 'transparent', border: 'none',
                        borderBottom: i < 2 ? '1px solid var(--border-2)' : 'none',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {item.icon}
                      </div>
                      <span style={{ color: 'var(--text-hi)', fontSize: 14, fontWeight: 600 }}>{item.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Input bar */}
            <div style={{
              padding: '10px 16px', borderTop: '1px solid var(--border-2)', flexShrink: 0,
              paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))',
              position: 'relative',
            }}>
              {/* Recording indicator */}
              {isRecording && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                  padding: '8px 14px', borderRadius: 12,
                  background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', animation: 'mrv-rec-pulse 1s ease-in-out infinite' }} />
                  <span style={{ color: '#f87171', fontSize: 13, fontWeight: 700 }}>
                    Recording… {Math.floor(recordSecs / 60).toString().padStart(2, '0')}:{(recordSecs % 60).toString().padStart(2, '0')}
                  </span>
                  <button onClick={stopRecording} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
                    <MicOff style={{ width: 14, height: 14 }} /> Stop
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                {/* Attach button */}
                <button
                  onClick={() => setAttachMenuOpen(o => !o)}
                  style={{
                    width: 44, height: 44, borderRadius: 14, flexShrink: 0, border: 'none',
                    background: attachMenuOpen ? 'rgba(245,158,11,0.15)' : 'var(--surface-2)',
                    border: `1px solid ${attachMenuOpen ? 'rgba(245,158,11,0.4)' : 'var(--border-2)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s',
                  } as React.CSSProperties}
                >
                  {attachMenuOpen
                    ? <XIcon style={{ width: 16, height: 16, color: '#F59E0B' }} />
                    : <Paperclip style={{ width: 16, height: 16, color: 'var(--text-dim)' }} />}
                </button>

                {/* Text input */}
                <input
                  ref={inputRef}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  onFocus={() => setAttachMenuOpen(false)}
                  placeholder={isRecording ? 'Recording audio…' : 'Describe the problem…'}
                  disabled={isRecording}
                  style={{
                    flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                    borderRadius: 14, padding: '11px 14px', outline: 'none',
                    color: 'var(--text-hi)', fontSize: 14,
                    opacity: isRecording ? 0.5 : 1,
                  }}
                />

                {/* Send / mic button */}
                <button
                  className="mrv-send-btn"
                  onClick={isRecording ? stopRecording : sendMessage}
                  style={{
                    width: 44, height: 44, borderRadius: 14, border: 'none', flexShrink: 0,
                    background: isRecording ? '#f87171'
                      : inputText.trim() ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                      : 'var(--surface-3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: (inputText.trim() || isRecording) ? 'pointer' : 'default',
                  }}
                >
                  {isRecording
                    ? <MicOff style={{ width: 16, height: 16, color: '#fff' }} />
                    : inputText.trim()
                      ? <Send style={{ width: 16, height: 16, color: '#000' }} />
                      : <Mic  style={{ width: 16, height: 16, color: 'var(--text-ghost)' }} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Videos tab ────────────────────────────────────── */}
        {activeTab === 'videos' && (
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' as const, padding: '16px 16px 32px' }}>
            {/* Category filter */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 16 }}>
              {videoCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setVideoFilter(cat)}
                  style={{
                    flexShrink: 0, padding: '6px 14px', borderRadius: 20,
                    background: videoFilter === cat ? '#F59E0B' : 'var(--surface-2)',
                    border: videoFilter === cat ? 'none' : '1px solid var(--border-2)',
                    color: videoFilter === cat ? '#000' : 'var(--text-md)',
                    fontSize: 12, fontWeight: videoFilter === cat ? 800 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {filteredVideos.map(video => (
                <div
                  key={video.id}
                  className="mrv-video-card"
                  onClick={() => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(video.title)}`, '_blank', 'noopener,noreferrer')}
                  style={{
                    background: 'var(--surface-1)', borderRadius: 16,
                    border: '1px solid var(--border-2)', overflow: 'hidden',
                    cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    height: 90, background: 'var(--surface-3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 38, position: 'relative',
                  }}>
                    {video.thumb}
                    {/* Play overlay */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0,0,0,0.25)',
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'rgba(245,158,11,0.90)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 12, marginLeft: 2 }}>▶</span>
                      </div>
                    </div>
                    {/* Duration badge */}
                    <div style={{
                      position: 'absolute', bottom: 6, right: 6,
                      background: 'rgba(0,0,0,0.75)', borderRadius: 5,
                      padding: '2px 6px', fontSize: 10, color: '#fff', fontWeight: 700,
                    }}>
                      {video.duration}
                    </div>
                  </div>
                  {/* Info */}
                  <div style={{ padding: '10px 10px' }}>
                    <p style={{ color: 'var(--text-hi)', fontWeight: 700, fontSize: 12, lineHeight: 1.4, marginBottom: 6 }}>
                      {video.title}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: '#F59E0B',
                        background: 'rgba(245,158,11,0.12)', padding: '2px 7px', borderRadius: 6,
                      }}>
                        {video.category}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{video.views} views</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
