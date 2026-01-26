import React, { useState } from 'react';
import { Upload, X, Eye, ImagePlus, Loader2 } from 'lucide-react';

const ImageUploader = ({ images = [], onChange }) => {
  const [previewImage, setPreviewImage] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    onChange([...images, { url: previewUrl, file: file }]);
    e.target.value = ''; 
  };

  const removeImage = (index) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain animate-in zoom-in-95" />
          <button className="absolute top-4 right-4 text-white hover:text-red-500 bg-white/10 rounded-full p-2"><X size={24}/></button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {images.map((imgObj, idx) => (
          <div key={idx} className="relative aspect-square rounded-xl border border-gray-200 overflow-hidden group bg-gray-50 shadow-sm">
            <img src={imgObj.url} alt={`preview-${idx}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 backdrop-blur-[1px]">
               <button type="button" onClick={() => setPreviewImage(imgObj.url)} className="bg-white/20 hover:bg-white text-white hover:text-black p-2 rounded-full transition-all"><Eye size={16}/></button>
               <button type="button" onClick={() => removeImage(idx)} className="p-1.5 bg-white/20 text-white hover:bg-red-500 rounded-full transition-all"><X size={14}/></button>
            </div>
          </div>
        ))}

        <label className="relative aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-pink-500 hover:bg-pink-50/30 transition-all group">
          <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          <div className="p-3 bg-white rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform"><ImagePlus className="text-gray-400 group-hover:text-pink-500" size={20} /></div>
          <span className="text-[10px] font-medium text-gray-500 group-hover:text-pink-600">เพิ่มรูป</span>
        </label>
      </div>
    </div>
  );
};
export default ImageUploader;