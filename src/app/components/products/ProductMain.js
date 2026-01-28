import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Eye, EyeOff, LayoutGrid, List as ListIcon, Loader2, ArrowUpDown, Filter, Package, Settings, CheckSquare, Square } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ProductList from './ProductList';
import ProductForm from './ProductForm';
import ProductDetail from './ProductDetail';
import FastenerManager from './FastenerManager';

const ProductMain = () => {
  const [view, setView] = useState('list');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [showCost, setShowCost] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [search, setSearch] = useState('');
  
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]); 
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [sortOption, setSortOption] = useState('name_asc');

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchCategories(), fetchProducts()]);
    setLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data) setCategories(data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchProducts = async () => {
    try {
        // --- TIER 1: Full Fetch ---
        // FIX: ลบ 'categories(name)' ออก เพื่อแก้ปัญหา Ambiguous relationship
        // เราจะใช้ข้อมูลจาก 'product_categories(...)' แทน
        const { data: prodData, error } = await supabase
        .from('products')
        .select(`
            *, 
            product_categories(categories(name)),
            product_variants(sell_price, cost_price), 
            order_items(quantity, sell_price, cost_price), 
            product_bundles!parent_product_id(id), 
            product_fasteners(id)
        `)
        .order('created_at', { ascending: false });

        if (error) throw error;
        
        if (prodData) {
            processProductData(prodData);
            return; 
        }
    } catch (err) {
        console.warn('Tier 1 failed (Bundle/Fastener tables might be missing), trying Tier 2...', err.message);
        
        // --- TIER 2: Standard Fetch (Fallback) ---
        // FIX: ลบ 'categories(name)' ออกเช่นกัน
        try {
            const { data: stdData, error: stdError } = await supabase
            .from('products')
            .select(`
                *, 
                product_categories(categories(name)),
                product_variants(sell_price, cost_price), 
                order_items(quantity, sell_price, cost_price)
            `)
            .order('created_at', { ascending: false });
            
            if (stdError) throw stdError;
            if (stdData) {
                processProductData(stdData);
                return;
            }

        } catch (stdErr) {
            console.error('Tier 2 Fetch failed:', stdErr.message);

            // --- TIER 3: Basic Fetch ---
            try {
                const { data: basicData, error: basicError } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });
                
                if (basicError) throw basicError;
                if (basicData) {
                    processProductData(basicData);
                }
            } catch (criticalErr) {
                alert('ไม่สามารถโหลดข้อมูลสินค้าได้เลย');
            }
        }
    }
  };

  const processProductData = (data) => {
    if (!data) return;
    
    const productsWithStats = data.map(p => {
        // Stats Calculation
        const sales = p.order_items || [];
        const soldCount = sales.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const timesOrdered = sales.length;
        const totalSalesVal = sales.reduce((sum, item) => sum + ((item.sell_price || 0) * (item.quantity || 0)), 0);
        const totalCostVal = sales.reduce((sum, item) => sum + ((item.cost_price || 0) * (item.quantity || 0)), 0);
        const totalProfitVal = totalSalesVal - totalCostVal;

        const hasBundles = p.product_bundles?.length > 0;
        const hasFasteners = p.product_fasteners?.length > 0;

        // --- Robust Category Parsing ---
        const catSet = new Set();
        
        // 1. จากหมวดหมู่หลัก (categories) - (Legacy support if still needed/returned)
        if (p.categories) {
            if (Array.isArray(p.categories)) {
                p.categories.forEach(c => c.name && catSet.add(c.name));
            } else if (p.categories.name) {
                catSet.add(p.categories.name);
            }
        }

        // 2. จากหลายหมวดหมู่ (product_categories) - Main source now
        if (p.product_categories && Array.isArray(p.product_categories)) {
            p.product_categories.forEach(pc => {
                if (pc.categories) {
                    if (Array.isArray(pc.categories)) {
                        pc.categories.forEach(c => c.name && catSet.add(c.name));
                    } else if (pc.categories.name) {
                        catSet.add(pc.categories.name);
                    }
                }
            });
        }
        
        let categoryNames = Array.from(catSet);
        if (categoryNames.length === 0) categoryNames = ['Uncategorized'];

        return { 
            ...p, 
            stats: { soldCount, timesOrdered, totalSalesVal, totalProfitVal },
            hasBundles,
            hasFasteners,
            categoryNames, 
            categoryName: categoryNames[0] 
        };
    });
    setProducts(productsWithStats);
  };

  useEffect(() => { fetchAllData(); }, []);

  const toggleCategory = (catName) => {
    setSelectedCategories(prev => 
      prev.includes(catName) 
        ? prev.filter(c => c !== catName) 
        : [...prev, catName]
    );
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...products];

    // 1. Search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(p => p.name?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s));
    }

    // 2. Filter Category
    if (selectedCategories.length > 0) {
      result = result.filter(p => 
        p.categoryNames && p.categoryNames.some(cat => selectedCategories.includes(cat))
      );
    }

    switch(sortOption) {
      case 'newest': result.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)); break;
      case 'oldest': result.sort((a,b) => new Date(a.created_at) - new Date(b.created_at)); break;
      case 'sales_high': result.sort((a,b) => (b.stats?.totalSalesVal || 0) - (a.stats?.totalSalesVal || 0)); break;
      case 'price_high': result.sort((a,b) => (b.sell_price || 0) - (a.sell_price || 0)); break;
      case 'price_low': result.sort((a,b) => (a.sell_price || 0) - (b.sell_price || 0)); break;
      case 'name_asc': result.sort((a,b) => (a.name || '').localeCompare(b.name || '', 'th')); break;
      case 'name_desc': result.sort((a,b) => (b.name || '').localeCompare(a.name || '', 'th')); break;
    }

    return result;
  }, [products, search, selectedCategories, sortOption]);

  if (view === 'fasteners') return <FastenerManager onBack={() => setView('list')} />;
  if (view === 'form') return <ProductForm onCancel={() => setView('list')} onSuccess={() => { setView('list'); fetchAllData(); }} initialData={selectedProduct} />;
  
  if (view === 'detail' && selectedProduct) return (
    <ProductDetail 
      product={selectedProduct} 
      onBack={() => setView('list')} 
      onEdit={() => setView('form')} 
      showCost={showCost} 
      setShowCost={setShowCost} 
      onDelete={() => { fetchAllData(); setView('list'); }} 
    />
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-orange-500 to-amber-500 p-6 rounded-2xl shadow-lg text-white">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
             <Package size={32} className="text-orange-100" /> คลังสินค้า
           </h1>
           <p className="text-orange-100 mt-1 font-medium ml-1">จัดการรายการ ({filteredAndSorted.length})</p>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={() => setView('fasteners')} 
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-medium backdrop-blur-sm transition-all text-sm border border-white/10 flex items-center gap-2"
            >
                <Settings size={18}/> คลังน็อต & อะไหล่
            </button>
            <button 
                onClick={() => { setSelectedProduct(null); setView('form'); }} 
                className="bg-white text-orange-600 hover:bg-orange-50 px-6 py-3 rounded-xl font-bold shadow-md flex items-center gap-2 transition-all active:scale-95"
            >
            <Plus size={24} /> เพิ่มสินค้าใหม่
            </button>
        </div>
      </div>

      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20}/>
          <input 
            className="w-full pl-12 pr-4 py-3 bg-gray-50 hover:bg-gray-100 focus:bg-white border-transparent focus:border-indigo-500 rounded-xl transition-all outline-none text-gray-700 placeholder:text-gray-400 font-medium" 
            placeholder="ค้นหาชื่อสินค้า, SKU..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 px-2">
          
          {/* Multi-Select Category Filter */}
          <div className="relative">
             <button 
                onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${selectedCategories.length > 0 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-50 text-gray-600 border-transparent hover:bg-gray-100'}`}
             >
                <Filter size={16}/> 
                {selectedCategories.length === 0 ? 'ทุกหมวดหมู่' : `เลือก ${selectedCategories.length} หมวด`}
             </button>

             {showCategoryFilter && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowCategoryFilter(false)}/>
                  <div className="absolute top-12 left-0 z-20 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-2 animate-in fade-in zoom-in-95">
                    <div className="p-2 border-b border-gray-50 mb-1 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500">ตัวกรองหมวดหมู่</span>
                        {selectedCategories.length > 0 && <button onClick={() => setSelectedCategories([])} className="text-xs text-red-500 hover:underline">ล้างค่า</button>}
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                        {categories.length > 0 ? categories.map(c => {
                            const isSelected = selectedCategories.includes(c.name);
                            return (
                                <div key={c.id} onClick={() => toggleCategory(c.name)} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-300 bg-white'}`}>
                                        {isSelected && <CheckSquare size={14}/>}
                                    </div>
                                    <span className={`text-sm ${isSelected ? 'font-bold text-orange-700' : 'text-gray-700'}`}>{c.name}</span>
                                </div>
                            );
                        }) : (
                            <p className="text-center text-xs text-gray-400 py-2">ยังไม่มีหมวดหมู่</p>
                        )}
                    </div>
                  </div>
                </>
             )}
          </div>

          {/* Sort */}
          <div className="relative">
             <select 
               className="appearance-none bg-gray-50 hover:bg-gray-100 px-4 py-3 pl-10 pr-8 rounded-xl text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer border-none"
               value={sortOption}
               onChange={e => setSortOption(e.target.value)}
             >
               <option value="name_asc">ชื่อ ก-ฮ (A-Z)</option>
               <option value="name_desc">ชื่อ ฮ-ก (Z-A)</option>
               <option value="newest">ใหม่ล่าสุด</option>
               <option value="oldest">เก่าสุด</option>
               <option value="sales_high">ยอดขายสูงสุด</option>
               <option value="price_high">ราคา มาก-น้อย</option>
               <option value="price_low">ราคา น้อย-มาก</option>
             </select>
             <ArrowUpDown size={16} className="absolute left-3.5 top-3.5 text-gray-400 pointer-events-none"/>
          </div>

          <div className="w-px h-8 bg-gray-200 mx-2 hidden md:block" />
          
          <button 
            onClick={() => setShowCost(!showCost)} 
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${showCost ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            {showCost ? <Eye size={18}/> : <EyeOff size={18}/>}
            <span className="hidden sm:inline">{showCost ? 'ซ่อนต้นทุน' : 'แสดงต้นทุน'}</span>
          </button>
          
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><ListIcon size={20}/></button>
            <button onClick={() => setViewMode('card')} className={`p-2 rounded-lg transition-all ${viewMode === 'card' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={20}/></button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>
      ) : (
        <ProductList 
          products={filteredAndSorted} 
          viewMode={viewMode} 
          showCost={showCost} 
          onSelectProduct={(p) => { setSelectedProduct(p); setView('detail'); }} 
        />
      )}
    </div>
  );
};
export default ProductMain;