import React, { useState } from 'react';
import { ArrowLeft, Save, Loader2, User, Phone, Mail, MessageCircle, Shield, Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ImageUploader from '../customers/ImageUploader';

const AddMemberForm = ({ onCancel, onSuccess, roles }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    nickname: '',
    phone: '',
    line_id: '',
    role_id: '',
    status: 'active',
    images: [] 
  });

  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.first_name) return alert('กรุณากรอกข้อมูลสำคัญ (อีเมล, ชื่อ)');
    if (!formData.role_id) return alert('กรุณาเลือกตำแหน่ง');

    setLoading(true);
    try {
      // 0. Check duplicate email
      const { data: existing } = await supabase.from('profiles').select('id').eq('email', formData.email.trim()).maybeSingle();
      if (existing) {
        alert('อีเมลนี้มีอยู่ในระบบแล้ว กรุณาใช้อีเมลอื่น');
        setLoading(false);
        return;
      }

      // 1. Upload Image
      let avatarUrl = null;
      if (formData.images.length > 0) {
        const imgObj = formData.images[0];
        if (imgObj.file) {
          const fileName = `avatar-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, imgObj.file);
          if (uploadError) throw new Error('Upload Avatar Failed: ' + uploadError.message);
          
          const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
          avatarUrl = data.publicUrl;
        } else {
          avatarUrl = imgObj.url;
        }
      }

      // 2. Prepare Payload
      const newId = generateUUID(); 
      
      const payload = {
        id: newId,
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        nickname: formData.nickname,
        phone: formData.phone,
        line_id: formData.line_id,
        role_id: parseInt(formData.role_id),
        status: formData.status,
        avatar_url: avatarUrl,
        // ส่ง social_channels ได้แล้ว เพราะเพิ่ม column ใน DB แล้ว
        social_channels: formData.line_id ? [{ type: 'Line', value: formData.line_id }] : []
      };

      // 3. Insert into Profiles
      const { error } = await supabase.from('profiles').insert([payload]).select();
      if (error) throw error;

      onSuccess();
    } catch (err) {
      let msg = err.message || 'Unknown Error';
      if (err.code === '23505') msg = 'อีเมลนี้มีอยู่ในระบบแล้ว';
      if (err.code === '23503') msg = 'ข้อมูลอ้างอิงไม่ถูกต้อง (Foreign Key)';
      if (err.code === '42501') msg = 'ไม่มีสิทธิ์ดำเนินการ (Permission Denied)';
      alert('บันทึกไม่สำเร็จ: ' + msg);
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
          <h1 className="text-xl font-bold text-gray-900">เพิ่มทีมงานใหม่</h1>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>อีเมล (สำหรับเข้าระบบ) *</label>
              <div className="relative">
                <input required type="email" className={`${inputClass} pl-10`} placeholder="email@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                <Mail className="absolute left-3.5 top-3 text-gray-400" size={18}/>
              </div>
            </div>
            <div>
              <label className={labelClass}>เบอร์โทรศัพท์</label>
              <div className="relative">
                <input className={`${inputClass} pl-10`} placeholder="0xx-xxx-xxxx" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                <Phone className="absolute left-3.5 top-3 text-gray-400" size={18}/>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
             <div className="md:col-span-2">
                <label className={labelClass}>ชื่อ - นามสกุล *</label>
                <div className="flex gap-2">
                  <input required className={inputClass} placeholder="ชื่อจริง" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} />
                  <input className={inputClass} placeholder="นามสกุล" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} />
                </div>
             </div>
             <div>
                <label className={labelClass}>ชื่อเล่น</label>
                <input className={inputClass} placeholder="ชื่อเล่น" value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} />
             </div>
          </div>

          <div>
             <label className={labelClass}>LINE ID</label>
             <div className="relative">
                <input className={`${inputClass} pl-10`} placeholder="ไอดีไลน์" value={formData.line_id} onChange={e => setFormData({...formData, line_id: e.target.value})} />
                <MessageCircle className="absolute left-3.5 top-3 text-green-500" size={18}/>
             </div>
          </div>

          <div className="pt-6 border-t border-gray-100">
             <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Shield size={18} className="text-indigo-600"/> การเข้าถึงระบบ</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <label className={labelClass}>ตำแหน่ง (Role) *</label>
                    <select required className={inputClass} value={formData.role_id} onChange={e => setFormData({...formData, role_id: e.target.value})}>
                        <option value="">-- เลือกตำแหน่ง --</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelClass}>สถานะเริ่มต้น</label>
                    <select className={inputClass} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                        <option value="active">ใช้งานได้เลย (Active)</option>
                        <option value="pending">รออนุมัติ (Pending)</option>
                    </select>
                </div>
             </div>
          </div>
      </div>
    </form>
  );
};
export default AddMemberForm;