import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit, Save, ArrowLeft, Settings, Wrench, Ruler } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import NumericInput from './NumericInput';

const FastenerManager = ({ onBack }) => {
  const [bolts, setBolts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    id: null,
    head_type: '',
    size: '',
    length: '',
    material: '',
    unit_system: 'mm', // 'mm' or 'inch'
    cost_price: 0,
    sell_price: 0
  });

  useEffect(() => { fetchBolts(); }, []);

  const fetchBolts = async () => {
    setLoading(true);
    const { data } = await supabase.from('master_bolts').select('*').order('created_at', { ascending: false });
    if (data) setBolts(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.head_type || !formData.size || !formData.material) return alert('กรุณากรอกข้อมูลสำคัญ');

    // Generate Name based on Unit
    let name = '';
    if (formData.unit_system === 'inch') {
        name = `${formData.size} x ${formData.length}" ${formData.head_type} ${formData.material}`;
    } else {
        name = `${formData.size}x${formData.length}mm ${formData.head_type} ${formData.material}`;
    }
    
    const payload = {
      name,
      head_type: formData.head_type,
      size: formData.size,
      length: parseInt(formData.length) || 0, // Note: For inch, length might refer to numerator/denominator index or raw text, simplified here as text part of name
      material: formData.material,
      unit_system: formData.unit_system,
      cost_price: parseFloat(formData.cost_price),
      sell_price: parseFloat(formData.sell_price)
    };

    if (formData.id) {
      await supabase.from('master_bolts').update(payload).eq('id', formData.id);
    } else {
      await supabase.from('master_bolts').insert([payload]);
    }
    
    setIsEditing(false);
    setFormData({ id: null, head_type: '', size: '', length: '', material: '', unit_system: 'mm', cost_price: 0, sell_price: 0 });
    fetchBolts();
  };

  const handleDelete = async (id) => {
    if(!confirm('ลบน็อตรายการนี้?')) return;
    await supabase.from('master_bolts').delete().eq('id', id);
    fetchBolts();
  };

  const startEdit = (bolt) => {
    setFormData(bolt);
    setIsEditing(true);
  };

  const filtered = bolts.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

  // Presets
  const HEAD_TYPES = ['หัวจม (Socket)', 'หัวร่ม (Button)', 'หัวเตเปอร์ (Flat)', 'หัวเหลี่ยม (Hex)', 'หัวหมวก (Cap)', 'ตัวเมีย (Nut)', 'แหวน (Washer)'];
  const MATERIALS = ['สแตนเลส (Stainless)', 'เหล็กดำ (Black Steel)', 'ไทเทเนียม (Titanium)', 'เลสกลึง (Machined)', 'ทองเหลือง', 'อลูมิเนียม', 'ชุบขาว'];
  
  // Sizes based on Unit
  const SIZES_MM = ['M2', 'M2.5', 'M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M14'];
  const SIZES_INCH = ['1/8"', '5/32"', '3/16"', '1/4"', '5/16"', '3/8"', '7/16"', '1/2"', '5/8"', '3/4"'];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
           <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft size={20}/></button>
           <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Settings className="text-orange-500"/> จัดการคลังน็อต</h1>
        </div>
        <button onClick={() => { setIsEditing(true); setFormData({ id: null, head_type: '', size: '', length: '', material: '', unit_system: 'mm', cost_price: 0, sell_price: 0 }); }} className="bg-orange-500 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg hover:bg-orange-600 font-medium">
          <Plus size={18}/> เพิ่มสเปคใหม่
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2 space-y-4">
           <div className="relative">
             <Search className="absolute left-3 top-2.5 text-gray-400" size={18}/>
             <input className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="ค้นหา (เช่น M6, ไทเท)..." value={search} onChange={e => setSearch(e.target.value)} />
           </div>
           
           <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-bold">รายการ</th>
                    <th className="px-4 py-3 text-right font-bold w-24">ทุน</th>
                    <th className="px-4 py-3 text-right font-bold w-24">ขาย</th>
                    <th className="px-4 py-3 text-right font-bold w-24">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(b => (
                    <tr key={b.id} className="hover:bg-orange-50/30">
                      <td className="px-4 py-3">
                         <div className="font-bold text-gray-800">{b.name}</div>
                         <div className="text-[10px] text-gray-400 flex gap-2 mt-0.5">
                            <span className={`px-1.5 rounded ${b.unit_system === 'inch' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100'}`}>{b.unit_system === 'inch' ? 'หุน' : 'มิล'}</span>
                            <span className="bg-gray-100 px-1.5 rounded">{b.head_type}</span>
                            <span className="bg-gray-100 px-1.5 rounded">{b.material}</span>
                         </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{b.cost_price}</td>
                      <td className="px-4 py-3 text-right font-bold text-orange-600">{b.sell_price}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                           <button onClick={() => startEdit(b)} className="text-gray-400 hover:text-indigo-600 p-1"><Edit size={16}/></button>
                           <button onClick={() => handleDelete(b.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-400">ไม่พบรายการ</td></tr>}
                </tbody>
              </table>
           </div>
        </div>

        {/* Editor */}
        <div>
           {isEditing ? (
             <div className="bg-white p-6 rounded-2xl shadow-lg border border-orange-100 sticky top-4 animate-in slide-in-from-right-4">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-lg">
                   <Wrench size={20} className="text-orange-500"/> {formData.id ? 'แก้ไขข้อมูล' : 'เพิ่มสเปคใหม่'}
                </h3>
                <div className="space-y-4">
                   {/* Unit Toggle */}
                   <div className="bg-gray-100 p-1 rounded-lg flex text-xs font-bold text-gray-500">
                      <button 
                        onClick={() => setFormData({...formData, unit_system: 'mm'})}
                        className={`flex-1 py-1.5 rounded-md transition-all ${formData.unit_system === 'mm' ? 'bg-white text-orange-600 shadow' : 'hover:text-gray-700'}`}
                      >
                        มิล (mm)
                      </button>
                      <button 
                        onClick={() => setFormData({...formData, unit_system: 'inch'})}
                        className={`flex-1 py-1.5 rounded-md transition-all ${formData.unit_system === 'inch' ? 'bg-white text-purple-600 shadow' : 'hover:text-gray-700'}`}
                      >
                        หุน (Inch)
                      </button>
                   </div>

                   <div>
                     <label className="text-xs font-bold text-gray-500 mb-1 block">ชนิดหัวน็อต</label>
                     <input list="head_types" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500" value={formData.head_type} onChange={e => setFormData({...formData, head_type: e.target.value})} placeholder="เลือกหรือพิมพ์เอง..." />
                     <datalist id="head_types">{HEAD_TYPES.map(t => <option key={t} value={t}/>)}</datalist>
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">ขนาดเกลียว ({formData.unit_system})</label>
                        <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-orange-500" value={formData.size} onChange={e => setFormData({...formData, size: e.target.value})}>
                           <option value="">เลือกขนาด</option>
                           {(formData.unit_system === 'inch' ? SIZES_INCH : SIZES_MM).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">ความยาว</label>
                        <div className="relative">
                            <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500" value={formData.length} onChange={e => setFormData({...formData, length: e.target.value})} placeholder={formData.unit_system === 'mm' ? '20' : '1.5"'} />
                            <span className="absolute right-3 top-2 text-xs text-gray-400 pointer-events-none">{formData.unit_system === 'mm' ? 'mm' : 'นิ้ว'}</span>
                        </div>
                      </div>
                   </div>
                   <div>
                     <label className="text-xs font-bold text-gray-500 mb-1 block">วัสดุ</label>
                     <input list="materials" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500" value={formData.material} onChange={e => setFormData({...formData, material: e.target.value})} placeholder="เลือกหรือพิมพ์เอง..." />
                     <datalist id="materials">{MATERIALS.map(m => <option key={m} value={m}/>)}</datalist>
                   </div>
                   <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                      <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">ราคาทุน</label>
                        <NumericInput className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500 text-right" value={formData.cost_price} onChange={v => setFormData({...formData, cost_price: v})} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-orange-500 mb-1 block">ราคาขาย</label>
                        <NumericInput className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm font-bold text-orange-700 outline-none focus:border-orange-500 text-right" value={formData.sell_price} onChange={v => setFormData({...formData, sell_price: v})} />
                      </div>
                   </div>
                   
                   <div className="flex gap-2 pt-4">
                     <button onClick={handleSave} className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl font-bold shadow hover:bg-orange-600 transition-colors">บันทึก</button>
                     <button onClick={() => setIsEditing(false)} className="px-4 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 font-medium transition-colors">ยกเลิก</button>
                   </div>
                </div>
             </div>
           ) : (
             <div className="bg-gray-50 p-10 rounded-2xl border-2 border-dashed border-gray-200 text-center text-gray-400">
               <Settings size={48} className="mx-auto mb-3 opacity-20"/>
               <p className="text-sm">เลือกรายการเพื่อแก้ไข<br/>หรือกดเพิ่มสเปคใหม่ด้านบน</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
export default FastenerManager;