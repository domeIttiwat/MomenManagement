import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Camera, Search, X, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ImageUploader from '../orders/ImageUploader';

const ProductFastenerSelector = ({ locations = [], onChange, variants = [] }) => {
  const [bolts, setBolts] = useState([]);
  const [boltSearch, setBoltSearch] = useState('');
  const [isAddingBolt, setIsAddingBolt] = useState({ locIndex: -1, isOpen: false });

  useEffect(() => {
    const fetchBolts = async () => {
      const { data } = await supabase.from('master_bolts').select('*').order('name');
      if (data) setBolts(data);
    };
    fetchBolts();
  }, []);

  const addLocation = () => {
    onChange([...locations, { 
      location_name: '', 
      location_image: null, 
      bolts_usage: [] 
    }]);
  };

  const removeLocation = (idx) => {
    onChange(locations.filter((_, i) => i !== idx));
  };

  const updateLocation = (idx, field, val) => {
    const newLocs = [...locations];
    newLocs[idx][field] = val;
    onChange(newLocs);
  };

  // --- Bolt Management ---
  const addBoltToLocation = (locIndex, bolt) => {
    const newLocs = [...locations];
    const currentBolts = newLocs[locIndex].bolts_usage || [];
    
    // ปรับ Logic เช็คซ้ำ: ยอมให้เพิ่มได้ถ้ายังไม่มีรายการที่เป็น Common (null variant) สำหรับน็อตตัวนี้
    // (เพราะค่าเริ่มต้นตอนเพิ่มจะเป็น Common เสมอ)
    const hasCommonEntry = currentBolts.some(b => b.bolt_id === bolt.id && !b.parent_variant_id);

    if (!hasCommonEntry) {
      newLocs[locIndex].bolts_usage = [...currentBolts, { 
        bolt_id: bolt.id, 
        name: bolt.name, 
        qty: 1, 
        price: bolt.sell_price,
        head_type: bolt.head_type,
        material: bolt.material,
        parent_variant_id: null // เริ่มต้นเป็นใช้ร่วมกันทุกรุ่น
      }];
      onChange(newLocs);
    } else {
        alert('มีรายการน็อตนี้ที่เป็นแบบใช้ร่วมกันทุกรุ่นอยู่แล้ว หากต้องการระบุเฉพาะรุ่น ให้เปลี่ยนรายการเดิมเป็นรุ่นย่อยก่อน');
    }
    setIsAddingBolt({ locIndex: -1, isOpen: false });
  };

  const removeBoltFromLocation = (locIndex, boltIdx) => {
    const newLocs = [...locations];
    newLocs[locIndex].bolts_usage = newLocs[locIndex].bolts_usage.filter((_, i) => i !== boltIdx);
    onChange(newLocs);
  };

  // ฟังก์ชันอัปเดตข้อมูลน็อต (รวมถึง Variant)
  const updateBoltUsage = (locIndex, boltIdx, field, val) => {
    const newLocs = [...locations];
    if (field === 'qty') val = parseInt(val) || 1;
    newLocs[locIndex].bolts_usage[boltIdx][field] = val;
    onChange(newLocs);
  };

  const filteredBolts = bolts.filter(b => b.name.toLowerCase().includes(boltSearch.toLowerCase()));

  return (
    <div className="space-y-6">
      {locations.map((loc, i) => (
        <div key={i} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm relative group animate-in slide-in-from-bottom-2">
           <button type="button" onClick={() => removeLocation(i)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 p-1"><X size={20}/></button>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
              <div className="flex flex-col gap-3">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">จุดติดตั้ง</label>
                 <input 
                   className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-orange-500/20 outline-none"
                   placeholder="เช่น บังโคลนหน้า, สวิงอาร์ม..."
                   value={loc.location_name}
                   onChange={e => updateLocation(i, 'location_name', e.target.value)}
                 />
                 <div className="w-full aspect-video bg-gray-50 rounded-xl overflow-hidden border border-dashed border-gray-300 flex items-center justify-center relative">
                    {loc.location_image ? (
                        <div className="relative w-full h-full group/img">
                           <img src={loc.location_image} className="w-full h-full object-cover"/>
                           <button type="button" onClick={() => updateLocation(i, 'location_image', null)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X size={14}/></button>
                        </div>
                    ) : (
                        <div className="p-2 w-full">
                           <ImageUploader images={[]} onChange={(imgs) => updateLocation(i, 'location_image', imgs[0]?.url)} />
                           <div className="text-center text-xs text-gray-400 mt-2 pointer-events-none">รูปจุดติดตั้ง</div>
                        </div>
                    )}
                 </div>
              </div>

              <div className="md:col-span-2 bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col">
                 <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">รายการน็อตที่ใช้</label>
                    <button type="button" onClick={() => setIsAddingBolt({ locIndex: i, isOpen: true })} className="text-xs text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"><Plus size={14}/> เลือกน็อต</button>
                 </div>
                 
                 <div className="space-y-2 flex-1">
                    {loc.bolts_usage?.map((b, bIdx) => (
                       <div key={bIdx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm text-sm gap-2">
                          <div className="flex flex-col flex-1 min-w-0 w-full">
                             <span className="font-bold text-gray-800 truncate">{b.name}</span>
                             <span className="text-[10px] text-gray-500">{b.material} | {b.head_type}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                             {/* Variant Selector */}
                             {variants.length > 0 && (
                                <select 
                                    className={`text-[10px] border rounded px-2 py-1 outline-none font-medium max-w-[100px] ${b.parent_variant_id ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-green-50 text-green-700 border-green-200'}`}
                                    value={b.parent_variant_id || ''}
                                    onChange={(e) => updateBoltUsage(i, bIdx, 'parent_variant_id', e.target.value || null)}
                                >
                                    <option value="">ทุกรุ่น (Common)</option>
                                    {variants.map(v => (
                                        <option key={v.id} value={v.id}>เฉพาะ: {v.name}</option>
                                    ))}
                                </select>
                             )}

                             <div className="flex items-center gap-1 bg-gray-100 rounded px-2 py-1 shrink-0">
                                <input 
                                    type="number" min="1" 
                                    className="w-8 text-center bg-transparent font-bold outline-none text-gray-700" 
                                    value={b.qty} 
                                    onChange={e => updateBoltUsage(i, bIdx, 'qty', e.target.value)}
                                />
                                <span className="text-[10px] text-gray-400">ตัว</span>
                             </div>
                             <button type="button" onClick={() => removeBoltFromLocation(i, bIdx)} className="text-red-400 hover:text-red-600 ml-1"><Trash2 size={16}/></button>
                          </div>
                       </div>
                    ))}
                    {(!loc.bolts_usage || loc.bolts_usage.length === 0) && <div className="text-center text-xs text-gray-400 py-8 flex flex-col items-center justify-center"><Settings size={24} className="mb-2 opacity-20"/>ยังไม่ได้ระบุน็อต</div>}
                 </div>
              </div>
           </div>
        </div>
      ))}
      
      <button type="button" onClick={addLocation} className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 font-bold flex items-center justify-center gap-2 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-all">
         <Camera size={20}/> เพิ่มจุดติดตั้งใหม่
      </button>

      {/* Modal Select Bolt */}
      {isAddingBolt.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                 <h3 className="font-bold text-gray-800 text-lg">เลือกน็อตจากคลัง</h3>
                 <button onClick={() => setIsAddingBolt({ locIndex: -1, isOpen: false })} className="p-1 hover:bg-gray-200 rounded-full"><X size={20}/></button>
              </div>
              <div className="p-3 border-b">
                 <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18}/>
                    <input className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="ค้นหา (ขนาด, วัสดุ)..." value={boltSearch} onChange={e => setBoltSearch(e.target.value)} autoFocus/>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                 {filteredBolts.map(b => (
                    <div key={b.id} onClick={() => addBoltToLocation(isAddingBolt.locIndex, b)} className="p-3 hover:bg-orange-50 cursor-pointer rounded-xl border border-transparent hover:border-orange-100 flex justify-between items-center group transition-all">
                       <div>
                          <p className="text-sm font-bold text-gray-800 group-hover:text-orange-700">{b.name}</p>
                          <p className="text-xs text-gray-500">{b.material} | {b.head_type} | {b.length}mm</p>
                       </div>
                       <span className="text-sm font-bold text-orange-600">฿{b.sell_price}</span>
                    </div>
                 ))}
                 {filteredBolts.length === 0 && <p className="text-center text-sm text-gray-400 py-8">ไม่พบรายการ</p>}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
export default ProductFastenerSelector;