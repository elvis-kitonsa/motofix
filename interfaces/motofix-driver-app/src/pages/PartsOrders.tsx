// PartsOrders.tsx — the driver's history of spare-parts orders they've placed (what they
// ordered, from which dealer, estimated cost, status), with a way to re-contact the dealer.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Phone, Loader2, Package, Clock } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { partsService, PartsOrder } from '@/config/api';

const PURPLE = '#A78BFA';
const fmtUGX = (n: number) => {
  if (n >= 1_000_000) return `UGX ${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `UGX ${(n / 1_000).toFixed(n % 1_000 ? 1 : 0)}K`;
  return `UGX ${n.toLocaleString()}`;
};
const range = (a?: number | null, b?: number | null) =>
  (a == null && b == null) ? null : a === b ? fmtUGX(a ?? 0) : `${fmtUGX(a ?? 0)} – ${fmtUGX(b ?? 0)}`;

export default function PartsOrders() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [orders, setOrders] = useState<PartsOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    partsService.listOrders()
      .then(r => { if (!cancelled) setOrders(r.data || []); })
      .catch(() => { /* leave empty */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const bg = isDark ? '#0b0f17' : '#f5f6fa';
  const surface = isDark ? '#111827' : '#ffffff';
  const textHi = isDark ? '#f9fafb' : '#111827';
  const textMd = isDark ? '#d1d5db' : '#374151';
  const textLo = isDark ? '#9ca3af' : '#6b7280';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <div style={{ position: 'fixed', inset: 0, background: bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', flexShrink: 0,
        background: surface, borderBottom: `1px solid ${border}`,
      }}>
        <button onClick={() => navigate(-1)} style={{
          width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: textHi,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><ArrowLeft size={18} /></button>
        <div style={{ fontSize: 15, fontWeight: 700, color: textHi }}>My Parts Orders</div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={28} style={{ color: PURPLE, animation: 'mf-spin 1s linear infinite' }} />
        </div>
      ) : orders.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, textAlign: 'center' }}>
          <Package size={38} style={{ color: textLo, opacity: 0.6 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: textHi }}>No orders yet</div>
          <div style={{ fontSize: 12.5, color: textLo }}>When you order parts from a dealer, your orders will show up here.</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.map(o => (
            <div key={o.id} style={{ background: surface, borderRadius: 14, padding: 14, border: `1px solid ${border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <ShoppingBag size={15} style={{ color: PURPLE, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.fault_label || o.fault_category || 'Spare parts'}
                  </span>
                </div>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, textTransform: 'capitalize',
                  background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)',
                }}>{o.status}</span>
              </div>
              {o.dealer_name && (
                <div style={{ fontSize: 12.5, color: textMd, marginBottom: 4 }}>
                  Dealer: <strong>{o.dealer_name}</strong>{o.dealer_phone ? ` · ${o.dealer_phone}` : ''}
                </div>
              )}
              <div style={{ fontSize: 12, color: textLo, marginBottom: 6 }}>
                {o.parts.map(p => `${p.qty > 1 ? p.qty + '× ' : ''}${p.name}`).join(', ') || '—'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: textLo }}>
                  <Clock size={11} /> {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {range(o.estimated_total_min, o.estimated_total_max) && (
                  <span style={{ fontSize: 13, fontWeight: 800, color: textHi }}>{range(o.estimated_total_min, o.estimated_total_max)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes mf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
