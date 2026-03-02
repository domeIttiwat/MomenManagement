import React, { useState } from 'react';
import { ArrowLeft, Save, Loader2, User, Phone, MapPin, MessageSquare, Map, Wand2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import ImageUploader from './ImageUploader';

const CustomerForm = ({ onCancel, onSuccess, initialData }) => {
  const { profile } = useAuth();
  const meRef = () => profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null;
  const [loading, setLoading] = useState(false);
  
  const normalizeImages = (imgs) => {
    return (imgs || []).map(img => (typeof img === 'string' ? { url: img, file: null } : img));
  };

  const [formData, setFormData] = useState(initialData ? {
    ...initialData,
    images: normalizeImages(initialData.images),
    social_channels: initialData.social_channels || []
  } : {
    first_name: '',
    last_name: '',
    nickname: '',
    phone: '',
    address_raw: '',
    location_url: '',
    images: [],
    social_channels: [], 
    notes: ''
  });

  const [newSocial, setNewSocial] = useState({ type: 'Line', value: '' });

  // ฟังก์ชันแยกที่อยู่แบบง่าย (Smart Parse)
  const parseAddress = (rawAddress) => {
    if (!rawAddress) return {};
    
    let addr = { raw: rawAddress, prov: '', dist: '', subdist: '', zip: '' };
    
    // 1. หาจังหวัด
    const provMatch = rawAddress.match(/(?:จังหวัด|จ\.)\s*([^\s0-9]+)/) || rawAddress.match(/\s(กรุงเทพมหานคร|กรุงเทพฯ|กทม|กระบี่|ขอนแก่น|เชียงใหม่|...)/); 
    if (provMatch) addr.prov = provMatch[1];
    else if (rawAddress.includes('กทม')) addr.prov = 'กรุงเทพมหานคร';

    // 2. หาอำเภอ/เขต
    const distMatch = rawAddress.match(/(?:อำเภอ|อ\.|เขต)\s*([^\s0-9]+)/);
    if (distMatch) addr.dist = distMatch[1];

    // 3. หาตำบล/แขวง
    const subdistMatch = rawAddress.match(/(?:ตำบล|ต\.|แขวง)\s*([^\s0-9]+)/);
    if (subdistMatch) addr.subdist = subdistMatch[1];

    // 4. หารหัสไปรษณีย์ (เลข 5 หลักติดกัน)
    const zipMatch = rawAddress.match(/\b\d{5}\b/);
    if (zipMatch) addr.zip = zipMatch[0];

    return addr;
  };

  const handleAddressChange = (e) => {
    const raw = e.target.value;
    const parsed = parseAddress(raw);
    setFormData(prev => ({ 
        ...prev, 
        address_raw: raw,
        address_parsed: parsed 
    }));
  };

  const handleAddSocial = () => {
    if (!newSocial.value) return;
    setFormData({ ...formData, social_channels: [...formData.social_channels, newSocial] });
    setNewSocial({ type: 'Line', value: '' });
  };

  const removeSocial = (idx) => {
    const newSocials = formData.social_channels.filter((_, i) => i !== idx);
    setFormData({ ...formData, social_channels: newSocials });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.first_name || !formData.phone) return alert('กรุณากรอกชื่อและเบอร์โทร');

    setLoading(true);
    try {
      const uploadedImages = await Promise.all(formData.images.map(async (imgObj) => {
        if (imgObj.file) {
          const fileName = `cust-${Date.now()}-${Math.random()}`;
          await supabase.storage.from('customers').upload(fileName, imgObj.file);
          const { data } = supabase.storage.from('customers').getPublicUrl(fileName);
          return data.publicUrl;
        }
        return imgObj.url;
      }));

      const finalParsedAddress = parseAddress(formData.address_raw);

      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        nickname: formData.nickname,
        phone: formData.phone,
        address_raw: formData.address_raw,
        address_parsed: finalParsedAddress,
        location_url: formData.location_url,
        images: uploadedImages,
        social_channels: formData.social_channels,
        notes: formData.notes
      };

      let error;
      if (initialData?.id) {
        // กรณีแก้ไข: ไม่ต้องยุ่งกับ code
        const res = await supabase.from('customers').update({ ...payload, updated_by: meRef() }).eq('id', initialData.id);
        error = res.error;
      } else {
        // กรณีสร้างใหม่: สร้างรหัสลูกค้าอัตโนมัติ (C-YYMM-XXXX)
        const d = new Date();
        const code = `C-${d.getFullYear().toString().substr(-2)}${String(d.getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
        payload.code = code;

        const res = await supabase.from('customers').insert([{ ...payload, created_by: meRef() }]);
        error = res.error;
      }

      if (error) throw error;
      onSuccess();
    } catch (err) {
      console.error('Detailed Error:', JSON.stringify(err, null, 2));
      let msg = err.message || JSON.stringify(err);
      
      if (err.code === '42703') {
        msg = `ฐานข้อมูลยังไม่รองรับข้อมูลใหม่ (Column not found). กรุณารัน SQL อัปเดตตาราง customers เพิ่ม address_parsed และ location_url`;
      } else if (err.code === '23502') {
        msg = `ข้อมูลไม่ครบถ้วน (Not Null Constraint). ระบบพยายามสร้างรหัสลูกค้าให้อัตโนมัติแล้ว กรุณาลองใหม่อีกครั้ง`;
      }
      
      alert('บันทึกไม่สำเร็จ: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all outline-none text-gray-700 placeholder:text-gray-400";
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1";

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto pb-20 animate-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center bg-white/80 backdrop-blur-md p-4 rounded-2xl sticky top-2 z-20 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-bold text-gray-900">{initialData ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}</h1>
        </div>
        <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg flex items-center gap-2">
          {loading ? <Loader2 size={18} className="animate-spin"/> : <Save size={18} />} บันทึก
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left: Info */}
        <div className="md:col-span-2 space-y-6">
           <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 text-lg border-b border-gray-50 pb-4 mb-6 flex items-center gap-2"><User size={20} className="text-indigo-500"/> ข้อมูลทั่วไป</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                   <label className={labelClass}>ชื่อจริง *</label>
                   <input required className={inputClass} value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} />
                </div>
                <div>
                   <label className={labelClass}>นามสกุล</label>
                   <input className={inputClass} value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                   <label className={labelClass}>ชื่อเล่น</label>
                   <input className={inputClass} value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} />
                </div>
                <div>
                   <label className={labelClass}>เบอร์โทร *</label>
                   <input required className={inputClass} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>

              <div className="mb-4">
                 <label className={labelClass}>ที่อยู่จัดส่ง</label>
                 <textarea 
                    className={inputClass} 
                    rows="3" 
                    value={formData.address_raw} 
                    onChange={handleAddressChange} 
                    placeholder="บ้านเลขที่, ถนน, แขวง/ตำบล, เขต/อำเภอ, จังหวัด, รหัสไปรษณีย์"
                 />
                 {/* Live Preview of Parsed Address */}
                 {formData.address_parsed && (formData.address_parsed.prov || formData.address_parsed.dist) && (
                    <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg flex flex-wrap gap-2 items-center">
                        <Wand2 size={12} className="text-indigo-400"/>
                        <span className="font-bold text-gray-600">ระบบแยกข้อมูล:</span>
                        {formData.address_parsed.subdist && <span className="bg-white border px-1.5 rounded">ต.{formData.address_parsed.subdist}</span>}
                        {formData.address_parsed.dist && <span className="bg-white border px-1.5 rounded">อ.{formData.address_parsed.dist}</span>}
                        {formData.address_parsed.prov && <span className="bg-white border px-1.5 rounded">จ.{formData.address_parsed.prov}</span>}
                        {formData.address_parsed.zip && <span className="bg-white border px-1.5 rounded">{formData.address_parsed.zip}</span>}
                    </div>
                 )}
              </div>

              <div className="mb-4">
                 <label className={labelClass}><span className="flex items-center gap-1"><Map size={14}/> ลิงก์แผนที่ (Google Maps URL)</span></label>
                 <input 
                    className={`${inputClass} text-blue-600 underline`} 
                    placeholder="https://maps.app.goo.gl/..." 
                    value={formData.location_url || ''} 
                    onChange={e => setFormData({...formData, location_url: e.target.value})} 
                 />
              </div>

              <div>
                 <label className={labelClass}>หมายเหตุ</label>
                 <textarea className={inputClass} rows="2" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>
           </div>

           {/* Social Media */}
           <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 text-lg border-b border-gray-50 pb-4 mb-6 flex items-center gap-2"><MessageSquare size={20} className="text-pink-500"/> ช่องทางติดต่ออื่นๆ</h3>
              
              <div className="space-y-3 mb-4">
                 {formData.social_channels.map((soc, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl">
                       <span className="font-bold text-gray-600 w-24 uppercase text-xs">{soc.type}</span>
                       <span className="flex-1 text-sm">{soc.value}</span>
                       <button type="button" onClick={() => removeSocial(i)} className="text-gray-400 hover:text-red-500">ลบ</button>
                    </div>
                 ))}
              </div>

              <div className="flex gap-2">
                 <select className="bg-gray-50 border-transparent rounded-xl px-3 py-2 text-sm outline-none font-medium" value={newSocial.type} onChange={e => setNewSocial({...newSocial, type: e.target.value})}>
                    <option value="Line">Line</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Instagram">Instagram</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="TikTok">TikTok</option>
                 </select>
                 <input className="flex-1 bg-gray-50 border-transparent rounded-xl px-3 py-2 text-sm outline-none" placeholder="ระบุ ID หรือ ชื่อบัญชี..." value={newSocial.value} onChange={e => setNewSocial({...newSocial, value: e.target.value})} />
                 <button type="button" onClick={handleAddSocial} className="bg-indigo-100 text-indigo-700 px-4 rounded-xl text-sm font-bold hover:bg-indigo-200">เพิ่ม</button>
              </div>
           </div>
        </div>

        {/* Right: Images */}
        <div className="space-y-6">
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4">รูปภาพลูกค้า</h3>
              <ImageUploader images={formData.images} onChange={imgs => setFormData({...formData, images: imgs})} />
           </div>
        </div>
      </div>
    </form>
  );
};
export default CustomerForm;