import React, { useState, useRef, useEffect } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import { PT, thShortDate } from './iosTokens';

// ตัวเลือกช่วงเวลา — ชิปพาสเทลกลมมน
// value = { preset: 'this_month'|'3m'|'6m'|'this_year'|'custom', customStart?, customEnd? }
const PRESETS = [
  { id: 'this_month', label: 'เดือนนี้' },
  { id: '3m', label: '3 เดือน' },
  { id: '6m', label: '6 เดือน' },
  { id: 'this_year', label: 'ปีนี้' },
];

const fmt = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// แปลงค่าที่เลือก → ช่วงวันที่จริง + ความละเอียดกราฟ (day/month) + ป้ายบอกช่วง
export const resolveRange = (value) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start, end, group;

  switch (value?.preset) {
    case '3m':
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1); end = today; group = 'day';
      break;
    case '6m':
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1); end = today; group = 'month';
      break;
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1); end = today; group = 'month';
      break;
    case 'custom': {
      start = value.customStart ? new Date(value.customStart + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1);
      end = value.customEnd ? new Date(value.customEnd + 'T00:00:00') : today;
      if (end < start) [start, end] = [end, start];
      group = (end - start) / 86400000 <= 62 ? 'day' : 'month';
      break;
    }
    default: // this_month
      start = new Date(now.getFullYear(), now.getMonth(), 1); end = today; group = 'day';
  }
  return { start: fmt(start), end: fmt(end), group, label: `${thShortDate(start)} – ${thShortDate(end)}` };
};

const chipBase = 'transition-all duration-200 active:scale-95 select-none';

const PeriodPicker = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const isCustom = value?.preset === 'custom';
  const range = resolveRange(value);

  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map(p => {
          const active = !isCustom && value?.preset === p.id;
          return (
            <button
              key={p.id}
              onClick={() => { setOpen(false); onChange({ preset: p.id }); }}
              className={`${chipBase} rounded-full px-4 py-2`}
              style={{
                fontSize: 13, fontWeight: 700,
                background: active ? PT.ink : PT.card,
                color: active ? '#FFFFFF' : PT.muted,
                boxShadow: active ? '0 6px 16px rgba(50,45,77,0.25)' : PT.cardShadow,
              }}
            >
              {p.label}
            </button>
          );
        })}
        <button
          onClick={() => {
            onChange({ preset: 'custom', customStart: value?.customStart || range.start, customEnd: value?.customEnd || range.end });
            setOpen(true);
          }}
          className={`${chipBase} rounded-full px-4 py-2 flex items-center gap-1.5`}
          style={{
            fontSize: 13, fontWeight: 700,
            background: isCustom ? PT.grad : PT.card,
            color: isCustom ? '#FFFFFF' : PT.muted,
            boxShadow: isCustom ? '0 6px 16px rgba(124,110,220,0.35)' : PT.cardShadow,
          }}
        >
          <CalendarDays size={14} strokeWidth={2.4} />
          {isCustom ? range.label : 'กำหนดเอง'}
        </button>
      </div>

      {/* Popover เลือกช่วงเอง */}
      {open && isCustom && (
        <div
          className="absolute right-0 top-full mt-2.5 z-50 w-80 p-5"
          style={{ background: PT.card, borderRadius: 20, boxShadow: PT.popShadow, fontFamily: PT.font }}
        >
          <p style={{ fontSize: 14, fontWeight: 800, color: PT.ink }}>เลือกช่วงเวลาเอง</p>
          <div className="mt-3 space-y-2.5">
            {[['เริ่ม', 'customStart', { max: value?.customEnd }], ['ถึง', 'customEnd', { min: value?.customStart }]].map(([label, key, lim]) => (
              <div key={key} className="flex items-center justify-between rounded-2xl px-4 py-2.5" style={{ background: PT.bg }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: PT.muted }}>{label}</span>
                <input
                  type="date"
                  value={value?.[key] || ''}
                  {...lim}
                  onChange={e => onChange({ ...value, [key]: e.target.value })}
                  className="outline-none bg-transparent"
                  style={{ fontSize: 14, fontWeight: 700, color: PT.ink, border: 'none' }}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => setOpen(false)}
            className={`${chipBase} w-full mt-4 rounded-2xl py-3 flex items-center justify-center gap-1.5`}
            style={{ background: PT.grad, color: '#FFF', fontSize: 14, fontWeight: 800, boxShadow: '0 8px 20px rgba(124,110,220,0.35)' }}
          >
            <Check size={16} strokeWidth={3} /> ใช้ช่วงนี้
          </button>
        </div>
      )}
    </div>
  );
};

export default PeriodPicker;
