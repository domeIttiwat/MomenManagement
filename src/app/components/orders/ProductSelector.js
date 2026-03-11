import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Package, Layers, Box, Keyboard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ProductForm from '../products/ProductForm';

const ProductSelector = ({ onAddProduct }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isOpen, setIsOpen] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Keyboard Navigation State
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data) setCategories(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!isOpen && !search) return;

    const searchProd = async () => {
      try {
        let query = supabase.from('products').select('*, product_variants(*)').limit(15);

        if (search.trim()) {
          query = query.ilike('name', `%${search}%`);
        } else {
          query = query.order('created_at', { ascending: false });
        }

        if (selectedCategory !== 'All') {
          const cat = categories.find(c => c.name === selectedCategory);
          if (cat) query = query.eq('category_id', cat.id);
        }

        const { data } = await query;
        if (data) {
          setResults(data);
          setActiveIndex(-1); // Reset selection
        }
      } catch (err) {
        console.error(err);
      }
    };

    const timeout = setTimeout(searchProd, 300);
    return () => clearTimeout(timeout);
  }, [search, isOpen, selectedCategory, categories]);

  // Handle Keyboard Events
  const handleKeyDown = (e) => {
    if (!isOpen) {
        if (e.key === 'ArrowDown') setIsOpen(true);
        return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
      scrollActiveIntoView(activeIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
      scrollActiveIntoView(activeIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        const selected = results[activeIndex];
        if (!selected.has_variants) {
          handleAddItem(selected);
        } else {
          alert('สินค้านี้มีหลายตัวเลือก กรุณาใช้เมาส์คลิกเลือกรุ่นย่อย');
        }
      } else if (search && results.length === 0) {
          handleAddCustom();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const scrollActiveIntoView = (index) => {
    const element = document.getElementById(`prod-item-${index}`);
    if (element) element.scrollIntoView({ block: 'nearest' });
  };

  const handleAddItem = (product, variant = null) => {
    const item = {
      product_id: product.id,
      product_name: product.name,
      sku: variant ? variant.sku : product.sku,
      variant_name: variant ? variant.name : null,
      cost_price: variant ? variant.cost_price : product.cost_price,
      sell_price: variant ? variant.sell_price : product.sell_price,
      quantity: 1,
      is_custom: false
    };
    onAddProduct(item);
    setIsOpen(false);
    setSearch('');
  };

  const handleAddCustom = () => {
    onAddProduct({
      product_id: null,
      product_name: '',
      sku: '',
      variant_name: '',
      cost_price: 0,
      sell_price: 0,
      quantity: 1,
      is_custom: true,
      shouldFocus: true // เพิ่ม Flag เพื่อบอกให้ Auto Focus
    });
    setIsOpen(false);
    setSearch('');
  };

  const handleProductCreated = () => {
    setShowProductForm(false);
    setSearch(''); 
    setIsOpen(true); 
    alert('เพิ่มสินค้าเข้าระบบเรียบร้อย');
  };

  const modalContent = showProductForm ? (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-2">
          <ProductForm 
            onCancel={() => setShowProductForm(false)} 
            onSuccess={handleProductCreated} 
          /> 
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl transition-all outline-none font-medium"
            placeholder="พิมพ์ค้นหา... (กดลูกศร ขึ้น/ลง เพื่อเลือก)"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
          />
          <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16} />
          {isOpen && <div className="absolute right-3 top-2.5 text-[10px] text-gray-400 border border-gray-200 px-1.5 rounded hidden md:block">ESC to close</div>}
        </div>
        
        <button 
          type="button"
          onClick={handleAddCustom} 
          className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all whitespace-nowrap"
        >
          <Plus size={18}/> เพิ่มรายการเอง
        </button>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          <div className="absolute z-20 w-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 max-h-96 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col" ref={listRef}>
            
            {/* Toolbar */}
            <div className="sticky top-0 bg-white z-10 border-b border-gray-100">
              <div className="flex items-center justify-between p-2 bg-gray-50/50">
                <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1 pb-1">
                  <button type="button" onClick={() => setSelectedCategory('All')} className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${selectedCategory === 'All' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>ทั้งหมด</button>
                  {categories.map(c => (
                    <button key={c.id} type="button" onClick={() => setSelectedCategory(c.name)} className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${selectedCategory === c.name ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{c.name}</button>
                  ))}
                </div>
                <div className="pl-2 border-l border-gray-200 ml-2">
                   <button type="button" onClick={() => setShowProductForm(true)} className="text-xs flex items-center gap-1 text-indigo-600 font-bold hover:underline whitespace-nowrap"><Box size={14}/> สร้างสินค้าใหม่</button>
                </div>
              </div>
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto p-1">
              {results.length > 0 ? results.map((p, idx) => (
                <div 
                    key={p.id} 
                    id={`prod-item-${idx}`}
                    className={`border-b border-gray-50 last:border-none transition-colors duration-150 ${activeIndex === idx ? 'bg-indigo-50 ring-1 ring-indigo-200 z-10' : ''}`}
                >
                  {p.has_variants ? (
                    <div>
                      <div className="p-2 bg-gray-50/50 text-xs font-bold text-gray-500 px-3 flex items-center gap-2">
                        <Package size={12}/> {p.name}
                        {activeIndex === idx && <span className="ml-auto text-[10px] text-indigo-500">กด Enter เพื่อดูตัวเลือก</span>}
                      </div>
                      {p.product_variants?.map(v => (
                        <div key={v.id} onClick={() => handleAddItem(p, v)} className="p-2 pl-8 hover:bg-indigo-50 cursor-pointer flex justify-between items-center transition-colors">
                          <div className="flex items-center gap-2">
                            <Layers size={14} className="text-indigo-300"/>
                            <span className="text-sm text-gray-700">{v.name}</span>
                          </div>
                          <span className="text-sm font-bold text-indigo-600">฿{v.sell_price.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div onClick={() => handleAddItem(p)} className="p-3 hover:bg-indigo-50 cursor-pointer flex justify-between items-center transition-colors rounded-lg mx-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                          {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover"/> : <Package size={20} className="m-2.5 text-gray-400"/>}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">{p.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{p.sku}</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-indigo-600">฿{(p.sell_price ?? 0).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )) : (
                <div className="p-8 text-center text-sm text-gray-400 flex flex-col items-center">
                  <Package size={32} className="mb-2 opacity-20"/>
                  ไม่พบสินค้า
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {mounted && modalContent && createPortal(modalContent, document.body)}
    </div>
  );
};
export default ProductSelector;