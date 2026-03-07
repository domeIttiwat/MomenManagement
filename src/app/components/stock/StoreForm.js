'use client';
import React, { useState } from 'react';
import { ArrowLeft, Save, Loader2, Upload, X, Eye, ImagePlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';

/* ---- Inline ImageUploader adapted for stores bucket ---- */
const StoreImageUploader = ({ images = [], onChange }) => {
  const [previewImage, setPreviewImage] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    onChange([...images, { url: previewUrl, file }]);
    e.target.value = '';
  };

  const removeImage = (index) => onChange(images.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} className="max-w-full max-h-full rounded-lg shadow-2xl" />
          <button className="absolute top-4 right-4 text-white hover:text-red-500"><X size={32} /></button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        {images.map((imgObj, idx) => (
          <div key={idx} className="relative aspect-square rounded-2xl border border-gray-200 overflow-hidden group shadow-sm bg-gray-50">
            <img src={imgObj.url} alt={`store-${idx}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
              <button type="button" onClick={() => setPreviewImage(imgObj.url)} className="bg-white/20 hover:bg-white text-white hover:text-black p-2 rounded-full transition-all"><Eye size={16} /></button>
              <button type="button" onClick={() => removeImage(idx)} className="bg-white/20 hover:bg-red-500 text-white p-2 rounded-full transition-all"><X size={16} /></button>
            </div>
            {idx === 0 && <div className="absolute bottom-0 w-full bg-teal-600/90 text-white text-[10px] text-center py-1 font-bold">COVER</div>}
          </div>
        ))}
        <label className="relative aspect-square rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-teal-500 hover:bg-teal-50/30 transition-all group">
          <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          <div className="p-3 bg-white rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform"><ImagePlus className="text-gray-400 group-hover:text-teal-500" size={20} /></div>
          <span className="text-xs font-semibold text-gray-500 group-hover:text-teal-600">เพิ่มรูป</span>
        </label>
      </div>
      <p className="text-xs text-gray-400">* รูปจะถูกอัปโหลดเมื่อกด "บันทึก"</p>
    </div>
  );
};

/* ---- Main Form ---- */
const StoreForm = ({ initialData, onCancel, onSuccess }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    location_detail: initialData?.location_detail || '',
    is_active: initialData?.is_active !== undefined ? initialData.is_active : true,
    images: (initialData?.images || []).map(img =>
      typeof img === 'string' ? { url: img, file: null } : img
    ),
  });

  const inputClass = "w-full px-4 py-3 bg-gray-50 border border-transparent focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 rounded-xl transition-all outline-none text-gray-700 font-medium";
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert('กรุณาระบุชื่อคลัง');
    setLoading(true);
    try {
      // Upload images
      const uploadedImages = await Promise.all(formData.images.map(async (img) => {
        if (img.file) {
          const fileName = `store-${Date.now()}-${Math.random()}`;
          await supabase.storage.from('stores').upload(fileName, img.file);
          const { data } = supabase.storage.from('stores').getPublicUrl(fileName);
          return { url: data.publicUrl };
        }
        return { url: img.url };
      }));

      const payload = {
        name: formData.name.trim(),
        description: formData.description || null,
        location_detail: formData.location_detail || null,
        is_active: formData.is_active,
        images: uploadedImages,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        await supabase.from('stores').update(payload).eq('id', initialData.id);
      } else {
        await supabase.from('stores').insert([{ ...payload, created_by: profile?.id }]);
      }

      onSuccess();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto pb-20 animate-in slide-in-from-bottom-4 fade-in duration-500">
      {/* Sticky header */}
      <div className="flex justify-between items-center bg-white/80 backdrop-blur-md p-4 rounded-2xl sticky top-2 z-20 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{initialData ? 'แก้ไขคลัง' : 'เพิ่มคลังใหม่'}</h1>
        </div>
        <button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} บันทึก
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-bold text-gray-800 text-lg border-b border-gray-50 pb-3">ข้อมูลคลังสินค้า</h3>
          <div>
            <label className={labelClass}>ชื่อคลัง <span className="text-red-400">*</span></label>
            <input required className={inputClass} placeholder="เช่น คลังหลัก, ชั้นวาง A" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>คำอธิบาย</label>
            <textarea className={inputClass} rows={3} placeholder="รายละเอียดเพิ่มเติม..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>ที่ตั้ง / ตำแหน่งจริง</label>
            <input className={inputClass} placeholder="เช่น ชั้นวาง A-3, ตู้ B หมายเลข 5" value={formData.location_detail} onChange={e => setFormData({ ...formData, location_detail: e.target.value })} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`relative w-11 h-6 rounded-full transition-colors ${formData.is_active ? 'bg-teal-500' : 'bg-gray-200'}`} onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-medium text-gray-700">เปิดใช้งานคลังนี้</span>
          </label>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">รูปภาพคลัง</h3>
          <StoreImageUploader images={formData.images} onChange={imgs => setFormData({ ...formData, images: imgs })} />
        </div>
      </div>
    </form>
  );
};

export default StoreForm;
