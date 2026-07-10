// PaintEditor — modal ให้แอดมินใส่/แก้การสั่งทำสีของ item รถในออเดอร์
// เขียนข้อมูลรูปแบบเดียวกับลิงก์ใบเสนอราคา (MomenStore /quote):
//   { scope:'frame'|'swing'|'both', twoTone, mainColor, secondColor, seatColor, bagColor }
// ราคามาจาก products.paint_config ของรุ่น (single_price / two_tone_price)
import React, { useState } from 'react';
import { X, Paintbrush } from 'lucide-react';

const SCOPES = [
  ['frame', 'เฉพาะเฟรม'],
  ['swing', 'เฉพาะสวิงอาม'],
  ['both', 'เฟรม + สวิงอาม'],
];

const ColorRow = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-3 py-2">
    <span className="text-sm font-medium text-gray-700">{label}</span>
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs text-gray-400">{value}</span>
      <input
        type="color"
        className="w-10 h-8 rounded border border-gray-200 cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  </div>
);

const stockColorsFrom = (config) =>
  Array.isArray(config?.stock_colors) && config.stock_colors.length
    ? config.stock_colors
    : [{ name: config?.stock_color_name || 'ดำ', hex: config?.stock_color || '#000000' }];

export default function PaintEditor({ productName, config, initialPaint, initialStock, onSave, onClose }) {
  const stockColors = stockColorsFrom(config);
  const [paintOn, setPaintOn] = useState(!!initialPaint);
  const [stockColor, setStockColor] = useState(initialStock || stockColors[0]);
  const [scope, setScope] = useState(initialPaint?.scope || 'both');
  const [twoTone, setTwoTone] = useState(initialPaint?.twoTone === true);
  const [mainColor, setMainColor] = useState(initialPaint?.mainColor || '#c81e1e');
  const [secondColor, setSecondColor] = useState(initialPaint?.secondColor || '#1e3a8a');
  const [seatOn, setSeatOn] = useState(!!initialPaint?.seatColor);
  const [seatColor, setSeatColor] = useState(initialPaint?.seatColor || '#4a2c17');
  const [bagOn, setBagOn] = useState(!!initialPaint?.bagColor);
  const [bagColor, setBagColor] = useState(initialPaint?.bagColor || '#4a2c17');

  const singlePrice = Number(config?.single_price ?? 4900);
  const twoTonePrice = Number(config?.two_tone_price ?? 6900);
  const isTwoTone = scope === 'both' && twoTone;
  const fee = isTwoTone ? twoTonePrice : singlePrice;

  const handleSave = () => {
    const paint = paintOn
      ? {
          scope,
          twoTone: isTwoTone,
          mainColor,
          secondColor: isTwoTone ? secondColor : null,
          seatColor: seatOn ? seatColor : null,
          bagColor: bagOn ? bagColor : null,
        }
      : null;
    onSave({
      paint,
      // สีโรงงานไม่จำเป็นเฉพาะกรณีทำสีทั้งเฟรม+สวิงอาม
      stockColor: paint && paint.scope === 'both' ? null : stockColor,
    });
  };

  const pill = (active) =>
    `px-3 py-1.5 rounded-full text-sm border transition-colors ${
      active ? 'bg-amber-500 border-amber-500 text-white font-bold' : 'bg-white border-gray-200 text-gray-600 hover:border-amber-300'
    }`;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Paintbrush size={18} className="text-amber-500" /> สั่งทำสี — {productName}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* สีโรงงานของตัวรถ (ยังจำเป็นแม้ทำสีบางส่วน — ส่วนที่ไม่ได้ทำยังเป็นสีโรงงาน) */}
          {!(paintOn && scope === 'both') && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">สีโรงงานของรถ</p>
              <div className="flex flex-wrap gap-2">
                {stockColors.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setStockColor(c)}
                    className={pill(stockColor?.name === c.name && stockColor?.hex === c.hex)}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border border-gray-300 inline-block" style={{ background: c.hex }} />
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">การทำสี</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPaintOn(false)} className={pill(!paintOn)}>
                สีเดิมอย่างเดียว (ฟรี)
              </button>
              <button type="button" onClick={() => setPaintOn(true)} className={pill(paintOn)}>
                สั่งทำสี
              </button>
            </div>
          </div>

          {paintOn && (<>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">ส่วนที่ทำสี</p>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map(([v, l]) => (
                <button key={v} type="button" onClick={() => setScope(v)} className={pill(scope === v)}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {scope === 'both' && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">รูปแบบสี</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setTwoTone(false)} className={pill(!twoTone)}>
                  สีเดียวกัน · ฿{singlePrice.toLocaleString()}
                </button>
                <button type="button" onClick={() => setTwoTone(true)} className={pill(twoTone)}>
                  Two-Tone · ฿{twoTonePrice.toLocaleString()}
                </button>
              </div>
            </div>
          )}

          <div className="border border-gray-100 rounded-xl px-3 divide-y divide-gray-50">
            <ColorRow
              label={scope === 'both' ? (isTwoTone ? 'สีเฟรม' : 'สีหลัก (เฟรม+สวิงอาม)') : scope === 'frame' ? 'สีเฟรม' : 'สีสวิงอาม'}
              value={mainColor}
              onChange={setMainColor}
            />
            {isTwoTone && <ColorRow label="สีสวิงอาม" value={secondColor} onChange={setSecondColor} />}
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">เบาะ / กระเป๋า (รวมในราคา)</p>
            <div className="flex flex-wrap gap-2 mb-1">
              <button type="button" onClick={() => setSeatOn(!seatOn)} className={pill(seatOn)}>เปลี่ยนสีเบาะ</button>
              <button type="button" onClick={() => setBagOn(!bagOn)} className={pill(bagOn)}>เปลี่ยนสีกระเป๋า</button>
            </div>
            {(seatOn || bagOn) && (
              <div className="border border-gray-100 rounded-xl px-3 divide-y divide-gray-50">
                {seatOn && <ColorRow label="สีเบาะ" value={seatColor} onChange={setSeatColor} />}
                {bagOn && <ColorRow label="สีกระเป๋า" value={bagColor} onChange={setBagColor} />}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <span className="text-sm font-bold text-amber-900">ค่าทำสี{isTwoTone ? ' (Two-Tone)' : ' (สีเดียว)'}</span>
            <span className="font-bold text-amber-700">฿{fee.toLocaleString()}</span>
          </div>
          </>)}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl">
              ปิด
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors"
            >
              บันทึกสีรถ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
