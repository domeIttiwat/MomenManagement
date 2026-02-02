import React, { useState } from 'react';
import { ArrowLeft, Save, Loader2, User, Phone, Shield, Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ImageUploader from '../customers/ImageUploader';

const UserForm = ({ onCancel, onSuccess, initialData, roles }) => {
  const [loading, setLoading] = useState(false);
  
  // FIX: ใช้ || '' เพื่อป้องกันค่า null
  const [formData, setFormData] = useState(initialData ? {
    ...initialData,
    first_name: initialData.first_name || '',
    last_name: initialData.last_name || '',
    nickname: initialData.nickname || '',
    phone: initialData.phone || '',
    role_id: initialData.role_id || '',
    status: initialData.status || 'active',
    images: initialData.avatar_url ? [{ url: initialData.avatar_url, file: null }] : []
  } : {
    first_name: '', last_name: '', nickname: '', phone: '',
    role_id: '', status: 'active', images: []
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Upload Image (If changed)
      let avatarUrl = initialData?.avatar_url || null;
      if (formData.images.length > 0) {
        const imgObj = formData.images[0];
        // Only upload if it's a new file
        if (imgObj.file) {
          const fileName = `avatar-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, imgObj.file);
          if (uploadError) throw new Error('Upload Avatar Failed: ' + uploadError.message);
          
          const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
          avatarUrl = data.publicUrl;
        } else {
            // Keep existing URL if not changed
            avatarUrl = imgObj.url;
        }
      } else {
          // If images array is empty, it means user removed the photo
          avatarUrl = null;
      }

      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        nickname: formData.nickname,
        phone: formData.phone,
        role_id: formData.role_id ? parseInt(formData.role_id) : null,
        status: formData.status,
        avatar_url: avatarUrl
      };

      if (initialData?.id) {
        await supabase.from('profiles').update(payload).eq('id', initialData.id);
      } else {
        alert('การสร้าง User ใหม่ควรใช้เมนูเชิญคน (Invite) หรือ เพิ่มทีมงาน');
        setLoading(false);
        return;
      }
      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all outline-none text-gray-700 placeholder:text-gray-400";
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto pb-20 animate-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center bg-white/80 backdrop-blur-md p-4 rounded-2xl sticky top-2 z-20 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-bold text-gray-900">แก้ไขข้อมูลพนักงาน</h1>
        </div>
        <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg flex items-center gap-2">
          {loading ? <Loader2 size={18} className="animate-spin"/> : <Save size={18} />} บันทึก
        </button>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          
          <div className="flex flex-col items-center mb-6 p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
             <div className="w-full max-w-xs">
                <ImageUploader 
                  images={formData.images} 
                  onChange={imgs => setFormData({...formData, images: [imgs[imgs.length-1]]})} 
                />
             </div>
             <p className="text-xs text-gray-500 mt-2 flex items-center gap-1"><Camera size={14}/> อัปโหลดรูปโปรไฟล์</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>ชื่อจริง</label>
              <input required className={inputClass} value={formData.first_name || ''} onChange={e => setFormData({...formData, first_name: e.target.value})} />
            </div>
            <div>
              <label className={labelClass}>นามสกุล</label>
              <input className={inputClass} value={formData.last_name || ''} onChange={e => setFormData({...formData, last_name: e.target.value})} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className={labelClass}>ชื่อเล่น</label>
              <input className={inputClass} value={formData.nickname || ''} onChange={e => setFormData({...formData, nickname: e.target.value})} />
            </div>
            <div>
              <label className={labelClass}>เบอร์โทร</label>
              <input className={inputClass} value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
             <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Shield size={18} className="text-indigo-600"/> การเข้าถึงระบบ</h3>
             <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>ตำแหน่ง (Role)</label>
                    <select className={inputClass} value={formData.role_id || ''} onChange={e => setFormData({...formData, role_id: e.target.value})}>
                        <option value="">-- เลือกตำแหน่ง --</option>
                        {roles && roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelClass}>สถานะบัญชี</label>
                    <select className={inputClass} value={formData.status || 'pending'} onChange={e => setFormData({...formData, status: e.target.value})}>
                        <option value="pending">รออนุมัติ (Pending)</option>
                        <option value="active">ใช้งานปกติ (Active)</option>
                        <option value="suspended">ระงับการใช้งาน (Suspended)</option>
                    </select>
                </div>
             </div>
          </div>
      </div>
    </form>
  );
};
export default UserForm;