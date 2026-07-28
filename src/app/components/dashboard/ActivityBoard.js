import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, Wrench, PackageCheck, ArrowUp, ArrowDown } from 'lucide-react';
import { PT, THAI_MONTHS_SHORT } from './iosTokens';

const money = (n) => `฿${Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
const thDate = (iso) => {
  if (!iso) return '-';
  const p = iso.split('-');
  return `${parseInt(p[2])} ${THAI_MONTHS_SHORT[parseInt(p[1]) - 1]} ${(parseInt(p[0]) + 543) % 100}`;
};
const humanDays = (days) => {
  const d0 = Number(days) || 0;
  if (d0 <= 0) return 'วันนี้';
  const y = Math.floor(d0 / 365);
  const m = Math.floor((d0 % 365) / 30);
  const d = (d0 % 365) % 30;
  const parts = [];
  if (y > 0) parts.push(`${y} ปี`);
  if (m > 0) parts.push(`${m} เดือน`);
  if (d > 0 || parts.length === 0) parts.push(`${d} วัน`);
  return parts.join(' ');
};

const STATUS_TH = {
  Deposit: 'มัดจำ', Paid: 'จ่ายครบ', Completed: 'ส่งมอบแล้ว',
  Waiting: 'รอคิว', Assessing: 'ประเมิน', 'In Progress': 'กำลังซ่อม', Delivered: 'ส่งมอบแล้ว',
};

const TABS = [
  { id: 'sales', label: 'ยอดขาย', icon: ShoppingBag, color: PT.periwinkle, tint: PT.periwinkleTint },
  { id: 'repairs', label: 'งานซ่อม', icon: Wrench, color: PT.mint, tint: PT.mintTint },
  { id: 'deliveries', label: 'การส่งมอบ', icon: PackageCheck, color: PT.sky, tint: PT.skyTint },
];

const SORTS = {
  sales: [{ key: 'date', label: 'วันที่ซื้อ' }, { key: 'total', label: 'ยอดซื้อ' }, { key: 'wait', label: 'รอนานสุด' }],
  repairs: [{ key: 'date', label: 'วันที่รับ' }, { key: 'total', label: 'ยอด' }, { key: 'wait', label: 'รอนานสุด' }],
  deliveries: [{ key: 'date', label: 'วันส่งมอบ' }, { key: 'total', label: 'ยอด' }, { key: 'lead', label: 'ใช้เวลานานสุด' }],
};

const Avatar = ({ img, name, tint, color, gray }) => (
  <span style={gray ? { filter: 'grayscale(1)', opacity: 0.8 } : undefined}>
    {img ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={img} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />
    ) : (
      <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: tint }}>
        <span style={{ fontSize: 14, fontWeight: 800, color }}>{(name || '?').trim().charAt(0)}</span>
      </span>
    )}
  </span>
);

const itemsLabel = (items, itemCount) => {
  if (!items?.length) return null;
  const main = items[0]?.name || '';
  const extra = (itemCount || items.length) - 1;
  return extra > 0 ? `${main} +${extra}` : main;
};

// แถวเดียวกันทุกแท็บ: avatar | ลูกค้า+สินค้า | เอกสาร+สถานะ | ยอด+เวลา
const Row = ({ img, name, sub, subPrefix, doc, date, pill, amount, amountColor, timeText, timeColor, gray }) => (
  <div
    className="grid items-center gap-x-3 px-4 sm:px-5 py-3 transition-colors duration-150 hover:bg-[#F7F8FC]"
    style={{
      gridTemplateColumns: 'auto minmax(0,1.35fr) minmax(0,1fr) auto',
      borderBottom: `1px solid ${PT.gridLine}`,
      opacity: gray ? 0.72 : 1,
    }}
  >
    <Avatar img={img} name={name} tint={PT.bg} color={PT.muted} gray={gray} />

    <div className="min-w-0">
      <p className="truncate" style={{ fontSize: 13.5, fontWeight: 800, color: gray ? PT.ghost : PT.ink }}>{name}</p>
      <p className="truncate mt-0.5" style={{ fontSize: 12, fontWeight: 600, color: PT.muted }}>
        {subPrefix}{sub || '-'}
      </p>
    </div>

    <div className="hidden sm:block min-w-0">
      <p className="truncate" style={{ fontSize: 11.5, fontWeight: 600, color: PT.faint }}>{doc} · {date}</p>
      {pill && (
        <span className="inline-block mt-1 rounded-full px-2 py-0.5" style={{ fontSize: 10.5, fontWeight: 800, color: pill.color, background: pill.bg }}>
          {pill.text}
        </span>
      )}
    </div>

    <div className="text-right">
      <p className="tabular-nums" style={{ fontSize: 14, fontWeight: 800, color: gray ? PT.ghost : amountColor }}>{amount}</p>
      {timeText && <p className="mt-0.5 whitespace-nowrap" style={{ fontSize: 11, fontWeight: 700, color: timeColor }}>{timeText}</p>}
    </div>
  </div>
);

// บอร์ดรายการ: แท็บเดียวการ์ดเดียว สูงคงที่ ไม่มีคอลัมน์เหลื่อม
const ActivityBoard = ({ range }) => {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('sales');
  const [sorts, setSorts] = useState({
    sales: { key: 'date', desc: true },
    repairs: { key: 'date', desc: true },
    deliveries: { key: 'date', desc: true },
  });

  useEffect(() => {
    let on = true;
    (async () => {
      const [lists, quotes] = await Promise.all([
        supabase.rpc('dash_sales_lists', { p_start: range.start, p_end: range.end }),
        supabase.rpc('dash_sales_quotes', { p_start: range.start, p_end: range.end }),
      ]);
      if (!on) return;
      if (lists.error) console.error('dash_sales_lists:', lists.error);
      if (quotes.error) console.error('dash_sales_quotes:', quotes.error);
      setData({
        ...(lists.data || { sales: [], repairs: [], deliveries: [] }),
        quotes: Array.isArray(quotes.data) ? quotes.data : [],
      });
    })();
    return () => { on = false; };
  }, [range.start, range.end]);

  const sort = sorts[tab];
  const setSort = (s) => setSorts(prev => ({ ...prev, [tab]: s }));

  const sorted = useMemo(() => {
    if (!data) return [];
    const getters = {
      sales: { date: r => new Date(r.date).getTime(), total: r => +r.total || 0, wait: r => r.waiting_days ?? -1 },
      repairs: { date: r => new Date(r.date).getTime(), total: r => +r.total || 0, wait: r => r.waiting_days ?? r.done_days ?? -1 },
      deliveries: { date: r => new Date(r.delivered_date).getTime(), total: r => +r.total || 0, lead: r => r.lead_days ?? -1 },
    }[tab];
    const base = tab === 'repairs'
      ? (data.repairs || []).filter(r => Number(r.total) > 0)
      : (data[tab] || []);
    const g = getters[sort.key] || (() => 0);
    return [...base].sort((a, b) => (g(b) - g(a)) * (sort.desc ? 1 : -1));
  }, [data, tab, sort]);

  const counts = useMemo(() => ({
    sales: (data?.sales || []).length,
    repairs: (data?.repairs || []).filter(r => Number(r.total) > 0).length,
    deliveries: (data?.deliveries || []).length,
  }), [data]);

  if (!data) {
    return <div className="animate-pulse" style={{ background: PT.card, borderRadius: PT.radius, height: 420, boxShadow: PT.cardShadow }} />;
  }

  const activeTab = TABS.find(t => t.id === tab);

  return (
    <div style={{ background: PT.card, borderRadius: PT.radius, boxShadow: PT.cardShadow }} className="overflow-hidden">

      {/* หัวการ์ด: แท็บซ้าย เรียงขวา */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${PT.gridLine}` }}>
        <div className="inline-flex p-1 rounded-full" style={{ background: PT.bg }}>
          {TABS.map(t => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 rounded-full px-3.5 sm:px-4 py-2 transition-all duration-200 active:scale-95"
                style={{
                  fontSize: 13, fontWeight: 800,
                  background: active ? PT.card : 'transparent',
                  color: active ? t.color : PT.muted,
                  boxShadow: active ? '0 2px 8px rgba(60,70,130,0.12)' : 'none',
                }}
              >
                <Icon size={14} strokeWidth={2.4} />
                {t.label}
                <span
                  className="rounded-full px-1.5 py-px tabular-nums"
                  style={{ fontSize: 10.5, fontWeight: 800, background: active ? t.tint : 'rgba(124,130,161,0.14)', color: active ? t.color : PT.muted }}
                >
                  {counts[t.id]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <span style={{ fontSize: 11, fontWeight: 700, color: PT.faint }} className="mr-1 hidden sm:inline">เรียงตาม</span>
          {SORTS[tab].map(o => {
            const active = sort.key === o.key;
            return (
              <button
                key={o.key}
                onClick={() => setSort(active ? { key: o.key, desc: !sort.desc } : { key: o.key, desc: true })}
                className="flex items-center gap-0.5 rounded-full px-2.5 py-1.5 transition-all duration-150 active:scale-95"
                style={{
                  fontSize: 11.5, fontWeight: 800,
                  background: active ? activeTab.tint : 'transparent',
                  color: active ? activeTab.color : PT.muted,
                }}
              >
                {o.label}
                {active && (sort.desc ? <ArrowDown size={11} strokeWidth={3} /> : <ArrowUp size={11} strokeWidth={3} />)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ลิสต์ */}
      <div className="overflow-y-auto" style={{ maxHeight: 430 }}>
        {sorted.length === 0 && (
          <p className="text-center py-14" style={{ fontSize: 13, fontWeight: 600, color: PT.faint }}>
            ไม่มีรายการในช่วงนี้
          </p>
        )}

        {tab === 'sales' && sorted.map(r => (
          <Row
            key={r.doc_no}
            img={r.customer_img} name={r.customer}
            sub={itemsLabel(r.items, r.item_count) || 'ไม่มีรายการสินค้า'}
            doc={r.doc_no} date={thDate(r.date)}
            pill={{
              text: (STATUS_TH[r.status] || r.status) + (r.cust_orders > 1 ? ` · ซื้อครั้งที่ ${r.cust_orders}` : ''),
              color: PT.muted, bg: PT.bg,
            }}
            amount={money(r.total)} amountColor={PT.periwinkle}
            timeText={r.waiting_days != null ? `รอประกอบ ${humanDays(r.waiting_days)}` : null} timeColor={PT.peach}
          />
        ))}

        {tab === 'sales' && (data.quotes || []).length > 0 && (
          <>
            <div className="px-4 sm:px-5 py-2.5" style={{ background: PT.bg }}>
              <p style={{ fontSize: 11.5, fontWeight: 800, color: PT.ghost }}>จัดสเปคแล้วยังไม่ซื้อ ({data.quotes.length})</p>
            </div>
            {data.quotes.map(r => (
              <Row
                key={r.doc_no} gray
                img={r.customer_img} name={r.customer}
                sub={itemsLabel(r.items, r.item_count) || 'ยังไม่ระบุสเปค'}
                doc={r.doc_no} date={thDate(r.date)}
                pill={{ text: 'ยังไม่ตัดสินใจ', color: PT.ghost, bg: PT.ghostTint }}
                amount={money(r.total)} amountColor={PT.ghost}
                timeText={r.age_days != null ? `ค้างมา ${humanDays(r.age_days)}` : null} timeColor={PT.ghost}
              />
            ))}
          </>
        )}

        {tab === 'repairs' && sorted.map(r => (
          <Row
            key={r.doc_no}
            img={r.customer_img} name={r.customer}
            sub={r.desc}
            doc={r.doc_no} date={thDate(r.date)}
            pill={{ text: STATUS_TH[r.status] || r.status, color: PT.muted, bg: PT.bg }}
            amount={money(r.total)} amountColor={PT.mint}
            timeText={r.waiting_days != null ? `รอมาแล้ว ${humanDays(r.waiting_days)}` : (r.done_days != null ? `ซ่อมเสร็จใน ${humanDays(r.done_days)}` : null)}
            timeColor={r.waiting_days != null ? PT.peach : PT.mint}
          />
        ))}

        {tab === 'deliveries' && sorted.map(r => {
          const isOrder = r.kind === 'order';
          return (
            <Row
              key={`${r.kind}-${r.doc_no}`}
              img={r.customer_img} name={r.customer}
              subPrefix={(
                <span style={{ color: isOrder ? PT.periwinkle : PT.mint, fontWeight: 800 }}>
                  {isOrder ? 'งานขาย · ' : 'งานซ่อม · '}
                </span>
              )}
              sub={isOrder ? (itemsLabel(r.items, r.item_count) || 'ออเดอร์') : 'งานซ่อมบำรุง'}
              doc={r.doc_no} date={`ส่งมอบ ${thDate(r.delivered_date)}`}
              pill={{
                text: isOrder ? 'งานขาย' : 'งานซ่อม',
                color: isOrder ? PT.periwinkle : PT.mint,
                bg: isOrder ? PT.periwinkleTint : PT.mintTint,
              }}
              amount={money(r.total)} amountColor={isOrder ? PT.periwinkle : PT.mint}
              timeText={r.lead_days != null ? `ซื้อ→ส่งมอบ ${humanDays(r.lead_days)}` : 'วันที่ซื้อไม่ถูกต้อง'}
              timeColor={r.lead_days != null ? PT.sky : PT.peach}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ActivityBoard;
