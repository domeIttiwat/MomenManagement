import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Check, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const AccessorySuggestionModal = ({ mainProduct, onClose, onAdd }) => {
  const [accessories, setAccessories] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchAccessories = async () => {
      if (!mainProduct?.id) return;
      
      const { data } = await supabase
        .from('product_compatible_accessories')
        .select('*, product:accessory_id(*)')
        .eq('product_id', mainProduct.id);
      
      if (data && data.length > 0) {
        setAccessories(data.map(d => d.product));
      } else {
        // ถ้าไม่มีชุดแต่ง ปิดตัวเอง
        onClose();
      }
      setLoading(false);
    };
    fetchAccessories();
  }, [mainProduct, onClose]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAdd = () => {
    const selectedItems = accessories.filter(a => selectedIds.includes(a.id));
    onAdd(selectedItems);
    onClose();
  };

  if (!mounted) return null;
  if (loading) return null; // หรือแสดง spinner เล็กๆ
  if (accessories.length === 0) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
         {/* Header */}
         <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-5 text-white flex justify-between items-start">
            <div>
               <h3 className="font-bold text-lg flex items-center gap-2"><Sparkles size={20}/> รับชุดแต่งเพิ่มไหมครับ?</h3>
               <p className="text-white/80 text-sm mt-1">รายการชุดแต่งตรงรุ่นสำหรับ <b>{mainProduct.name}</b></p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10"><X size={24}/></button>
         </div>
         
         {/* List */}
         <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2 bg-gray-50">
            {accessories.map((acc) => {
                const isSelected = selectedIds.includes(acc.id);
                return (
                    <div 
                        key={acc.id} 
                        onClick={() => toggleSelect(acc.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all ${isSelected ? 'border-pink-500 bg-pink-50' : 'border-transparent bg-white hover:border-pink-200'}`}
                    >
                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                             {acc.images?.[0] && <img src={acc.images[0]} className="w-full h-full object-cover"/>}
                        </div>
                        <div className="flex-1">
                            <p className={`text-sm font-bold ${isSelected ? 'text-pink-700' : 'text-gray-800'}`}>{acc.name}</p>
                            <p className="text-xs text-gray-500">฿{acc.sell_price?.toLocaleString()}</p>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-pink-500 border-pink-500' : 'border-gray-300'}`}>
                            {isSelected && <Check size={14} className="text-white" strokeWidth={3}/>}
                        </div>
                    </div>
                );
            })}
         </div>

         {/* Footer */}
         <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3">
             <button onClick={onClose} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-xl transition-colors">ไม่รับ</button>
             <button onClick={handleAdd} disabled={selectedIds.length === 0} className="px-6 py-2 bg-pink-600 text-white rounded-xl font-bold shadow-md hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                <Plus size={18}/> เพิ่ม {selectedIds.length} รายการ
             </button>
         </div>
      </div>
    </div>,
    document.body
  );
};

export default AccessorySuggestionModal;