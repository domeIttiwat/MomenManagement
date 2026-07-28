import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, Wrench, Megaphone } from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts';
import { PT, withAlpha, THAI_MONTHS_SHORT } from './iosTokens';

const money = (n) => `฿${Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
const compact = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${Math.round(v)}`;
};
const bucketLabel = (b) => {
  if (!b) return '';
  const p = b.split('-');
  return p.length === 3 ? `${parseInt(p[2])} ${THAI_MONTHS_SHORT[parseInt(p[1]) - 1]}` : THAI_MONTHS_SHORT[parseInt(p[1]) - 1];
};

// เส้นวันซื้อโฆษณา — ยิ่งซื้อเยอะสียิ่งเข้ม/สด
const mktColor = (amount, max) => {
  const t = max > 0 ? Math.max(0.25, amount / max) : 0.25;
  return withAlpha(PT.peach, +(0.35 + 0.65 * t).toFixed(2));
};

// การ์ดสรุปยอดสีพาสเทล
const StatCard = ({ tint, color, icon: Icon, label, value, caption }) => (
  <div
    className="flex items-center gap-3.5 px-5 py-4 transition-all duration-200 hover:-translate-y-0.5"
    style={{ background: tint, borderRadius: PT.radius }}
  >
    <span
      className="flex items-center justify-center w-11 h-11 shrink-0"
      style={{ background: PT.card, borderRadius: 14, boxShadow: '0 4px 10px rgba(124,110,220,0.10)' }}
    >
      <Icon size={20} strokeWidth={2.2} style={{ color }} />
    </span>
    <div className="min-w-0">
      <p style={{ fontSize: 12, fontWeight: 700, color: PT.muted }}>{label}</p>
      <p className="tabular-nums leading-tight truncate" style={{ fontSize: 22, fontWeight: 800, color: PT.ink }}>{value}</p>
      {caption && <p style={{ fontSize: 11, fontWeight: 600, color: PT.muted }} className="mt-0.5">{caption}</p>}
    </div>
  </div>
);

// Tooltip การ์ดขาวนุ่ม
const SoftTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const r = payload[0]?.payload || {};
  const Row = ({ color, name, value }) => (
    <div className="flex items-center justify-between gap-6">
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: PT.muted }}>{name}</span>
      </span>
      <span className="tabular-nums" style={{ fontSize: 12.5, fontWeight: 800, color: PT.ink }}>{money(value)}</span>
    </div>
  );
  return (
    <div className="px-4 py-3 space-y-1.5" style={{ background: PT.card, borderRadius: 16, boxShadow: PT.popShadow, fontFamily: PT.font }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: PT.ink }}>{bucketLabel(r.bucket)}</p>
      <Row color={PT.periwinkle} name="ออเดอร์" value={r.orders} />
      <Row color={PT.mint} name="งานซ่อมบำรุง" value={r.services} />
      {Number(r.marketing) > 0 && <Row color={PT.peach} name="ซื้อโฆษณา" value={r.marketing} />}
      {(r.deliveries || []).length > 0 && (
        <div className="pt-1.5 mt-0.5 space-y-1" style={{ borderTop: `1px dashed ${PT.gridLine}` }}>
          <p style={{ fontSize: 11.5, fontWeight: 800, color: PT.sky }}>ส่งมอบงาน {r.deliveries.length} รายการ</p>
          {r.deliveries.map((d, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className="rounded-full px-1.5 py-px shrink-0"
                style={{
                  fontSize: 10, fontWeight: 800,
                  color: d.kind === 'order' ? PT.periwinkle : PT.mint,
                  background: d.kind === 'order' ? PT.periwinkleTint : PT.mintTint,
                }}
              >
                {d.kind === 'order' ? 'ขาย' : 'ซ่อม'}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: PT.ink }}>{d.doc_no}</span>
              <span style={{ fontSize: 12, color: PT.muted }} className="truncate">· {d.customer}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// กราฟรายได้เข้า แยกออเดอร์/งานซ่อม + เส้นแนวตั้งวันซื้อโฆษณา — เลย์เอาต์พาสเทลโมเดิร์น
const IncomeChart = ({ range }) => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let on = true;
    (async () => {
      setError(false);
      const { data, error: err } = await supabase.rpc('dash_income_marketing', {
        p_start: range.start, p_end: range.end, p_group: range.group,
      });
      if (!on) return;
      if (err) { console.error('dash_income_marketing:', err); setError(true); setRows([]); return; }
      setRows((data || []).map(r => ({
        ...r,
        orders: Number(r.orders) || 0,
        services: Number(r.services) || 0,
        marketing: Number(r.marketing) || 0,
        deliveries: Array.isArray(r.deliveries) ? r.deliveries : [],
      })));
    })();
    return () => { on = false; };
  }, [range.start, range.end, range.group]);

  const maxMkt = useMemo(() => Math.max(0, ...(rows || []).map(r => r.marketing)), [rows]);
  const mktDays = useMemo(() => (rows || []).filter(r => r.marketing > 0), [rows]);
  const dlvDays = useMemo(() => (rows || []).filter(r => (r.deliveries || []).length > 0), [rows]);
  const dlvTotal = useMemo(() => dlvDays.reduce((s, r) => s + r.deliveries.length, 0), [dlvDays]);
  const totals = useMemo(() => (rows || []).reduce(
    (a, r) => ({ orders: a.orders + r.orders, services: a.services + r.services, marketing: a.marketing + r.marketing }),
    { orders: 0, services: 0, marketing: 0 },
  ), [rows]);
  const isEmpty = rows && rows.every(r => !r.orders && !r.services && !r.marketing);

  return (
    <div className="space-y-4">
      {/* การ์ดสรุปยอด 3 ใบ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard tint={PT.periwinkleTint} color={PT.periwinkle} icon={ShoppingBag} label="รายได้จากออเดอร์" value={money(totals.orders)} />
        <StatCard tint={PT.mintTint} color={PT.mint} icon={Wrench} label="รายได้งานซ่อมบำรุง" value={money(totals.services)} />
        <StatCard
          tint={PT.peachTint} color={PT.peach} icon={Megaphone} label="ซื้อโฆษณา"
          value={money(totals.marketing)}
          caption={mktDays.length > 0 ? `${mktDays.length} วันในช่วงนี้` : 'ไม่มีการซื้อในช่วงนี้'}
        />
      </div>

      {/* การ์ดกราฟหลัก */}
      <div
        className="px-5 pt-5 pb-4 transition-shadow duration-200"
        style={{ background: PT.card, borderRadius: PT.radius, boxShadow: PT.cardShadow }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: PT.ink }}>รายได้เข้าในแต่ละวัน</h3>
            <p style={{ fontSize: 12, fontWeight: 600, color: PT.muted }} className="mt-0.5">
              ตามวันรับเงินจริง · เส้นพีช = วันซื้อโฆษณา (เข้ม = ยอดสูง) · เส้นฟ้า = วันส่งมอบงาน{dlvTotal > 0 ? ` (${dlvTotal} รายการในช่วงนี้)` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[[PT.periwinkle, 'ออเดอร์'], [PT.mint, 'งานซ่อมบำรุง']].map(([c, t]) => (
              <span key={t} className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: PT.bg }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: PT.ink }}>{t}</span>
              </span>
            ))}
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: PT.skyTint }}>
              <span className="w-px h-3 border-l-2 border-dotted" style={{ borderColor: PT.sky }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: PT.sky }}>ส่งมอบงาน</span>
            </span>
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: PT.peachTint }}>
              <span className="w-px h-3 border-l-2 border-dashed" style={{ borderColor: PT.peach }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: PT.peach }}>ซื้อโฆษณา</span>
            </span>
          </div>
        </div>

        <div className="mt-4" style={{ height: 320 }}>
          {!rows ? (
            <div className="w-full h-full animate-pulse" style={{ background: PT.bg, borderRadius: PT.radiusSm }} />
          ) : error ? (
            <div className="w-full h-full flex items-center justify-center">
              <p style={{ fontSize: 14, fontWeight: 600, color: PT.faint }}>โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง</p>
            </div>
          ) : isEmpty ? (
            <div className="w-full h-full flex items-center justify-center">
              <p style={{ fontSize: 14, fontWeight: 600, color: PT.faint }}>ไม่มีรายได้เข้าในช่วงนี้</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -6, bottom: 0 }} barGap={2}>
                <defs>
                  <linearGradient id="gOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PT.periwinkle} />
                    <stop offset="100%" stopColor={withAlpha(PT.periwinkle, 0.55)} />
                  </linearGradient>
                  <linearGradient id="gServices" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PT.mint} />
                    <stop offset="100%" stopColor={withAlpha(PT.mint, 0.55)} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={PT.gridLine} strokeDasharray="4 6" />
                <XAxis
                  dataKey="bucket" tickFormatter={bucketLabel} axisLine={false} tickLine={false}
                  tick={{ fontSize: 11, fill: PT.muted, fontFamily: PT.font, fontWeight: 600 }} dy={8} minTickGap={24}
                />
                <YAxis
                  axisLine={false} tickLine={false} width={44}
                  tick={{ fontSize: 11, fill: PT.muted, fontFamily: PT.font, fontWeight: 600 }}
                  tickFormatter={compact}
                />
                <Tooltip content={<SoftTooltip />} cursor={{ fill: withAlpha(PT.periwinkle, 0.06) }} />

                {mktDays.map(r => (
                  <ReferenceLine
                    key={`m-${r.bucket}`} x={r.bucket}
                    stroke={mktColor(r.marketing, maxMkt)}
                    strokeWidth={2.5} strokeDasharray="5 4"
                  />
                ))}
                {/* เส้นวันส่งมอบงาน — ฟ้า จุดถี่ */}
                {dlvDays.map(r => (
                  <ReferenceLine
                    key={`d-${r.bucket}`} x={r.bucket}
                    stroke={withAlpha(PT.sky, Math.min(1, 0.55 + 0.15 * r.deliveries.length))}
                    strokeWidth={2.5} strokeDasharray="1.5 3.5"
                  />
                ))}

                <Bar dataKey="orders" fill="url(#gOrders)" radius={[6, 6, 0, 0]} maxBarSize={20} />
                <Bar dataKey="services" fill="url(#gServices)" radius={[6, 6, 0, 0]} maxBarSize={20} />
                <Line dataKey="marketing" stroke="transparent" dot={false} activeDot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default IncomeChart;
