import React, { useState } from 'react';
import { ArrowLeft, Save, Loader2, Calendar, FileText, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { logAction } from '@/lib/auditLog';
import ImageUploader from './ImageUploader';
import NumericInput from './NumericInput';
import ChannelSelector from './ChannelSelector';

const MarketingForm = ({ onCancel, onSuccess, initialData }) => {
  const { profile } = useAuth();
  const meRef = () => profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null;
  const [loading, setLoading] = useState(false);
  
  const getLocalDate = () => new Date().toISOString().split('T')[0];

  const normalizeImages = (imgs) => (imgs || []).map(url => ({ url, file: null }));

  const [formData, setFormData] = useState(initialData ? {
    ...initialData,
    images: normalizeImages(initialData.images),
    expense_date: initialData.expense_date || getLocalDate()
  } : {
    title: '',
    channel_id: null,
    channel_name: '',
    amount: 0,
    expense_date: getLocalDate(),
    images: [],
    notes: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.channel_id) return alert('กรุณาเลือกช่องทางการตลาด');
    if (formData.amount <= 0) return alert('กรุณาระบุยอดเงิน');

    setLoading(true);
    try {
      // 1. Upload Images
      const uploadedImages = await Promise.all(formData.images.map(async (img) => {
        if (img.file) {
          const fileName = `mkt-${Date.now()}-${Math.random()}`;
          await supabase.storage.from('marketing').upload(fileName, img.file);
          const { data } = supabase.storage.from('marketing').getPublicUrl(fileName);
          return data.publicUrl;
        }
        return img.url;
      }));

      const payload = {
        title: formData.title,
        channel_id: formData.channel_id,
        channel_name: formData.channel_name,
        amount: formData.amount,
        expense_date: formData.expense_date,
        images: uploadedImages,
        notes: formData.notes
      };

      const logFields = (d) => ({
        title: d?.title, channel_name: d?.channel_name,
        amount: d?.amount, expense_date: d?.expense_date, notes: d?.notes,
      });

      let savedId = initialData?.id;
      if (initialData?.id) {
        await supabase.from('marketing_expenses').update(payload).eq('id', initialData.id);
      } else {
        const { data } = await supabase.from('marketing_expenses').insert([payload]).select().single();
        if (data) savedId = data.id;
      }

      await logAction({
        resource_type: 'marketing',
        resource_id: savedId,
        action: initialData?.id ? 'update' : 'create',
        resource_label: formData.title || formData.channel_name,
        old_data: initialData?.id ? logFields(initialData) : null,
        new_data: logFields(formData),
        created_by: meRef(),
      });

      onSuccess();
    } catch (err) {
      alert(err.message);
    } finally { setLoading(false); }
  };

  const inputClass = "w-full px-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 rounded-xl transition-all outline-none font-medium text-gray-700 placeholder:text-gray-400";
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1";

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto pb-20 animate-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center bg-white/80 backdrop-blur-md p-4 rounded-2xl sticky top-2 z-20 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-bold text-gray-900">{initialData ? 'แก้ไขรายการ' : 'บันทึกค่าใช้จ่ายการตลาด'}</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl text-gray-500 hover:bg-gray-50 font-medium text-sm">ยกเลิก</button>
          <button type="submit" disabled={loading} className="bg-gray-900 hover:bg-black text-white px-6 py-2.5 rounded-xl font-medium shadow-lg flex items-center gap-2 active:scale-95 transition-all">
            {loading ? <Loader2 size={18} className="animate-spin"/> : <Save size={18} />} บันทึก
          </button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-8">
        
        <ChannelSelector 
          selectedChannelId={formData.channel_id} 
          onChange={(id, name) => setFormData({...formData, channel_id: id, channel_name: name})}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelClass}>วันที่จ่าย</label>
            <div className="relative">
              <input type="date" className={inputClass} value={formData.expense_date} onChange={e => setFormData({...formData, expense_date: e.target.value})} />
              <Calendar className="absolute right-4 top-3.5 text-gray-400 pointer-events-none" size={20}/>
            </div>
          </div>
          <div>
            <label className={labelClass}>ยอดเงิน (บาท)</label>
            <div className="relative">
              <NumericInput 
                className={`${inputClass} text-pink-600 font-bold text-lg`} 
                placeholder="0.00" 
                value={formData.amount} 
                onChange={val => setFormData({...formData, amount: val})} 
              />
              <div className="absolute right-4 top-3.5 text-pink-300 pointer-events-none font-bold">THB</div>
            </div>
          </div>
        </div>

        <div>
           <label className={labelClass}>หัวข้อ / แคมเปญ (Optional)</label>
           <input className={inputClass} placeholder="เช่น โปรโมชั่น 11.11, ยิงแอดเปิดตัว..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
        </div>

        <div>
          <label className={labelClass}>รายละเอียด / หมายเหตุ</label>
          <textarea className={inputClass} rows="3" placeholder="บันทึกเพิ่มเติม..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
        </div>

        <div>
           <label className={labelClass}>รูปภาพหลักฐาน / ใบเสร็จ</label>
           <ImageUploader images={formData.images} onChange={imgs => setFormData({...formData, images: imgs})} />
        </div>
      </div>
    </form>
  );
};
export default MarketingForm;