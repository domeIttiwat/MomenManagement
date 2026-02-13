import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Package, Plus, Lightbulb, Wrench, Layers, CheckCircle2, AlertCircle, PenTool, Hash, Filter, Screw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ✅ รับ variantId เพิ่มเข้ามาเพื่อใช้กรองอะไหล่ตามสเปค
const AssemblyAddPartModal = ({ productId, variantId, onClose, onAdd, existingItems = [] }) => {
  const [activeTab, setActiveTab] = useState(productId ? 'suggested' : 'search');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState(1);
  const [filterType, setFilterType] = useState('all'); 

  useEffect(() => {
    if (productId) setActiveTab('suggested');
  }, [productId]);

  // ✅ เปลี่ยนจากเช็คว่ามีไหม เป็นนับจำนวนที่แอดไปแล้ว
  const getAddedCount = (item) => {
    if (!existingItems || existingItems.length === 0) return 0;
    return existingItems.filter(existing => {
        // เช็คแบบเข้มงวด ถ้ามี ID
        const itemId = item.ref_id || item.id;
        if (itemId && existing.ref_id === itemId) return true;
        // เช็คชื่อ (สำหรับกรณี Manual หรือ Exploded items)
        return existing.name?.trim().toLowerCase() === item.name?.trim().toLowerCase();
    }).length;
  };

  useEffect(() => {
    if (!productId) return;
    const fetchSuggestions = async () => {
        setLoadingSuggestions(true);
        const suggs = [];
        try {
            // 1. Fasteners (น็อต/สกรู)
            const { data: fasteners } = await supabase.from('product_fasteners').select('*').eq('product_id', productId);
            if (fasteners) {
                fasteners.forEach(f => {
                    if (f.bolts_usage && Array.isArray(f.bolts_usage)) {
                        f.bolts_usage.forEach(b => {
                            // ✅ Explode Quantity: แตกรายการน็อตตามจำนวน
                            const qty = b.quantity || b.qty || 1;
                            for (let i = 1; i <= qty; i++) {
                                const suffix = qty > 1 ? ` (#${i})` : '';
                                suggs.push({
                                    id: `fastener-${f.id}-${b.name}-${i}-${Math.random()}`, 
                                    ref_id: `fastener-${f.id}-${b.name}-${i}`,
                                    name: (b.name || `น็อต/สกรู (${f.location_name})`) + suffix,
                                    quantity: 1, 
                                    type: 'fastener',
                                    location: f.location_name
                                });
                            }
                        });
                    }
                });
            }

            // 2. Bundles (Parts/อะไหล่)
            const { data: bundles } = await supabase.from('product_bundles')
                .select('quantity, parent_variant_id, child_product:child_product_id(id, name, sku)')
                .eq('parent_product_id', productId);

            if (bundles) {
                bundles.forEach(b => {
                    // ✅ Filter by Variant: กรองอะไหล่ให้ตรงสเปค
                    // กฎ: เอาถ้า (ไม่มี parent_variant_id คือใช้ร่วมกัน) หรือ (ตรงกับ variantId ที่ส่งมา)
                    const isCommonPart = !b.parent_variant_id;
                    const isMatchingVariant = b.parent_variant_id && variantId && b.parent_variant_id.toString() === variantId.toString();

                    if ((isCommonPart || isMatchingVariant) && b.child_product) {
                        // ✅ Explode Quantity: แตกรายการอะไหล่ตามจำนวน
                        const qty = b.quantity || 1;
                        for (let i = 1; i <= qty; i++) {
                            const suffix = qty > 1 ? ` (#${i})` : '';
                            suggs.push({
                                id: `${b.child_product.id}-${i}`,
                                ref_id: `${b.child_product.id}-${i}`, 
                                name: b.child_product.name + suffix,
                                quantity: 1,
                                type: 'bundle',
                                sku: b.child_product.sku
                            });
                        }
                    }
                });
            }
            setSuggestions(suggs);
        } catch (err) { console.error(err); } finally { setLoadingSuggestions(false); }
    };
    fetchSuggestions();
  }, [productId, variantId]); 

  // Search logic
  useEffect(() => {
     if (search.length < 2) return;
     const timeout = setTimeout(async () => {
        // ✅ ดึงข้อมูลหมวดหมู่และราคามาด้วยเพื่อใช้เรียงลำดับ
        const { data } = await supabase.from('products')
            .select('id, name, sku, sell_price, category:categories(name)')
            .ilike('name', `%${search}%`)
            .limit(20);
        
        if (data) {
            // ✅ Sorting Logic: สกู๊ตเตอร์/จักรยาน ขึ้นก่อน -> ตามด้วยราคาสูงสุด
            const sortedData = data.sort((a, b) => {
                const catA = a.category?.name || '';
                const catB = b.category?.name || '';
                
                // เช็คว่าเป็นหมวดหมู่ Priority หรือไม่
                const keywords = ['สกู๊ตเตอร์', 'จักรยาน', 'Scooter', 'Bicycle'];
                const isPriorA = keywords.some(k => catA.includes(k));
                const isPriorB = keywords.some(k => catB.includes(k));

                // 1. เรียงตามหมวดหมู่ก่อน
                if (isPriorA && !isPriorB) return -1;
                if (!isPriorA && isPriorB) return 1;

                // 2. ถ้าหมวดหมู่ศักดิ์เท่ากัน ให้เรียงตามราคา (มาก -> น้อย)
                return (b.sell_price || 0) - (a.sell_price || 0);
            });
            setSearchResults(sortedData);
        }
     }, 300);
     return () => clearTimeout(timeout);
  }, [search]);

  const handleManualAdd = (e) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    
    const newItem = { name: manualName.trim(), quantity: parseInt(manualQty) || 1, type: 'custom', id: null };
    
    // Manual add ไม่เช็คซ้ำแล้ว ยอมให้แอดได้เรื่อยๆ
    onAdd(newItem);
    setManualName(''); setManualQty(1);
  };

  const filteredSuggestions = suggestions.filter(item => {
      if (filterType === 'all') return true;
      return item.type === filterType;
  });

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
       <div className="bg-[#22272b] rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-700 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-[#2c333a]">
             <h3 className="font-bold text-gray-200 flex items-center gap-2">
                <Package size={20} className="text-blue-400"/> เพิ่มรายการ (Add Item)
             </h3>
             <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"><X size={20}/></button>
          </div>

          <div className="flex border-b border-gray-700 bg-[#22272b]">
              <button onClick={() => setActiveTab('suggested')} disabled={!productId} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'suggested' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/20' : 'text-gray-500 hover:bg-white/5 disabled:opacity-30'}`}>
                  <Lightbulb size={16}/> แนะนำ ({suggestions.length})
              </button>
              <button onClick={() => setActiveTab('search')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'search' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/20' : 'text-gray-500 hover:bg-white/5'}`}>
                  <Search size={16}/> ค้นหา
              </button>
              <button onClick={() => setActiveTab('manual')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'manual' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/20' : 'text-gray-500 hover:bg-white/5'}`}>
                  <PenTool size={16}/> กรอกเอง
              </button>
          </div>

          <div className="p-4 overflow-y-auto flex-1 bg-[#22272b] min-h-[300px]">
             {activeTab === 'suggested' && (
                 <>
                    <div className="flex gap-2 mb-3">
                        <button onClick={() => setFilterType('all')} className={`text-xs px-3 py-1.5 rounded-full border transition-all ${filterType === 'all' ? 'bg-white/10 text-white border-white/20' : 'text-gray-500 border-transparent hover:bg-white/5'}`}>ทั้งหมด</button>
                        <button onClick={() => setFilterType('fastener')} className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1 ${filterType === 'fastener' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'text-gray-500 border-transparent hover:bg-white/5'}`}>
                            <Wrench size={12}/> น็อต/สกรู
                        </button>
                        <button onClick={() => setFilterType('bundle')} className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1 ${filterType === 'bundle' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'text-gray-500 border-transparent hover:bg-white/5'}`}>
                            <Layers size={12}/> อะไหล่
                        </button>
                    </div>

                    <div className="space-y-2">
                        {loadingSuggestions ? <div className="text-center py-8 text-gray-500 animate-pulse">Loading...</div> : filteredSuggestions.length > 0 ? (
                            filteredSuggestions.map((item, idx) => {
                                const addedCount = getAddedCount(item);
                                const isAdded = addedCount > 0;
                                const isFastener = item.type === 'fastener';
                                return (
                                    <div 
                                        key={idx} 
                                        onClick={() => onAdd(item)} 
                                        className={`flex items-center gap-3 p-3 border rounded-lg transition-all group ${
                                            isAdded 
                                            ? 'bg-green-900/10 border-green-800' 
                                            : 'border-gray-700 hover:border-blue-500 hover:bg-[#2c333a] cursor-pointer'
                                        }`}
                                    >
                                        <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${isAdded ? 'bg-green-800 text-green-200' : (isFastener ? 'bg-orange-900/30 text-orange-500' : 'bg-blue-900/30 text-blue-500')}`}>
                                            {isAdded ? <CheckCircle2 size={20}/> : (isFastener ? <Wrench size={18}/> : <Layers size={18}/>)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${isFastener ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                    {isFastener ? 'FASTENER' : 'PART'}
                                                </span>
                                                <p className={`text-sm font-bold truncate ${isAdded ? 'text-green-400' : 'text-gray-100'}`}>{item.name}</p>
                                            </div>
                                            <p className="text-xs text-gray-400 flex items-center gap-1">
                                                {isFastener ? `ตำแหน่ง: ${item.location || '-'}` : `SKU: ${item.sku || '-'}`}
                                            </p>
                                        </div>
                                        {isAdded ? (
                                            <span className="text-[10px] text-green-400 font-bold bg-green-900/30 px-2 py-1 rounded border border-green-800">
                                                ADDED {addedCount > 1 && `x${addedCount}`}
                                            </span>
                                        ) : <Plus size={18} className="text-blue-500 opacity-0 group-hover:opacity-100"/>}
                                    </div>
                                );
                            })
                        ) : <div className="text-center py-10 text-gray-500 border border-dashed border-gray-700 rounded-xl">ไม่มีรายการแนะนำสำหรับสเปคนี้</div>}
                    </div>
                 </>
             )}

             {activeTab === 'search' && (
                 <>
                    <div className="relative mb-4">
                        <Search size={18} className="absolute left-3 top-2.5 text-gray-500"/>
                        <input 
                            autoFocus
                            className="w-full bg-[#161a1d] border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:border-blue-500 outline-none text-sm text-gray-100 placeholder-gray-500"
                            placeholder="พิมพ์ชื่ออะไหล่..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        {searchResults.map(prod => {
                            const addedCount = getAddedCount({ id: prod.id, name: prod.name });
                            const isAdded = addedCount > 0;
                            return (
                                <div 
                                    key={prod.id} 
                                    onClick={() => onAdd(prod)} 
                                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 bg-[#2c333a] hover:border-blue-500 hover:bg-[#323940] cursor-pointer group transition-all"
                                >
                                    <div className={`w-10 h-10 rounded flex items-center justify-center border ${isAdded ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                                        {isAdded ? <CheckCircle2 size={20}/> : <Package size={20}/>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-bold text-gray-100 truncate">{prod.name}</p>
                                            <span className="text-[10px] font-mono text-gray-400 bg-black/30 px-1.5 rounded">{prod.category?.name || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center mt-0.5">
                                            <p className="text-xs text-gray-400 font-mono">{prod.sku}</p>
                                            {prod.sell_price && <span className="text-xs font-bold text-blue-400">฿{prod.sell_price.toLocaleString()}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isAdded && (
                                            <span className="text-[10px] text-green-400 font-bold bg-green-900/30 px-2 py-1 rounded border border-green-800">
                                                x{addedCount}
                                            </span>
                                        )}
                                        <button className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 border border-blue-600/30 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all">
                                            <Plus size={18}/>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {searchResults.length === 0 && search.length > 1 && <div className="text-center py-8 text-gray-500"><p className="text-sm">ไม่พบสินค้า</p></div>}
                    </div>
                 </>
             )}

             {activeTab === 'manual' && (
                 <form onSubmit={handleManualAdd} className="space-y-4 pt-2">
                    <div><label className="text-xs font-bold text-gray-400 mb-1.5 block">ชื่อรายการ</label><div className="relative"><PenTool size={18} className="absolute left-3 top-3 text-gray-500"/><input autoFocus className="w-full bg-[#161a1d] border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:border-blue-500 outline-none text-sm text-gray-100" placeholder="ระบุเอง..." value={manualName} onChange={e => setManualName(e.target.value)}/></div></div>
                    <div><label className="text-xs font-bold text-gray-400 mb-1.5 block">จำนวน</label><div className="relative"><Hash size={18} className="absolute left-3 top-3 text-gray-500"/><input type="number" min="1" className="w-full bg-[#161a1d] border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:border-blue-500 outline-none text-sm text-gray-100" value={manualQty} onChange={e => setManualQty(e.target.value)}/></div></div>
                    <button type="submit" disabled={!manualName.trim()} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold shadow-md disabled:opacity-50 flex items-center justify-center gap-2"><Plus size={20}/> เพิ่มรายการ</button>
                 </form>
             )}
          </div>
       </div>
    </div>,
    document.body
  );
};
//send
export default AssemblyAddPartModal;