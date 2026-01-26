import React, { useState } from 'react';
import { Upload, X, Star, ImagePlus, Eye } from 'lucide-react';

const ImageUploader = ({ images = [], onChange }) => {
  // images structure: Array of { url: string, file: File|null }
  const [previewImage, setPreviewImage] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // สร้าง URL ชั่วคราว (ยังไม่อัปขึ้น Server)
    const previewUrl = URL.createObjectURL(file);
    onChange([...images, { url: previewUrl, file: file }]);
    
    e.target.value = ''; // Reset input
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
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} className="max-w-full max-h-full rounded-lg shadow-2xl" />
          <button className="absolute top-4 right-4 text-white hover:text-red-500 bg-black/50 rounded-full p-2"><X size={24}/></button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {images.map((imgObj, idx) => (
          <div key={idx} className="relative aspect-square rounded-xl border border-gray-200 overflow-hidden group bg-gray-50 shadow-sm">
            <img src={imgObj.url} alt={`preview-${idx}`} className="w-full h-full object-cover" />
            
            {/* Overlay Actions */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 backdrop-blur-[1px]">
               <button type="button" onClick={() => setPreviewImage(imgObj.url)} className="bg-white/20 hover:bg-white text-white hover:text-black p-2 rounded-full transition-all" title="ดูรูปใหญ่"><Eye size={16}/></button>
               <div className="flex gap-2">
                 <button type="button" onClick={() => setThumbnail(idx)} className={`p-1.5 rounded-full transition-all ${idx === 0 ? 'bg-yellow-400 text-white' : 'bg-white/20 text-white hover:bg-yellow-400'}`}><Star size={14}/></button>
                 <button type="button" onClick={() => removeImage(idx)} className="p-1.5 bg-white/20 text-white hover:bg-red-500 rounded-full transition-all"><X size={14}/></button>
               </div>
            </div>
            {idx === 0 && <div className="absolute bottom-0 w-full bg-indigo-600/90 text-white text-[10px] text-center py-0.5 font-bold">PROFILE</div>}
          </div>
        ))}

        <label className="relative aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition-all group">
          <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          <div className="p-3 bg-white rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform"><ImagePlus className="text-gray-400 group-hover:text-indigo-500" size={20} /></div>
          <span className="text-[10px] font-medium text-gray-500 group-hover:text-indigo-600">เพิ่มรูป</span>
        </label>
      </div>
      <p className="text-xs text-gray-400 text-center">* รูปจะถูกบันทึกเมื่อกดปุ่ม "บันทึก"</p>
    </div>
  );
};
export default ImageUploader;