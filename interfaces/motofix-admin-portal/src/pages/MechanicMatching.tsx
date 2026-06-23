// MechanicMatching.tsx — an explainer screen showing HOW the matching engine ranks
// mechanics: it lays out the four scoring factors and their weights (mirroring the
// matching-service scoring.py) so admins understand why a given mechanic is chosen.

import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Sparkles, MapPin, Star, CheckCircle2, Trophy, Cpu, Wrench, Zap } from 'lucide-react';

/* ── The matching engine's feature weights (mirrors the live matching-service
   scoring.py, which uses the XGBoost-Monotonic model's learned importances). ── */
const WEIGHTS = [
  { key: 'spec_match',   label: 'Specialisation', importance: 0.3546, color: '#A78BFA', blurb: 'Right skill for the exact fault — the primary filter.' },
  { key: 'availability', label: 'Availability',   importance: 0.2978, color: '#34D399', blurb: 'Free and reliable enough to take and finish the job.' },
  { key: 'proximity',    label: 'Proximity',      importance: 0.1020, color: '#60A5FA', blurb: 'How close they are — deliberately secondary to skill.' },
  { key: 'rating',       label: 'Rating',         importance: 0.0267, color: '#F59E0B', blurb: 'Historical star quality from past jobs.' },
];
const WSUM = WEIGHTS.reduce((s, w) => s + w.importance, 0);

const FAULTS: { label: string; keyword: string }[] = [
  { label: 'Brakes Failing', keyword: 'brake' },
  { label: 'Dead Battery',   keyword: 'battery' },
  { label: 'Flat Tyre',      keyword: 'tyre' },
  { label: 'Engine Fault',   keyword: 'engine' },
  { label: 'Electrical',     keyword: 'electrical' },
  { label: 'Towing',         keyword: 'tow' },
];

type Mech = { name: string; area: string; specs: string[]; distanceKm: number; rating: number; availability: number };
const ROSTER: Mech[] = [
  { name: 'Kamya Auto',        area: 'Kampala Central', specs: ['brake', 'suspension'],   distanceKm: 4.2, rating: 4.7, availability: 95 },
  { name: 'Nakato Motors',     area: 'Nakawa',          specs: ['battery', 'electrical'], distanceKm: 1.1, rating: 4.4, availability: 90 },
  { name: 'Okello Garage',     area: 'Ntinda',          specs: ['tyre', 'engine'],        distanceKm: 6.5, rating: 4.8, availability: 88 },
  { name: 'Ssalongo Repairs',  area: 'Wandegeya',       specs: [],                        distanceKm: 0.8, rating: 4.1, availability: 80 },
  { name: 'Auma Engineering',  area: 'Bukoto',          specs: ['engine', 'transmission'],distanceKm: 3.0, rating: 4.9, availability: 92 },
  { name: 'Mubiru Recovery',   area: 'Kireka',          specs: ['tow', 'recovery'],       distanceKm: 5.0, rating: 4.3, availability: 85 },
];

const MAX_DISTANCE_KM = 50;
const specScore = (specs: string[], kw: string) => {
  if (!specs.length) return 30;                          // generalist — slight credit
  return specs.some(s => s.includes(kw) || kw.includes(s)) ? 100 : 0;  // exact specialist vs wrong specialist
};
const proxScore = (d: number) => Math.max(0, (1 - d / MAX_DISTANCE_KM) * 100);
const ratingScore = (r: number) => (r / 5) * 100;

function rationale(spec: number, avail: number, prox: number, distanceKm: number, rat: number): string {
  const bits: string[] = [];
  if (spec >= 100) bits.push('exact specialist for this fault');
  else if (spec <= 0) bits.push('not a specialist for this fault');
  else bits.push('generalist');
  if (rat >= 90) bits.push('top rating');
  if (avail >= 90) bits.push('highly available');
  if (prox >= 80) bits.push('very close by');
  else if (prox <= 60) bits.push(`~${distanceKm.toFixed(0)} km away`);
  const head = bits[0][0].toUpperCase() + bits[0].slice(1);
  return head + (bits.length > 1 ? '; ' + bits.slice(1).join(', ') : '') + '.';
}

export default function MechanicMatching() {
  const [faultIdx, setFaultIdx] = useState(0);
  const fault = FAULTS[faultIdx];

  const ranked = useMemo(() => {
    return ROSTER.map(m => {
      const spec = specScore(m.specs, fault.keyword);
      const avail = m.availability;
      const prox = proxScore(m.distanceKm);
      const rat = ratingScore(m.rating);
      const raw = spec * WEIGHTS[0].importance + avail * WEIGHTS[1].importance + prox * WEIGHTS[2].importance + rat * WEIGHTS[3].importance;
      const priority = raw / WSUM;
      return { m, spec, avail, prox, rat, priority, rationale: rationale(spec, avail, prox, m.distanceKm, rat) };
    }).sort((a, b) => b.priority - a.priority);
  }, [faultIdx]);

  const winner = ranked[0];
  const closest = [...ROSTER].sort((a, b) => a.distanceKm - b.distanceKm)[0];
  const winnerIsFarther = winner.m.name !== closest.name;

  const bar = (value: number, color: string) => (
    <div style={{ flex: 1, height: 7, borderRadius: 999, background: 'var(--adm-row-hover, rgba(0,0,0,0.08))', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, value))}%`, background: color, borderRadius: 999 }} />
    </div>
  );

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-primary text-xs font-bold tracking-wide uppercase mb-1">
            <Cpu size={14} /> Intelligent Mechanic Matching
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">How MOTOFIX matches mechanics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every dispatch is ranked by a machine-learning model (XGBoost-Monotonic, 73% top-1 accuracy).
            It weighs four factors and prefers the right <strong>specialist</strong> over the merely closest mechanic.
          </p>
        </div>

        {/* Model explainer — the weighted factors */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">What the model weighs</p>
          <div className="space-y-3">
            {WEIGHTS.map(w => (
              <div key={w.key} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm font-semibold text-foreground">{w.label}</span>
                {bar(w.importance / WEIGHTS[0].importance * 100, w.color)}
                <span className="w-14 text-right text-sm font-bold" style={{ color: w.color }}>{(w.importance * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
            <strong className="text-foreground">Skill beats speed:</strong> specialisation (35%) and availability (30%) dominate, while
            distance is only ~10%. A brake expert a few km away outranks a closer generalist. The model is <em>monotonic</em> in
            distance — a mechanic's priority always falls the farther they are, unless stronger skill or rating offsets it.
          </p>
        </div>

        {/* Scenario simulator */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Live scenario — pick a fault</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {FAULTS.map((f, i) => (
              <button
                key={f.label}
                onClick={() => setFaultIdx(i)}
                className="px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors"
                style={{
                  background: i === faultIdx ? 'var(--adm-amber)' : 'transparent',
                  color: i === faultIdx ? 'var(--adm-invert-text)' : 'var(--adm-text)',
                  border: i === faultIdx ? '1.5px solid rgba(0,0,0,0.5)' : '1.5px solid var(--adm-divider)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Winner banner */}
          <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.30)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={16} style={{ color: '#A78BFA' }} />
              <span className="text-sm font-extrabold text-foreground">Matched: {winner.m.name}</span>
              <span className="ml-auto text-lg font-extrabold" style={{ color: '#A78BFA' }}>{winner.priority.toFixed(1)}%</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {winner.rationale}
              {winnerIsFarther && winner.spec >= 100 && (
                <> It won even though <strong className="text-foreground">{closest.name}</strong> is closer
                ({closest.distanceKm.toFixed(1)} km) — the right specialisation outweighs raw distance.</>
              )}
            </p>
          </div>

          {/* Ranked candidates */}
          <div className="space-y-3">
            {ranked.map((r, i) => (
              <div key={r.m.name} className="rounded-xl border p-3.5" style={{ borderColor: i === 0 ? 'rgba(167,139,250,0.5)' : 'var(--adm-divider)', background: i === 0 ? 'rgba(167,139,250,0.05)' : 'transparent' }}>
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: i === 0 ? '#A78BFA' : 'var(--adm-row-hover)', color: i === 0 ? '#fff' : 'var(--adm-text)' }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{r.m.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="inline-flex items-center gap-1"><MapPin size={11} /> {r.m.area} · {r.m.distanceKm.toFixed(1)} km</span>
                      <span className="inline-flex items-center gap-1"><Star size={11} style={{ color: '#F59E0B', fill: '#F59E0B' }} /> {r.m.rating.toFixed(1)}</span>
                      {r.spec >= 100 && <span className="inline-flex items-center gap-1" style={{ color: '#A78BFA' }}><CheckCircle2 size={11} /> specialist</span>}
                    </p>
                  </div>
                  <span className="text-base font-extrabold" style={{ color: i === 0 ? '#A78BFA' : 'var(--adm-text)' }}>{r.priority.toFixed(1)}%</span>
                </div>
                {/* per-factor bars */}
                {[
                  { label: 'Specialisation', v: r.spec, c: '#A78BFA' },
                  { label: 'Availability',   v: r.avail, c: '#34D399' },
                  { label: 'Proximity',      v: r.prox, c: '#60A5FA' },
                  { label: 'Rating',         v: r.rat, c: '#F59E0B' },
                ].map(f => (
                  <div key={f.label} className="flex items-center gap-3 mb-1.5">
                    <span className="w-24 shrink-0 text-[11px] text-muted-foreground">{f.label}</span>
                    {bar(f.v, f.c)}
                    <span className="w-8 text-right text-[11px] font-semibold text-muted-foreground">{Math.round(f.v)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
            This simulator uses the same factor weights as the live matching engine. In production these scores are computed
            from real mechanics' specialisations, availability, GPS distance and ratings each time a request comes in.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
