import React, { useState, useEffect } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CategoryManager = ({ selectedCategoryIds = [], onChange }) => {
  const [categories, setCategories] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    setLoading(true);
    const { data } = await supabase.from('categories').insert([{ name: newCatName }]).select().single();
    if (data) {
      setCategories([...categories, data]);
      // Auto select new category
      onChange([...selectedCategoryIds, data.id]);
      setNewCatName('');
      setIsAdding(false);
    }
    setLoading(false);
  };

  const toggleCategory = (id) => {
    if (selectedCategoryIds.includes(id)) {
      onChange(selectedCategoryIds.filter(c => c !== id));
    } else {
      onChange([...selectedCategoryIds, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {categories.map(c => {
          const isSelected = selectedCategoryIds.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCategory(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
                isSelected 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {isSelected && <Check size={12} strokeWidth={3} />}
              {c.name}
            </button>
          );
        })}
        
        {/* Add Button */}
        {!isAdding ? (
          <button 
            type="button" 
            onClick={() => setIsAdding(true)} 
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-dashed border-gray-300 text-gray-400 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 flex items-center gap-1 transition-all"
          >
            <Plus size={14} /> เพิ่มหมวด
          </button>
        ) : (
          <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2">
            <input 
              className="w-32 px-2 py-1 text-xs border rounded-lg outline-none focus:border-indigo-500"
              placeholder="ชื่อหมวด..."
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              autoFocus
            />
            <button type="button" onClick={addCategory} disabled={loading} className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"><Check size={14}/></button>
            <button type="button" onClick={() => setIsAdding(false)} className="p-1 bg-gray-200 text-gray-500 rounded hover:bg-gray-300"><X size={14}/></button>
          </div>
        )}
      </div>
      {selectedCategoryIds.length === 0 && <p className="text-[10px] text-red-400 ml-1">* กรุณาเลือกอย่างน้อย 1 หมวดหมู่</p>}
    </div>
  );
};

export default CategoryManager;