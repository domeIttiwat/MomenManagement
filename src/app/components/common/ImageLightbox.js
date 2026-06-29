'use client';
import React from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

// ===================================================================
// ImageLightbox — วิธี "เดียว" ที่อนุญาตให้แสดงรูปแบบเต็มจอในระบบนี้
// กฎ (GOTCHA #18 / ADR): รูปทุกที่ต้องเปิดเป็น popup/lightbox ในหน้าเดิม
//   ห้ามใช้ <a target="_blank"> หรือเปิดแท็บใหม่ ให้ import ตัวนี้เสมอ
// รองรับหลายรูป (ลูกศรซ้าย-ขวา + แถบ thumbnail)
// props: images: (string | {url})[], index: number|null, onClose(), onIndex(i)
// ===================================================================
const ImageLightbox = ({ images, index, onClose, onIndex }) => {
  const safeImages = images || [];
  if (index === null || index === undefined || safeImages.length === 0) return null;
  const imageUrl = (img) => (typeof img === 'string' ? img : img?.url);
  const current = imageUrl(safeImages[index]);
  const showPrev = () => onIndex((index - 1 + safeImages.length) % safeImages.length);
  const showNext = () => onIndex((index + 1) % safeImages.length);
  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"><X size={22} /></button>
      {safeImages.length > 1 && <button type="button" onClick={(e) => { e.stopPropagation(); showPrev(); }} className="absolute left-4 md:left-8 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"><ChevronLeft size={28} /></button>}
      <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
        <img src={current} alt="" className="max-h-[78vh] w-full object-contain rounded-2xl" />
        {safeImages.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
            {safeImages.map((img, idx) => (
              <button key={idx} type="button" onClick={() => onIndex(idx)} className={`w-14 h-14 rounded-xl overflow-hidden border ${idx === index ? 'border-white ring-2 ring-white/40' : 'border-white/20 opacity-60 hover:opacity-100'}`}>
                <img src={imageUrl(img)} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
      {safeImages.length > 1 && <button type="button" onClick={(e) => { e.stopPropagation(); showNext(); }} className="absolute right-4 md:right-8 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"><ChevronRight size={28} /></button>}
    </div>
  );
};

export default ImageLightbox;
