import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, ArrowRight, Package, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const ProductAccessorySelector = ({ accessories = [], onChange }) => {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  // Search Logic (ค้นหาสินค้าอะไรก็ได้มาเป็นชุดแต่ง)
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchProducts = async () => {
      let query = supabase.from('products')
        .select('id, name, sku, sell_price, images')
        .limit(10);

      if (search.trim()) {
        query = query.ilike('name', `%${search}%`);
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data } = await query;
      if (data) setSearchResults(data);
    };

    const timeout = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timeout);
  }, [search, isOpen]);

  const addAccessory = (product) => {
    // ป้องกันการเลือกซ้ำ
    if (accessories.some(acc => acc.accessory_id === product.id)) {
        return alert('สินค้านี้อยู่ในรายการแล้ว');
    }
    
    onChange([...accessories, {
      accessory_id: product.id,
      product: product // เก็บ object สินค้าไว้แสดงผล
    }]);
    setIsOpen(false);
    setSearch('');
  };

  const removeAccessory = (idx) => {
    onChange(accessories.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 flex items-center gap-2 text-xs text-purple-700">
         <AlertCircle size={16} />
         <span>ระบุสินค้าที่จะนำมาเป็น <b>"ชุดแต่งแนะนำ"</b> หรือ <b>"อุปกรณ์เสริมตรงรุ่น"</b> สำหรับสินค้านี้</span>
      </div>

      {/* List of Selected Accessories */}
      <div className="space-y-2">
        {accessories.map((item, i) => (
          <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm animate-in slide-in-from-left-2">
             <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                {item.product?.images?.[0] ? <img src={item.product.images[0]} className="w-full h-full object-cover"/> : <Package size={20} className="m-2.5 text-gray-400"/>}
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{item.product?.name}</p>
                <p className="text-xs text-gray-500">{item.product?.sku}</p>
             </div>
             <div className="text-right text-xs">
                <p className="font-bold text-indigo-600">฿{item.product?.sell_price?.toLocaleString()}</p>
             </div>
             <button onClick={() => removeAccessory(i)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
          </div>
        ))}
        {accessories.length === 0 && <div className="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">ยังไม่ได้ระบุชุดแต่ง</div>}
      </div>

      {/* Search Input */}
      <div className="relative">
        <input 
          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-transparent focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 rounded-xl transition-all outline-none text-sm"
          placeholder="คลิกเพื่อค้นหาชุดแต่ง..."
          value={search}
          onChange={e => { setSearch(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
        />
        <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16}/>
        
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}/>
            <div className="absolute top-12 left-0 w-full bg-white rounded-xl shadow-xl border border-gray-100 z-20 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95">
               {searchResults.length > 0 ? searchResults.map(p => (
                 <div key={p.id} onClick={() => addAccessory(p)} className="flex items-center gap-3 p-3 hover:bg-purple-50 cursor-pointer border-b border-gray-50 last:border-none transition-colors">
                    <div className="w-8 h-8 bg-gray-100 rounded shrink-0 overflow-hidden">
                       {p.images?.[0] && <img src={p.images[0]} className="w-full h-full object-cover"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-sm font-bold text-gray-800 truncate">{p.name}</p>
                       <p className="text-xs text-gray-500 font-mono">{p.sku}</p>
                    </div>
                    <div className="text-right text-xs whitespace-nowrap">
                       <p className="text-indigo-600 font-bold">฿{p.sell_price?.toLocaleString()}</p>
                    </div>
                    <ArrowRight size={16} className="ml-2 text-gray-300"/>
                 </div>
               )) : (
                 <div className="p-4 text-center text-gray-400 text-sm">ไม่พบสินค้า</div>
               )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
export default ProductAccessorySelector;