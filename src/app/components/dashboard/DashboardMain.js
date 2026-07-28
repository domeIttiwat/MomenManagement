import React, { useState } from 'react';
import { ShoppingBag, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PT, THAI_MONTHS, THAI_DAYS } from './iosTokens';
import PeriodPicker, { resolveRange } from './PeriodPicker';
import IncomeChart from './IncomeChart';
import ActivityBoard from './ActivityBoard';
import ProductSales from './ProductSales';

// re-export เผื่อไฟล์อื่นอ้างธีมจากที่นี่
export { IOS, PT } from './iosTokens';

// แถบหัวข้อของ Dashboard — เพิ่มหัวข้อใหม่ที่นี่ที่เดียว
const SECTIONS = [
  { id: 'sales_service', label: 'การขายและงานซ่อมบำรุง', icon: ShoppingBag },
];

// Dashboard — ธีมพาสเทลโมเดิร์น (ธีม iOS เดิมเก็บไว้ใน iosTokens.js สลับกลับได้)
const DashboardMain = () => {
  const auth = useAuth();
  const role = auth?.role;
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [period, setPeriod] = useState({ preset: 'this_month' });

  const now = new Date();
  const dateLabel = `วัน${THAI_DAYS[now.getDay()]}ที่ ${now.getDate()} ${THAI_MONTHS[now.getMonth()]} ${now.getFullYear() + 543}`;
  const range = resolveRange(period);

  return (
    <div
      className="-m-4 md:-m-8 min-h-full"
      style={{ fontFamily: PT.font, background: `linear-gradient(180deg, #F9FAFD 0%, ${PT.bg} 30%)` }}
    >
      <div className="max-w-[1500px] mx-auto px-4 md:px-8 pt-6 md:pt-8 pb-24">

        {/* ===== Header ===== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="flex items-center justify-center w-8 h-8"
                style={{ background: PT.grad, borderRadius: 12, boxShadow: '0 6px 16px rgba(124,110,220,0.35)' }}
              >
                <Sparkles size={15} color="#fff" strokeWidth={2.4} />
              </span>
              <p style={{ fontSize: 13, fontWeight: 700, color: PT.muted }}>{dateLabel}</p>
            </div>
            <h1 className="mt-2" style={{ fontSize: 30, fontWeight: 800, color: PT.ink, letterSpacing: -0.3, lineHeight: 1.15 }}>
              ภาพรวมธุรกิจ
            </h1>
          </div>

          {role && (
            <span
              className="self-start md:self-center rounded-full px-4 py-2"
              style={{ fontSize: 13, fontWeight: 700, color: PT.lilac, background: PT.lilacTint }}
            >
              {role.name}
            </span>
          )}
        </div>

        {/* ===== แถบหัวข้อ (ซ้าย) + ช่วงเวลา (ขวา) ===== */}
        <div className="mt-6 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map(s => {
              const active = activeSection === s.id;
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className="flex items-center gap-2 rounded-full px-5 py-2.5 transition-all duration-200 active:scale-95"
                  style={{
                    fontSize: 13.5, fontWeight: 800,
                    background: active ? PT.grad : PT.card,
                    color: active ? '#FFFFFF' : PT.muted,
                    boxShadow: active ? '0 8px 20px rgba(124,110,220,0.35)' : PT.cardShadow,
                  }}
                >
                  <Icon size={15} strokeWidth={2.4} />
                  {s.label}
                </button>
              );
            })}
          </div>

          <PeriodPicker value={period} onChange={setPeriod} />
        </div>

        {/* ป้ายบอกช่วงที่กำลังดู */}
        <p className="mt-3 px-1" style={{ fontSize: 12.5, fontWeight: 600, color: PT.faint }}>
          กำลังแสดงข้อมูล {range.label}
        </p>

        {/* ===== เนื้อหาตามหัวข้อ ===== */}
        {activeSection === 'sales_service' && (
          <div className="mt-4 space-y-4">
            <IncomeChart range={range} />
            <ActivityBoard range={range} />
            <ProductSales range={range} />
          </div>
        )}

      </div>
    </div>
  );
};

export default DashboardMain;
