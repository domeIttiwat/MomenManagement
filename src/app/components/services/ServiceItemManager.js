import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Wrench, Package, CornerDownRight, X, Search, Box, ArrowRight } from 'lucide-react';
import NumericInput from '../products/NumericInput';
import { supabase } from '@/lib/supabase';

const ServiceItemManager = ({ items = [], onChange }) => {
  // State สำหรับ Modal ค้นหาอะไหล่
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [targetItemIndex, setTargetItemIndex] = useState(null); // เก็บ index ของรายการหลักที่จะเพิ่มอะไหล่ใส่

  // --- Search Logic ---
  useEffect(() => {
    if (!isSearching) return;

    const fetchProducts = async () => {
      let query = supabase.from('products')
        .select('id, name, sku, cost_price, sell_price, images')
        .limit(10);

      if (searchQuery.trim()) {
        query = query.ilike('name', `%${searchQuery}%`);
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data } = await query;
      if (data) setSearchResults(data);
    };

    const timeout = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, isSearching]);

  const openSearch = (index) => {
    setTargetItemIndex(index);
    setIsSearching(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  const selectPart = (product) => {
    if (targetItemIndex === null) return;
    
    // เพิ่มอะไหล่เป็นรายการย่อย (Sub-item)
    const newItems = [...items];
    if (!newItems[targetItemIndex].sub_items) newItems[targetItemIndex].sub_items = [];
    
    newItems[targetItemIndex].sub_items.push({ 
        description: product.name, 
        type: 'Part', 
        cost: product.cost_price || 0, 
        price: product.sell_price || 0, 
        qty: 1 
    });
    
    recalculateTotal(newItems, targetItemIndex);
    
    // ปิด Modal
    setIsSearching(false);
    setTargetItemIndex(null);
  };
  // --------------------

  const addItem = () => {
    onChange([...items, { 
      description: '', 
      type: 'Job', 
      cost_price: 0, 
      sell_price: 0, 
      quantity: 1,
      sub_items: [] 
    }]);
  };

  const updateItem = (idx, field, val) => {
    const newItems = [...items];
    newItems[idx][field] = val;
    onChange(newItems);
  };

  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));

  // --- Sub Item Logic ---
  const addSubItemManual = (idx) => {
    const newItems = [...items];
    if (!newItems[idx].sub_items) newItems[idx].sub_items = [];
    newItems[idx].sub_items.push({ description: '', type: 'Part', cost: 0, price: 0, qty: 1 });
    recalculateTotal(newItems, idx);
  };

  const updateSubItem = (itemIdx, subIdx, field, val) => {
    const newItems = [...items];
    newItems[itemIdx].sub_items[subIdx][field] = val;
    recalculateTotal(newItems, itemIdx);
  };

  const removeSubItem = (itemIdx, subIdx) => {
    const newItems = [...items];
    newItems[itemIdx].sub_items = newItems[itemIdx].sub_items.filter((_, i) => i !== subIdx);
    recalculateTotal(newItems, itemIdx);
  };

  const recalculateTotal = (itemsArr, idx) => {
    const item = itemsArr[idx];
    if (item.sub_items && item.sub_items.length > 0) {
      const totalCost = item.sub_items.reduce((sum, s) => sum + (parseFloat(s.cost || 0) * parseFloat(s.qty || 1)), 0);
      const totalPrice = item.sub_items.reduce((sum, s) => sum + (parseFloat(s.price || 0) * parseFloat(s.qty || 1)), 0);
      item.cost_price = totalCost;
      item.sell_price = totalPrice;
      item.quantity = 1; 
    }
    onChange(itemsArr);
  };

  const autoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const handleFocus = (e) => e.target.select();

  return (
    <div className="space-y-6">
      {items.map((item, i) => {
        const hasSubItems = item.sub_items && item.sub_items.length > 0;
        const profit = (item.sell_price * item.quantity) - (item.cost_price * item.quantity);

        return (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden group hover:border-indigo-300 transition-all">
            {/* Main Item Header */}
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-col gap-4">
              <div className="w-full">
                <div className="flex items-center gap-2 mb-2">
                   <div className="bg-indigo-600 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold">{i+1}</div>
                   <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">รายละเอียดอาการ / งานซ่อม</span>
                </div>
                <textarea 
                  className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none overflow-hidden font-medium text-gray-800 leading-relaxed"
                  placeholder="ระบุอาการเสีย หรือ รายละเอียดงานที่ต้องทำ..."
                  value={item.description}
                  onChange={(e) => { updateItem(i, 'description', e.target.value); autoResize(e); }}
                  rows={1}
                  onInput={autoResize}
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-gray-200 w-full">
                 <div className={`flex items-center gap-2 ${hasSubItems ? 'opacity-60 pointer-events-none grayscale' : ''}`}>
                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-lg border border-gray-200">
                       <label className="text-[10px] text-gray-400 font-bold whitespace-nowrap">ทุน</label>
                       <NumericInput 
                          className={`w-16 text-right text-sm outline-none ${hasSubItems ? 'bg-transparent text-gray-500' : 'bg-white border-b border-gray-100 focus:border-amber-400'}`} 
                          value={item.cost_price} 
                          onChange={v => updateItem(i, 'cost_price', v)} 
                          placeholder="0" 
                          disabled={hasSubItems}
                          onFocus={handleFocus}
                       />
                    </div>
                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-lg border border-indigo-200">
                       <label className="text-[10px] text-indigo-500 font-bold whitespace-nowrap">ขาย</label>
                       <NumericInput 
                          className={`w-20 text-right text-sm font-bold outline-none ${hasSubItems ? 'bg-transparent text-indigo-700' : 'bg-white border-b border-indigo-100 focus:border-indigo-500 text-indigo-700'}`} 
                          value={item.sell_price} 
                          onChange={v => updateItem(i, 'sell_price', v)} 
                          placeholder="0" 
                          disabled={hasSubItems}
                          onFocus={handleFocus}
                       />
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-3 pl-3 border-l border-gray-300">
                    <span className={`text-xs font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                       กำไร: {profit.toLocaleString()}
                    </span>
                    <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                 </div>
              </div>
            </div>

            {/* Sub Items Area */}
            <div className="p-4 bg-white">
               {hasSubItems && (
                 <div className="space-y-2 mb-4">
                    <div className="text-[10px] uppercase font-bold text-gray-400 pl-8 flex gap-2">
                       <span className="flex-1">รายการย่อย (อะไหล่/ค่าแรง)</span>
                       <span className="w-14 text-right">ทุน</span>
                       <span className="w-14 text-right">ขาย</span>
                       <span className="w-10 text-center">Qty</span>
                       <span className="w-6"></span>
                    </div>
                    {item.sub_items.map((sub, sIdx) => (
                      <div key={sIdx} className="flex gap-2 items-center animate-in slide-in-from-top-1">
                         <CornerDownRight size={16} className="text-gray-300 ml-2 shrink-0"/>
                         <select 
                            className={`text-xs px-2 py-1.5 rounded-lg border outline-none font-medium shrink-0 ${sub.type === 'Part' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}
                            value={sub.type}
                            onChange={e => updateSubItem(i, sIdx, 'type', e.target.value)}
                         >
                            <option value="Part">อะไหล่</option>
                            <option value="Service">ค่าแรง</option>
                         </select>
                         <input 
                            className="flex-1 min-w-[120px] border-b border-gray-200 focus:border-indigo-500 px-2 py-1 text-sm outline-none bg-transparent font-medium"
                            placeholder="ระบุรายละเอียด..."
                            value={sub.description}
                            onChange={e => updateSubItem(i, sIdx, 'description', e.target.value)}
                         />
                         <NumericInput className="w-14 text-right bg-gray-50 border-b border-transparent hover:border-gray-300 focus:bg-white focus:border-amber-400 px-1 py-1 text-xs outline-none shrink-0" value={sub.cost} onChange={v => updateSubItem(i, sIdx, 'cost', v)} placeholder="0" onFocus={handleFocus} />
                         <NumericInput className="w-14 text-right bg-gray-50 border-b border-transparent hover:border-gray-300 focus:bg-white focus:border-indigo-500 px-1 py-1 text-xs font-bold text-indigo-700 outline-none shrink-0" value={sub.price} onChange={v => updateSubItem(i, sIdx, 'price', v)} placeholder="0" onFocus={handleFocus} />
                         <input type="number" min="1" className="w-10 text-center bg-gray-50 border-b border-transparent hover:border-gray-300 rounded px-1 py-1 text-xs outline-none shrink-0" value={sub.qty} onChange={e => updateSubItem(i, sIdx, 'qty', parseInt(e.target.value)||1)} onFocus={handleFocus} />
                         <button type="button" onClick={() => removeSubItem(i, sIdx)} className="p-1 text-gray-300 hover:text-red-400 shrink-0"><X size={14}/></button>
                      </div>
                    ))}
                 </div>
               )}
               
               <div className="flex gap-2 ml-8">
                   <button 
                     type="button"
                     onClick={() => addSubItemManual(i)}
                     className="text-xs font-bold text-gray-500 hover:text-gray-700 flex items-center gap-1 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors border border-gray-200"
                   >
                     <Plus size={14}/> พิมพ์เอง
                   </button>
                   <button 
                     type="button"
                     onClick={() => openSearch(i)}
                     className="text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                   >
                     <Search size={14}/> เลือกอะไหล่จากคลัง
                   </button>
               </div>
            </div>
          </div>
        );
      })}
      
      <button 
        type="button"
        onClick={addItem}
        className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-2xl hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 flex items-center justify-center gap-2 font-bold transition-all"
      >
        <Wrench size={20}/> เพิ่มอาการ / งานซ่อมใหม่
      </button>

      {/* SEARCH MODAL */}
      {isSearching && (
         <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95">
               <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                  <h3 className="font-bold text-gray-800">ค้นหาอะไหล่</h3>
                  <button onClick={() => setIsSearching(false)} className="p-1 hover:bg-gray-200 rounded-full"><X size={20}/></button>
               </div>
               <div className="p-3 border-b">
                  <div className="relative">
                     <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                     <input 
                        className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500/20" 
                        placeholder="พิมพ์ชื่ออะไหล่..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        autoFocus
                     />
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {searchResults.length > 0 ? searchResults.map(p => (
                     <div key={p.id} onClick={() => selectPart(p)} className="flex items-center gap-3 p-3 hover:bg-orange-50 cursor-pointer rounded-xl border border-transparent hover:border-orange-100 transition-all">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg shrink-0 overflow-hidden border border-gray-200">
                           {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover"/> : <Package size={16} className="m-2 text-gray-400"/>}
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-sm font-bold text-gray-800 truncate">{p.name}</p>
                           <p className="text-xs text-gray-500">{p.sku}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-xs font-bold text-orange-600">฿{p.sell_price?.toLocaleString()}</p>
                           <p className="text-[10px] text-gray-400">ทุน: {p.cost_price?.toLocaleString()}</p>
                        </div>
                        <ArrowRight size={16} className="ml-1 text-gray-300"/>
                     </div>
                  )) : (
                     <div className="text-center py-8 text-gray-400 text-sm">ไม่พบสินค้า</div>
                  )}
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
export default ServiceItemManager;