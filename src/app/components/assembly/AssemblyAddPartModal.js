import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Package, Plus, Lightbulb, Wrench, Layers, CheckCircle2, AlertCircle, PenTool, Hash, Screw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const AssemblyAddPartModal = ({ productId, onClose, onAdd, existingItems = [] }) => {
  const [activeTab, setActiveTab] = useState(productId ? 'suggested' : 'search');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState(1);

  // Auto switch tab
  useEffect(() => {
    if (productId) setActiveTab('suggested');
  }, [productId]);

  const isAlreadyAdded = (item) => {
    if (!existingItems || existingItems.length === 0) return false;
    return existingItems.some(existing => {
        const itemId = item.ref_id || item.id;
        if (itemId && existing.ref_id === itemId) return true;
        return existing.name?.trim().toLowerCase() === item.name?.trim().toLowerCase();
    });
  };

  useEffect(() => {
    if (!productId) return;
    const fetchSuggestions = async () => {
        setLoadingSuggestions(true);
        const suggs = [];
        try {
            const { data: fasteners } = await supabase.from('product_fasteners').select('*').eq('product_id', productId);
            if (fasteners) {
                fasteners.forEach(f => {
                    if (f.bolts_usage && Array.isArray(f.bolts_usage)) {
                        f.bolts_usage.forEach(b => {
                            suggs.push({
                                id: `fastener-${f.id}-${b.name}-${Math.random()}`, 
                                ref_id: `fastener-${f.id}-${b.name}`,
                                name: b.name || `น็อต/สกรู (${f.location_name})`,
                                quantity: b.quantity || b.qty || 1,
                                type: 'fastener',
                                location: f.location_name
                            });
                        });
                    }
                });
            }
            const { data: bundles } = await supabase.from('product_bundles').select('quantity, child_product:child_product_id(id, name, sku)').eq('parent_product_id', productId);
            if (bundles) {
                bundles.forEach(b => {
                    if (b.child_product) {
                        suggs.push({
                            id: b.child_product.id,
                            ref_id: b.child_product.id,
                            name: b.child_product.name,
                            quantity: b.quantity,
                            type: 'bundle',
                            sku: b.child_product.sku
                        });
                    }
                });
            }
            setSuggestions(suggs);
        } catch (err) { console.error(err); } finally { setLoadingSuggestions(false); }
    };
    fetchSuggestions();
  }, [productId]);

  useEffect(() => {
     if (search.length < 2) return;
     const timeout = setTimeout(async () => {
        const { data } = await supabase.from('products').select('id, name, sku').ilike('name', `%${search}%`).limit(10);
        if (data) setSearchResults(data);
     }, 300);
     return () => clearTimeout(timeout);
  }, [search]);

  const handleManualAdd = (e) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    const newItem = { name: manualName.trim(), quantity: parseInt(manualQty) || 1, type: 'custom', id: null };
    if (isAlreadyAdded(newItem)) return alert('มีรายการนี้แล้ว');
    onAdd(newItem);
    setManualName(''); setManualQty(1);
  };

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
              <button 
                onClick={() => setActiveTab('suggested')}
                disabled={!productId}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'suggested' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/20' : 'text-gray-500 hover:bg-white/5 disabled:opacity-30'}`}
              >
                  <Lightbulb size={16}/> แนะนำ ({suggestions.length})
              </button>
              <button 
                onClick={() => setActiveTab('search')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'search' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/20' : 'text-gray-500 hover:bg-white/5'}`}
              >
                  <Search size={16}/> ค้นหา
              </button>
              <button 
                onClick={() => setActiveTab('manual')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'manual' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/20' : 'text-gray-500 hover:bg-white/5'}`}
              >
                  <PenTool size={16}/> กรอกเอง
              </button>
          </div>

          <div className="p-4 overflow-y-auto flex-1 bg-[#22272b] min-h-[300px]">
             {activeTab === 'suggested' && (
                 <div className="space-y-2">
                    {loadingSuggestions ? (
                        <div className="text-center py-8 text-gray-500 animate-pulse flex flex-col items-center gap-2">
                            <Layers className="animate-bounce text-indigo-400"/> กำลังโหลดข้อมูล...
                        </div>
                    ) : suggestions.length > 0 ? (
                        suggestions.map((item, idx) => {
                            const added = isAlreadyAdded(item);
                            const isFastener = item.type === 'fastener';
                            
                            return (
                                <div 
                                    key={idx} 
                                    onClick={() => !added && onAdd(item)} 
                                    className={`flex items-center gap-3 p-3 border rounded-lg transition-all group relative overflow-hidden ${
                                        added 
                                        ? 'bg-green-900/20 border-green-800 opacity-60 cursor-default' 
                                        : 'border-gray-700 hover:border-blue-500 hover:bg-[#2c333a] cursor-pointer'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${added ? 'bg-green-800 text-green-200' : (isFastener ? 'bg-orange-900/30 text-orange-500' : 'bg-blue-900/30 text-blue-500')}`}>
                                        {added ? <CheckCircle2 size={20}/> : (isFastener ? <Wrench size={18}/> : <Layers size={18}/>)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${isFastener ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                {isFastener ? 'FASTENER' : 'PART'}
                                            </span>
                                            <p className={`text-sm font-bold truncate ${added ? 'text-green-400' : 'text-gray-200'}`}>{item.name}</p>
                                        </div>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            {isFastener ? `ตำแหน่ง: ${item.location || '-'}` : `SKU: ${item.sku || '-'}`}
                                        </p>
                                    </div>
                                    {added ? <div className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-900/30 px-2 py-1 rounded border border-green-800"><CheckCircle2 size={10}/> ADDED</div> : <div className="flex items-center gap-2"><span className="text-xs font-bold bg-gray-800 px-2 py-1 rounded text-gray-400 border border-gray-700">x{item.quantity}</span><button className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 border border-blue-600/30 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"><Plus size={18}/></button></div>}
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-10 text-gray-500 border-2 border-dashed border-gray-700 rounded-xl">
                            <Lightbulb size={32} className="mx-auto mb-2 opacity-20"/>
                            <p className="text-sm">ไม่มีรายการอะไหล่แนะนำสำหรับสินค้านี้</p>
                        </div>
                    )}
                 </div>
             )}

             {activeTab === 'search' && (
                 <>
                    <div className="relative mb-4">
                        <Search size={18} className="absolute left-3 top-2.5 text-gray-500"/>
                        <input autoFocus className="w-full bg-[#161a1d] border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:border-blue-500 outline-none text-sm text-gray-200 placeholder-gray-500" placeholder="พิมพ์ชื่ออะไหล่..." value={search} onChange={e => setSearch(e.target.value)}/>
                    </div>
                    <div className="space-y-2">
                        {searchResults.map(prod => {
                            const added = isAlreadyAdded({ id: prod.id, name: prod.name });
                            return (
                                <div key={prod.id} onClick={() => !added && onAdd(prod)} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${added ? 'bg-green-900/20 border-green-800 opacity-60' : 'bg-[#2c333a] border-gray-700 hover:border-blue-500 cursor-pointer group'}`}>
                                    <div className="w-10 h-10 bg-gray-800 rounded flex items-center justify-center text-gray-400 border border-gray-700">{added ? <CheckCircle2 size={20} className="text-green-400"/> : <Package size={20}/>}</div>
                                    <div className="flex-1 min-w-0"><p className="text-sm font-bold text-gray-200 truncate">{prod.name}</p><p className="text-xs text-gray-500 font-mono">{prod.sku}</p></div>
                                    {added ? <span className="text-[10px] text-green-400 font-bold bg-green-900/30 px-2 py-1 rounded border border-green-800">ADDED</span> : <Plus size={18} className="text-blue-500 opacity-50 group-hover:opacity-100"/>}
                                </div>
                            );
                        })}
                    </div>
                 </>
             )}

             {activeTab === 'manual' && (
                 <form onSubmit={handleManualAdd} className="space-y-4 pt-2">
                    <div><label className="text-xs font-bold text-gray-500 mb-1.5 block">ชื่อรายการ</label><div className="relative"><PenTool size={18} className="absolute left-3 top-3 text-gray-500"/><input autoFocus className="w-full bg-[#161a1d] border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:border-blue-500 outline-none text-sm text-gray-200" placeholder="ระบุเอง..." value={manualName} onChange={e => setManualName(e.target.value)}/></div></div>
                    <div><label className="text-xs font-bold text-gray-500 mb-1.5 block">จำนวน</label><div className="relative"><Hash size={18} className="absolute left-3 top-3 text-gray-500"/><input type="number" min="1" className="w-full bg-[#161a1d] border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 focus:border-blue-500 outline-none text-sm text-gray-200" value={manualQty} onChange={e => setManualQty(e.target.value)}/></div></div>
                    <button type="submit" disabled={!manualName.trim()} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold shadow-md disabled:opacity-50 flex items-center justify-center gap-2"><Plus size={20}/> เพิ่มรายการ</button>
                 </form>
             )}
          </div>
       </div>
    </div>,
    document.body
  );
};

export default AssemblyAddPartModal;