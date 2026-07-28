import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PT, withAlpha } from './iosTokens';

const money = (n) => `฿${Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;

// หัวข้อย่อยในการ์ด: จุดสี + ชื่อ + ยอดรวม
const ColHead = ({ color, title, subtitle }) => (
  <div className="flex items-center gap-2 mb-4">
    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
    <p style={{ fontSize: 13.5, fontWeight: 800, color: PT.ink }}>{title}</p>
    <p className="ml-auto tabular-nums" style={{ fontSize: 12, fontWeight: 700, color: PT.muted }}>{subtitle}</p>
  </div>
);

// Top 5 แบบตารางโปร่ง: อันดับ | ชื่อ ×จำนวน | ยอด + แถบบางใต้ชื่อ
const TopList = ({ items, color, unit }) => {
  const max = Math.max(1, ...items.map(i => Number(i.revenue) || 0));
  if (!items.length) {
    return <p className="text-center py-8" style={{ fontSize: 12.5, fontWeight: 600, color: PT.faint }}>ไม่มียอดขายในช่วงนี้</p>;
  }
  return (
    <div className="space-y-3.5">
      {items.map((it, i) => (
        <div key={it.name}>
          <div className="flex items-baseline gap-2">
            <span className="tabular-nums shrink-0 text-center" style={{ fontSize: 12, fontWeight: 800, color: i === 0 ? color : PT.faint, width: 14 }}>
              {i + 1}
            </span>
            <p className="flex-1 truncate" style={{ fontSize: 13, fontWeight: 700, color: PT.ink }}>
              {it.name}
              <span style={{ fontSize: 11.5, fontWeight: 700, color: PT.muted }}> · {Number(it.qty)} {unit}</span>
            </p>
            <p className="tabular-nums shrink-0" style={{ fontSize: 13, fontWeight: 800, color: PT.ink }}>{money(it.revenue)}</p>
          </div>
          <div className="ml-[22px] mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: PT.bg }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(3, (Number(it.revenue) / max) * 100)}%`, background: i === 0 ? color : withAlpha(color, 0.45) }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const DonutTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="px-3.5 py-2" style={{ background: PT.card, borderRadius: 14, boxShadow: PT.popShadow, fontFamily: PT.font }}>
      <p style={{ fontSize: 12.5, fontWeight: 800, color: PT.ink }}>{p.name}</p>
      <p className="tabular-nums" style={{ fontSize: 12.5, fontWeight: 700, color: p.payload.fill }}>{money(p.value)}</p>
    </div>
  );
};

// การขายสินค้า — การ์ดเดียว แบ่งใน 3 โซน: สัดส่วน | รถขายดี | ชุดแต่งขายดี
const ProductSales = ({ range }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    let on = true;
    (async () => {
      const { data: d, error } = await supabase.rpc('dash_product_sales', { p_start: range.start, p_end: range.end });
      if (!on) return;
      if (error) { console.error('dash_product_sales:', error); setData({}); return; }
      setData(d || {});
    })();
    return () => { on = false; };
  }, [range.start, range.end]);

  const donut = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'สกู๊ตเตอร์ / จักรยาน', value: Number(data.vehicles?.total) || 0, fill: PT.periwinkle },
      { name: 'ชุดแต่ง / อุปกรณ์', value: Number(data.accessories?.total) || 0, fill: PT.mint },
      { name: 'งานสั่งทำ / อื่น ๆ', value: Number(data.other?.total) || 0, fill: PT.ghost },
    ].filter(s => s.value > 0);
  }, [data]);

  const grand = donut.reduce((s, x) => s + x.value, 0);

  if (!data) {
    return <div className="animate-pulse" style={{ background: PT.card, borderRadius: PT.radius, height: 300, boxShadow: PT.cardShadow }} />;
  }

  return (
    <div style={{ background: PT.card, borderRadius: PT.radius, boxShadow: PT.cardShadow }} className="overflow-hidden">

      {/* หัวการ์ด */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${PT.gridLine}` }}>
        <p style={{ fontSize: 14.5, fontWeight: 800, color: PT.ink }}>การขายสินค้า</p>
        <p className="tabular-nums" style={{ fontSize: 12.5, fontWeight: 700, color: PT.muted }}>
          ยอดขายรวม <span style={{ color: PT.ink, fontWeight: 800 }}>{money(grand)}</span>
        </p>
      </div>

      {grand === 0 ? (
        <p className="text-center py-14" style={{ fontSize: 13, fontWeight: 600, color: PT.faint }}>ไม่มียอดขายในช่วงนี้</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3">

          {/* โซน 1: สัดส่วน */}
          <div className="p-5">
            <ColHead color={PT.lilac} title="สัดส่วนยอดขาย" subtitle="" />
            <div className="flex items-center gap-4">
              <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donut} dataKey="value" nameKey="name"
                      innerRadius={44} outerRadius={62} paddingAngle={3} cornerRadius={5}
                      stroke="none" startAngle={90} endAngle={-270}
                    >
                      {donut.map(s => <Cell key={s.name} fill={s.fill} />)}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="tabular-nums" style={{ fontSize: 14, fontWeight: 800, color: PT.ink }}>
                    {donut.length > 0 ? `${((donut[0].value / grand) * 100).toFixed(0)}%` : ''}
                  </p>
                  <p style={{ fontSize: 9.5, fontWeight: 700, color: PT.muted }}>เป็นรถ</p>
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-2.5">
                {donut.map(s => (
                  <div key={s.name}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.fill }} />
                      <p className="flex-1 truncate" style={{ fontSize: 11.5, fontWeight: 700, color: PT.muted }}>{s.name}</p>
                      <p className="tabular-nums shrink-0" style={{ fontSize: 12, fontWeight: 800, color: PT.ink }}>
                        {((s.value / grand) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <p className="ml-3.5 tabular-nums" style={{ fontSize: 11.5, fontWeight: 700, color: s.fill }}>{money(s.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* โซน 2: รถขายดี */}
          <div className="p-5 border-t lg:border-t-0 lg:border-l" style={{ borderColor: PT.gridLine }}>
            <ColHead
              color={PT.periwinkle} title="สกู๊ตเตอร์ / จักรยานขายดี"
              subtitle={`${Number(data.vehicles?.qty) || 0} คัน · ${money(data.vehicles?.total)}`}
            />
            <TopList items={data.vehicles?.top || []} color={PT.periwinkle} unit="คัน" />
          </div>

          {/* โซน 3: ชุดแต่งขายดี */}
          <div className="p-5 border-t lg:border-t-0 lg:border-l" style={{ borderColor: PT.gridLine }}>
            <ColHead
              color={PT.mint} title="ชุดแต่งขายดี"
              subtitle={`${Number(data.accessories?.qty) || 0} ชิ้น · ${money(data.accessories?.total)}`}
            />
            <TopList items={data.accessories?.top || []} color={PT.mint} unit="ชิ้น" />
          </div>

        </div>
      )}
    </div>
  );
};

export default ProductSales;
