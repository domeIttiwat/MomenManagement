'use client';
import React, { useState } from 'react';
import { Tag, Plus, X, Check, Trash2 } from 'lucide-react';

// ระบบ Tag ส่วนตัว (แทน Focus เดิม) — ปุ่ม Tag + ป๊อปอัพเลือก/สร้าง และ chip แสดงผล
// ใช้ร่วมกันทั้งฝั่งคำสั่งซื้อและงานซ่อม

export const TAG_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b', '#111827'];

// chip แสดง tag ที่ติดอยู่กับงานนี้
export const TagChips = ({ tags = [], itemTagIds = [] }) => {
  const mine = tags.filter((t) => itemTagIds.includes(t.id));
  if (!mine.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {mine.map((t) => (
        <span key={t.id} className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border leading-tight"
          style={{ color: t.color, backgroundColor: `${t.color}1a`, borderColor: `${t.color}55` }}>
          {t.name}
        </span>
      ))}
    </span>
  );
};

// สีของ tag ตัวแรกที่ติดอยู่ — ใช้ทำขอบ/แถบสีของแถวและการ์ด
export const firstTagColor = (tags = [], itemTagIds = []) =>
  tags.find((t) => itemTagIds.includes(t.id))?.color || null;

const TagControl = ({ tags = [], itemTagIds = [], onToggle, onCreate, onDeleteTag = null, align = 'right', headerLabel = 'Tag ของฉัน — คนอื่นไม่เห็น', buttonTitle = 'Tag ส่วนตัว (คนอื่นไม่เห็น)' }) => {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(TAG_COLORS[7]);
  const activeColor = firstTagColor(tags, itemTagIds);

  const submitCreate = async () => {
    if (!name.trim()) return;
    await onCreate(name.trim(), color); // สร้างแล้วติดกับงานนี้เลย
    setName(''); setCreating(false);
  };

  return (
    <span className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen((v) => !v)} title={buttonTitle}
        className={`p-1 rounded-lg transition-colors ${activeColor ? 'hover:bg-gray-100' : 'text-gray-300 hover:text-indigo-500 hover:bg-gray-100'}`}
        style={activeColor ? { color: activeColor } : undefined}>
        <Tag size={15} className={activeColor ? 'fill-current' : ''} />
      </button>

      {open && (
        <>
          <span className="fixed inset-0 z-[80] block" onClick={() => setOpen(false)} />
          <span className={`absolute z-[90] top-7 ${align === 'right' ? 'right-0' : 'left-0'} w-60 bg-white border border-gray-200 rounded-2xl shadow-xl p-2 block text-left cursor-default`}>
            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide px-2 pt-1 pb-1.5">{headerLabel}</span>

            <span className="block max-h-52 overflow-y-auto">
              {tags.length === 0 && !creating && (
                <span className="block text-xs text-gray-400 px-2 py-2">ยังไม่มี Tag — สร้างอันแรกได้เลย</span>
              )}
              {tags.map((t) => {
                const active = itemTagIds.includes(t.id);
                return (
                  <span key={t.id} className="flex items-center gap-1 group/tagrow">
                    <button type="button" onClick={() => onToggle(t.id)}
                      className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left hover:bg-gray-50 min-w-0">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      <span className={`flex-1 truncate ${active ? 'font-bold' : 'text-gray-700'}`} style={active ? { color: t.color } : undefined}>{t.name}</span>
                      {active && <Check size={14} className="shrink-0" style={{ color: t.color }} />}
                    </button>
                    {onDeleteTag && (
                      <button type="button" title="ลบ Tag นี้"
                        onClick={() => { if (confirm(`ลบ Tag "${t.name}"? (จะหลุดจากทุกงานที่ติดไว้)`)) onDeleteTag(t.id); }}
                        className="p-1 text-gray-200 hover:text-red-500 opacity-0 group-hover/tagrow:opacity-100 transition-opacity shrink-0">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </span>
                );
              })}
            </span>

            {creating ? (
              <span className="block border-t border-gray-100 mt-1 pt-2 px-1 space-y-2">
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitCreate(); } }}
                  placeholder="ชื่อ Tag..." className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-400" />
                <span className="flex flex-wrap gap-1.5 px-0.5 block">
                  {TAG_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setColor(c)}
                      className={`w-5 h-5 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </span>
                <span className="flex gap-1.5">
                  <button type="button" onClick={submitCreate} disabled={!name.trim()}
                    className="flex-1 bg-gray-900 hover:bg-black text-white text-xs font-bold py-2 rounded-lg disabled:opacity-40">
                    สร้างแล้วติดให้เลย
                  </button>
                  <button type="button" onClick={() => setCreating(false)} className="px-2 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={14} /></button>
                </span>
              </span>
            ) : (
              <button type="button" onClick={() => setCreating(true)}
                className="w-full flex items-center gap-1.5 px-2 py-2 mt-1 border-t border-gray-100 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg">
                <Plus size={13} /> สร้าง Tag ใหม่
              </button>
            )}
          </span>
        </>
      )}
    </span>
  );
};

export default TagControl;
