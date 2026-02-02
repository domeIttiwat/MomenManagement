import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Check, Plus, Package, CheckCircle2, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const AccessorySuggestionModal = ({ mainProduct, onClose, onAdd, existingItems = [] }) => {
  const [accessories, setAccessories] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchAccessories = async () => {
      // ใช้ product_id (จาก Order Item) หรือ id (จาก Product)
      const targetId = mainProduct.product_id || mainProduct.id;
      if (!targetId) return;
      
      const { data } = await supabase
        .from('product_compatible_accessories')
        .select('*, product:accessory_id(*)')
        .eq('product_id', targetId);
      
      if (data && data.length > 0) {
        // กรองเอาเฉพาะที่มีข้อมูลสินค้าจริง (เผื่อ product เป็น null)
        setAccessories(data.map(d => d.product).filter(Boolean));
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
    // กรองเอาเฉพาะรายการที่เลือก
    const selectedItems = accessories.filter(a => selectedIds.includes(a.id));
    
    // ตรวจสอบข้อมูลก่อนส่งกลับ (ให้แน่ใจว่ามีราคา)
    const itemsWithPrice = selectedItems.map(item => ({
        ...item,
        sell_price: Number(item.sell_price) || 0,
        cost_price: Number(item.cost_price) || 0
    }));

    onAdd(itemsWithPrice);
    onClose();
  };

  if (!mounted) return null;
  if (loading) return null; 
  if (accessories.length === 0) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
         {/* Header */}
         <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white flex justify-between items-start shrink-0">
            <div>
               <h3 className="font-bold text-lg flex items-center gap-2"><Sparkles size={20} className="text-yellow-300"/> เลือกชุดแต่งเพิ่ม</h3>
               <p className="text-white/80 text-sm mt-1">สินค้าแนะนำสำหรับ: <b>{mainProduct.product_name || mainProduct.name}</b></p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10"><X size={24}/></button>
         </div>
         
         {/* List */}
         <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2 bg-gray-50 flex-1">
            {accessories.map((acc) => {
                // ตรวจสอบว่ามีอยู่ในตะกร้าหรือยัง (ตรวจสอบครอบคลุมทั้ง id และ product_id)
                // แปลงเป็น String เพื่อป้องกันปัญหา Type Mismatch (เช่น "10" ไม่เท่ากับ 10)
                const isInCart = existingItems.some(item => {
                    const existingId = String(item.product_id || item.id);
                    return existingId === String(acc.id);
                });
                
                const isSelected = selectedIds.includes(acc.id);
                
                return (
                    <div 
                        key={acc.id} 
                        onClick={() => !isInCart && toggleSelect(acc.id)} // ถ้ามีแล้ว ห้ามกดเลือกซ้ำ
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all 
                           ${isInCart 
                               ? 'border-gray-200 bg-gray-100 opacity-60 cursor-default' // ถ้ามีแล้ว ให้เป็นสีเทาจางๆ
                               : isSelected 
                                   ? 'border-indigo-500 bg-indigo-50 cursor-pointer shadow-sm' // ถ้าเลือกอยู่ ให้เป็นสีน้ำเงิน
                                   : 'border-transparent bg-white hover:border-indigo-200 cursor-pointer shadow-sm' // ปกติ
                           }`}
                    >
                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-100 relative">
                             {acc.images?.[0] ? <img src={acc.images[0]} className="w-full h-full object-cover"/> : <Package size={20} className="m-3 text-gray-400"/>}
                             {isInCart && (
                                <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                                    <CheckCircle2 size={20} className="text-green-600 bg-white rounded-full"/>
                                </div>
                             )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <p className={`text-sm font-bold truncate ${isInCart ? 'text-gray-500' : 'text-gray-800'}`}>{acc.name}</p>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-gray-500 font-medium">฿{Number(acc.sell_price).toLocaleString()}</p>
                                {isInCart ? (
                                    <span className="text-[10px] bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                        อยู่ในรายการแล้ว
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                        ชุดแต่งตรงรุ่น
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        {!isInCart && (
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0
                                ${isSelected 
                                    ? 'bg-indigo-500 border-indigo-500' 
                                    : 'border-gray-300 bg-white group-hover:border-indigo-300'
                                }`}>
                                {isSelected && <Check size={14} className="text-white" strokeWidth={3}/>}
                            </div>
                        )}
                    </div>
                );
            })}
         </div>

         {/* Footer */}
         <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3 shrink-0">
             <button onClick={onClose} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-xl transition-colors text-sm">ไม่รับเพิ่ม</button>
             <button onClick={handleAdd} disabled={selectedIds.length === 0} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm transition-all">
                <Plus size={18}/> เพิ่ม {selectedIds.length} รายการ
             </button>
         </div>
      </div>
    </div>,
    document.body
  );
};

export default AccessorySuggestionModal;