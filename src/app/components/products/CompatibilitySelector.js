import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Bike, Check, X, ChevronsUpDown } from 'lucide-react';

const CompatibilitySelector = ({ mode, selectedModels, onChange }) => {
  const [scooters, setScooters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  // ดึงรายชื่อรถสกู๊ตเตอร์ทั้งหมดมาให้เลือก
  useEffect(() => {
    const fetchScooters = async () => {
      // สมมติว่ารถสกู๊ตเตอร์อยู่ในหมวดหมู่ 'Electric Scooters'
      // เราจะดึง Category ID ก่อน แล้วค่อยดึงสินค้า
      const { data: catData } = await supabase.from('categories').select('id').eq('name', 'Electric Scooters').single();
      
      if (catData) {
        const { data: products } = await supabase
          .from('products')
          .select('id, name, sku')
          .eq('category_id', catData.id);
        
        if (products) setScooters(products);
      }
      setLoading(false);
    };
    fetchScooters();
  }, []);

  const toggleModel = (modelName) => {
    const currentSelected = selectedModels || [];
    if (currentSelected.includes(modelName)) {
      onChange('mode', mode, currentSelected.filter(m => m !== modelName));
    } else {
      onChange('mode', mode, [...currentSelected, modelName]);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. โหมดการเลือก */}
      <div className="flex gap-4">
        <label className={`flex-1 cursor-pointer border rounded-xl p-3 flex items-center gap-3 transition-all ${mode === 'universal' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600' : 'border-gray-200 hover:border-gray-300'}`}>
          <input 
            type="radio" 
            name="compatibility" 
            className="w-4 h-4 accent-indigo-600"
            checked={mode === 'universal'}
            onChange={() => onChange('mode', 'universal', [])}
          />
          <div>
            <p className="font-bold text-sm">ใช้ได้ทุกรุ่น (Universal)</p>
            <p className="text-xs opacity-70">ติดตั้งได้กับรถทั่วไป</p>
          </div>
        </label>

        <label className={`flex-1 cursor-pointer border rounded-xl p-3 flex items-center gap-3 transition-all ${mode === 'specific' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600' : 'border-gray-200 hover:border-gray-300'}`}>
          <input 
            type="radio" 
            name="compatibility" 
            className="w-4 h-4 accent-indigo-600"
            checked={mode === 'specific'}
            onChange={() => onChange('mode', 'specific', selectedModels || [])}
          />
          <div>
            <p className="font-bold text-sm">เฉพาะรุ่น (Specific)</p>
            <p className="text-xs opacity-70">เลือกรุ่นที่รองรับ</p>
          </div>
        </label>
      </div>

      {/* 2. รายชื่อรุ่นรถ (แสดงเฉพาะตอนเลือก Specific) */}
      {mode === 'specific' && (
        <div className="animate-in fade-in slide-in-from-top-2">
          <div className="relative">
            <button 
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-left flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <span className="text-sm text-gray-700">
                {selectedModels?.length > 0 
                  ? `เลือกแล้ว ${selectedModels.length} รุ่น` 
                  : '-- เลือกรุ่นรถที่รองรับ --'}
              </span>
              <ChevronsUpDown size={16} className="text-gray-400" />
            </button>

            {/* Dropdown List */}
            {isOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 overflow-auto p-2">
                {loading ? (
                  <div className="p-4 text-center text-xs text-gray-400">กำลังโหลดรายชื่อรถ...</div>
                ) : scooters.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400">ไม่พบข้อมูลรถในระบบ</div>
                ) : (
                  <div className="space-y-1">
                    {scooters.map((scooter) => {
                      const isSelected = selectedModels?.includes(scooter.name);
                      return (
                        <div 
                          key={scooter.id} 
                          onClick={() => toggleModel(scooter.name)}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'}`}
                        >
                          <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'}`}>
                            {isSelected && <Check size={14} />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{scooter.name}</p>
                            <p className="text-[10px] text-gray-400">{scooter.sku}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Tags */}
          {selectedModels?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {selectedModels.map((model, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-gray-200 text-xs font-medium text-gray-700 shadow-sm">
                  <Bike size={12} className="text-indigo-500" />
                  {model}
                  <button type="button" onClick={() => toggleModel(model)} className="hover:text-red-500 ml-1"><X size={12}/></button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CompatibilitySelector;