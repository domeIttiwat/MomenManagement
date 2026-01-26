import React, { useState } from 'react';
import { Upload, X, Star, ImagePlus, Eye } from 'lucide-react';

const ImageUploader = ({ images = [], onChange }) => {
  // images ตอนนี้จะเป็น Array of Objects: { url: string, file: File | null }
  const [previewImage, setPreviewImage] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // สร้าง URL ชั่วคราวสำหรับแสดงผล (ยังไม่อัปโหลด)
    const previewUrl = URL.createObjectURL(file);
    
    // ส่งข้อมูลกลับไปที่ Parent (เก็บทั้ง URL ชั่วคราว และไฟล์จริง)
    onChange([...images, { url: previewUrl, file: file }]);
    
    // Reset input เพื่อให้เลือกไฟล์เดิมซ้ำได้ถ้าต้องการ
    e.target.value = '';
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
  };

  const setThumbnail = (index) => {
    const selected = images[index];
    const others = images.filter((_, i) => i !== index);
    onChange([selected, ...others]);
  };

  return (
    <div className="space-y-4">
      {/* Lightbox Preview */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} className="max-w-full max-h-full rounded-lg shadow-2xl" />
          <button className="absolute top-4 right-4 text-white hover:text-red-500"><X size={32}/></button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {images.map((imgObj, idx) => (
          <div key={idx} className="relative aspect-square rounded-2xl border border-gray-200 overflow-hidden group shadow-sm bg-gray-50">
            <img src={imgObj.url} alt={`product-${idx}`} className="w-full h-full object-cover" />
            
            {/* Overlay Actions */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col items-center justify-center gap-3 backdrop-blur-[1px]">
               <button type="button" onClick={() => setPreviewImage(imgObj.url)} className="bg-white/20 hover:bg-white text-white hover:text-black p-2 rounded-full backdrop-blur-md transition-all transform hover:scale-110" title="ดูรูปขยาย"><Eye size={20}/></button>
               <div className="flex gap-2">
                 <button type="button" onClick={() => setThumbnail(idx)} className={`p-2 rounded-full backdrop-blur-md transition-all transform hover:scale-110 ${idx === 0 ? 'bg-yellow-400 text-white' : 'bg-white/20 text-white hover:bg-yellow-400'}`} title="ตั้งเป็นรูปหลัก"><Star size={18} fill={idx === 0 ? "currentColor" : "none"} /></button>
                 <button type="button" onClick={() => removeImage(idx)} className="p-2 bg-white/20 text-white hover:bg-red-500 rounded-full backdrop-blur-md transition-all transform hover:scale-110" title="ลบรูป"><X size={18} /></button>
               </div>
            </div>
            {idx === 0 && <div className="absolute bottom-0 w-full bg-indigo-600/90 text-white text-[10px] text-center py-1 font-bold tracking-wider">COVER</div>}
          </div>
        ))}

        <label className={`relative aspect-square rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition-all group`}>
          <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          <div className="p-4 bg-white rounded-full mb-3 shadow-sm group-hover:scale-110 transition-transform"><ImagePlus className="text-gray-400 group-hover:text-indigo-500" size={24} /></div>
          <span className="text-sm font-semibold text-gray-500 group-hover:text-indigo-600">เพิ่มรูปภาพ</span>
        </label>
      </div>
      <p className="text-xs text-gray-400 pl-1">* รูปจะถูกอัปโหลดเมื่อกดปุ่ม "บันทึกข้อมูล"</p>
    </div>
  );
};

export default ImageUploader;