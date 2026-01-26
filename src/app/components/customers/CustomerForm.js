import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, MapPin, User, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { parseAddress } from './AddressParser';
import ContactChannels from './ContactChannels';
import ImageUploader from './ImageUploader';

const CustomerForm = ({ onCancel, onSuccess, initialData }) => {
  const [loading, setLoading] = useState(false);

  const normalizeImages = (imgs) => (imgs || []).map(url => ({ url, file: null }));

  const [formData, setFormData] = useState(initialData ? {
    ...initialData,
    fullName: `${initialData.first_name} ${initialData.last_name || ''}`.trim(),
    images: normalizeImages(initialData.images)
  } : {
    code: `CUS-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,0)}-${Math.floor(1000 + Math.random() * 9000)}`,
    fullName: '', nickname: '', phone: '',
    social_channels: [{ type: 'Line', value: '' }],
    address_raw: '', address_parsed: {},
    images: [], notes: '',
    total_spent: 0
  });

  const handlePhoneChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 10) value = value.slice(0, 10);
    if (value.length > 6) value = `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6)}`;
    else if (value.length > 3) value = `${value.slice(0, 3)}-${value.slice(3)}`;
    setFormData({ ...formData, phone: value });
  };

  useEffect(() => {
    const parsed = parseAddress(formData.address_raw);
    setFormData(prev => ({ ...prev, address_parsed: parsed }));
  }, [formData.address_raw]);

  const handleSubmit = async (e) => {
    e.stopPropagation(); // หยุดการส่ง Event ไปยัง Form แม่ (OrderForm)
    e.preventDefault();
    
    setLoading(true);
    try {
      const uploadedImageUrls = await Promise.all(formData.images.map(async (imgObj) => {
        if (imgObj.file) {
          const file = imgObj.file;
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `${fileName}`;
          const { error: uploadError } = await supabase.storage.from('customers').upload(filePath, file);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('customers').getPublicUrl(filePath);
          return data.publicUrl;
        }
        return imgObj.url; 
      }));

      const nameParts = formData.fullName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      const payload = {
        code: formData.code,
        first_name: firstName,
        last_name: lastName,
        nickname: formData.nickname,
        phone: formData.phone,
        social_channels: formData.social_channels,
        address_raw: formData.address_raw,
        address_parsed: formData.address_parsed,
        notes: formData.notes,
        images: uploadedImageUrls,
        total_spent: formData.total_spent
      };

      if (initialData?.id) {
        await supabase.from('customers').update(payload).eq('id', initialData.id);
      } else {
        await supabase.from('customers').insert([payload]);
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
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto pb-20 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center bg-white/80 backdrop-blur-md p-4 rounded-2xl sticky top-2 z-20 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-bold text-gray-900">{initialData ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}</h1>
        </div>
        <button type="submit" disabled={loading} className="bg-gray-900 hover:bg-black text-white px-6 py-2.5 rounded-xl font-medium shadow-lg flex items-center gap-2">
          {loading ? <Loader2 size={18} className="animate-spin"/> : <Save size={18} />} บันทึก
        </button>
      </div>

      {/* ... (ส่วนแสดงผลเหมือนเดิม) ... */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center">
            <h3 className="font-bold text-gray-800 mb-4 text-left flex items-center gap-2"><User size={18}/> รูปโปรไฟล์</h3>
            <ImageUploader images={formData.images} onChange={imgs => setFormData({...formData, images: imgs})} />
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <label className={labelClass}>รหัสลูกค้า (Auto)</label>
            <input disabled className={`${inputClass} bg-gray-100 font-mono text-gray-500 cursor-not-allowed`} value={formData.code} />
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-5">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">ข้อมูลส่วนตัว</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className={labelClass}>ชื่อ - นามสกุล</label>
                <input required className={inputClass} placeholder="ระบุชื่อ-นามสกุล..." value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>ชื่อเล่น</label>
                <input className={inputClass} placeholder="ชื่อเล่น" value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} />
              </div>
              <div>
                <label className={labelClass}>เบอร์โทรศัพท์</label>
                <input className={inputClass} placeholder="0xx-xxx-xxxx" value={formData.phone} onChange={handlePhoneChange} maxLength={12} />
              </div>
            </div>
            <div>
              <label className={labelClass}>ช่องทางติดต่อเพิ่มเติม</label>
              <ContactChannels contacts={formData.social_channels} onChange={c => setFormData({...formData, social_channels: c})} />
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-5">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2"><MapPin size={18}/> ที่อยู่ (Smart Address)</h3>
            <div>
              <label className={labelClass}>ที่อยู่จัดส่ง</label>
              <textarea className={inputClass} rows="3" placeholder="พิมพ์ที่อยู่ยาวๆ ที่นี่..." value={formData.address_raw} onChange={e => setFormData({...formData, address_raw: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 text-sm">
              <div><span className="text-gray-500">จังหวัด:</span> <span className="font-bold text-indigo-700">{formData.address_parsed?.prov || '-'}</span></div>
              <div><span className="text-gray-500">เขต/อำเภอ:</span> <span className="font-bold text-indigo-700">{formData.address_parsed?.dist || '-'}</span></div>
              <div><span className="text-gray-500">แขวง/ตำบล:</span> <span className="font-bold text-indigo-700">{formData.address_parsed?.subdist || '-'}</span></div>
              <div><span className="text-gray-500">รหัสปณ.:</span> <span className="font-bold text-indigo-700">{formData.address_parsed?.zip || '-'}</span></div>
            </div>
            <div>
              <label className={labelClass}>หมายเหตุ</label>
              <textarea className={inputClass} rows="2" placeholder="บันทึกช่วยจำ..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
export default CustomerForm;