import React, { useState, useEffect } from 'react';
import { Plus, X, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CategoryManager = ({ selectedCategoryId, onChange }) => {
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
    const { data } = await supabase.from('categories').insert([{ name: newCatName }]).select();
    if (data) {
      setCategories([...categories, data[0]]);
      onChange(data[0].id);
      setNewCatName('');
      setIsAdding(false);
    }
    setLoading(false);
  };

  const deleteCategory = async (id, e) => {
    e.stopPropagation(); // Prevent select triggering
    if(!window.confirm('ต้องการลบหมวดหมู่นี้ใช่หรือไม่?')) return;
    
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (!error) {
      setCategories(categories.filter(c => c.id !== id));
      if (selectedCategoryId == id) onChange(null);
    } else {
      alert('ไม่สามารถลบได้ เนื่องจากอาจมีสินค้าอยู่ในหมวดหมู่นี้');
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <select 
          value={selectedCategoryId || ''} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none px-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all outline-none font-medium text-gray-700"
        >
          <option value="">-- เลือกหมวดหมู่ --</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="absolute right-4 top-3.5 pointer-events-none text-gray-400">
          <ChevronsUpDown size={16} />
        </div>
      </div>

      {!isAdding ? (
        <div className="flex justify-between items-center px-1">
          <button 
            type="button" 
            onClick={() => setIsAdding(true)} 
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors"
          >
            <Plus size={14} /> สร้างหมวดหมู่ใหม่
          </button>
          {/* List for Managing Deletion (Optional UI: Show tags below) */}
          <div className="flex gap-2 overflow-x-auto max-w-[200px] no-scrollbar">
             {categories.map(c => (
               <div key={c.id} className="group shrink-0 text-[10px] bg-gray-100 px-2 py-0.5 rounded-md flex items-center gap-1 text-gray-600">
                 {c.name}
                 <button onClick={(e) => deleteCategory(c.id, e)} className="text-gray-400 hover:text-red-500 hidden group-hover:block"><X size={10}/></button>
               </div>
             ))}
          </div>
        </div>
      ) : (
        <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
          <input 
            type="text" 
            placeholder="ชื่อหมวดใหม่..." 
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            autoFocus
          />
          <button 
            type="button" 
            onClick={addCategory} 
            disabled={loading}
            className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Check size={18} />
          </button>
          <button 
            type="button" 
            onClick={() => setIsAdding(false)} 
            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default CategoryManager;