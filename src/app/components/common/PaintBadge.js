// PaintBadge — แสดงรายละเอียดสั่งทำสีของ item (order_items.customization.paint)
// รูปแบบข้อมูลเดียวกับที่ลิงก์ใบเสนอราคา (MomenStore /quote) เขียน:
//   { scope:'frame'|'swing'|'both', twoTone, mainColor, secondColor, seatColor, bagColor }
// ใช้ใน OrderDetail, BillPreview (บิลเต็ม/ใบงาน S1/บิลสรุปลูกค้า) และ PaintEditor
import React from 'react';

/** แปลง paint → [[label, hex], ...] สำหรับแสดงเป็นจุดสี */
export function paintParts(paint) {
  if (!paint) return [];
  const parts = [];
  if (paint.scope === 'frame') parts.push(['เฟรม', paint.mainColor]);
  else if (paint.scope === 'swing') parts.push(['สวิงอาม', paint.mainColor]);
  else if (paint.twoTone) {
    parts.push(['เฟรม', paint.mainColor]);
    parts.push(['สวิงอาม', paint.secondColor]);
  } else parts.push(['เฟรม+สวิงอาม', paint.mainColor]);
  // เบาะ + กระเป๋า = ชุดเดียวกัน (สีเดียว หรือ Two-Tone ทั้งชุด)
  if (paint.seatBag) {
    parts.push(['เบาะ+กระเป๋า', paint.seatBag.mainColor]);
    if (paint.seatBag.twoTone && paint.seatBag.secondColor)
      parts.push(['เบาะ+กระเป๋า (สี 2)', paint.seatBag.secondColor]);
  }
  // รูปแบบเก่า (ก่อนรวมเบาะ/กระเป๋าเป็นชุดเดียว)
  if (paint.seatColor) parts.push(['เบาะ', paint.seatColor]);
  if (paint.bagColor) parts.push(['กระเป๋า', paint.bagColor]);
  return parts;
}

/** รวมสีโรงงานที่เลือก (customization.stock_color) + สีสั่งทำ → [[label, hex], ...] */
export function customizationParts(customization) {
  const parts = [];
  if (customization?.stock_color?.hex) {
    parts.push([`สีเดิม ${customization.stock_color.name || ''}`.trim(), customization.stock_color.hex]);
  }
  return [...parts, ...paintParts(customization?.paint)];
}

/** สรุปเป็นข้อความบรรทัดเดียว เช่น "ทำสี: เฟรม #c81e1e · เบาะ #4a2c17" */
export function paintSummaryText(paint) {
  const parts = paintParts(paint);
  if (!parts.length) return '';
  return 'ทำสี: ' + parts.map(([label, hex]) => `${label} ${hex}`).join(' · ');
}

/** สรุป customization ทั้งก้อน (สีเดิม + สีสั่งทำ) เป็นข้อความ ใช้ในใบงานประกอบ */
export function customizationSummaryText(customization) {
  const parts = customizationParts(customization);
  if (!parts.length) return '';
  return 'สี: ' + parts.map(([label, hex]) => `${label} ${hex}`).join(' · ');
}

export default function PaintBadge({ paint, customization, size = 'sm' }) {
  const parts = customization ? customizationParts(customization) : paintParts(paint);
  if (!parts.length) return null;
  const text = size === 'lg' ? 'text-xs' : 'text-[10px]';
  const dot = size === 'lg' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5';
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
      {parts.map(([label, hex]) => (
        <span
          key={label}
          className={`inline-flex items-center gap-1 ${text} bg-amber-50 border border-amber-200 text-amber-900 px-1.5 py-0.5 rounded`}
        >
          <span
            className={`${dot} rounded-full border border-gray-300 inline-block shrink-0`}
            style={{ background: hex }}
          />
          {label}
          <span className="font-mono text-gray-500">{hex}</span>
        </span>
      ))}
    </span>
  );
}
