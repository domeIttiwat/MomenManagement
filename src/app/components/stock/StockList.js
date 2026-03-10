'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Search, PackageCheck, PackageMinus, ChevronDown, ChevronRight, AlertTriangle, RefreshCw, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import StockProductDetailModal from './StockProductDetailModal';

const StockList = ({ onStockIn, onStockOut, onNewTx }) => {
  const { profile, can } = useAuth();
  const [popupProduct, setPopupProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [stockMap, setStockMap] = useState({}); // key: productId or productId+variantId
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategoryName, setFilterCategoryName] = useState('');
  const [categories, setCategories] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [prodRes, stockRes, catRes] = await Promise.all([
      supabase.from('products').select(`*, product_variants(*), product_categories(category_id, category:category_id(name))`).order('name'),
      supabase.from('stock_items').select('id, product_id, variant_id, location_id, quantity, min_quantity, location:location_id(id, code, name, store:store_id(id, name))'),
      supabase.from('categories').select('id, name').order('name'),
    ]);

    const prods = prodRes.data || [];
    const stocks = stockRes.data || [];
    const cats = catRes.data || [];

    // Build stock map — aggregate quantities across all locations per product+variant
    const map = {};
    stocks.forEach(s => {
      const key = s.variant_id ? `${s.product_id}__${s.variant_id}` : `${s.product_id}__null`;
      if (!map[key]) map[key] = { quantity: 0, min_quantity: s.min_quantity || 0, locations: [] };
      map[key].quantity += s.quantity || 0;
      if ((s.min_quantity || 0) > map[key].min_quantity) map[key].min_quantity = s.min_quantity;
      if (s.location_id && s.location) map[key].locations.push(s.location);
    });

    setProducts(prods);
    setStockMap(map);
    setCategories(cats);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getStockForProduct = (product) => {
    if (!product.has_variants) {
      return stockMap[`${product.id}__null`] || null;
    }
    // Sum all variants
    const variantStocks = (product.product_variants || []).map(v => stockMap[`${product.id}__${v.id}`]);
    const total = variantStocks.reduce((sum, s) => sum + (s?.quantity || 0), 0);
    return { quantity: total, isAggregate: true };
  };

  const getStockForVariant = (productId, variantId) => {
    return stockMap[`${productId}__${variantId}`] || null;
  };

  const isLowStock = (stockItem, minQty = 0) => {
    if (!stockItem) return false;
    return stockItem.quantity <= (stockItem.min_quantity || minQty);
  };

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCategoryName || (p.product_categories || []).some(pc => pc.category?.name === filterCategoryName);
    return matchSearch && matchCat;
  });

  const toggleExpand = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              placeholder="ค้นหาสินค้า, SKU..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="py-2.5 px-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-teal-500"
            value={filterCategoryName} onChange={e => setFilterCategoryName(e.target.value)}>
            <option value="">ทุกหมวดหมู่</option>
            {[...new Map(categories.map(c => [c.name, c])).values()].map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors text-gray-500" title="รีเฟรช">
            <RefreshCw size={16} />
          </button>
          {can('stock', 'create') && (
            <button onClick={onNewTx} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm transition-colors shadow-sm">
              <Plus size={16} /> บันทึกสต๊อก
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-8"></th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">สินค้า</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">SKU</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">หมวดหมู่</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">สต๊อก</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="py-16 text-center text-gray-400">ไม่พบสินค้า</td></tr>
                )}
                {filtered.map(product => {
                  const stockInfo = getStockForProduct(product);
                  const hasVariants = product.has_variants && (product.product_variants || []).length > 0;
                  const isExpanded = expandedRows[product.id];
                  const catNames = (product.product_categories || []).map(pc => pc.category?.name).filter(Boolean).join(', ');
                  const isLow = !hasVariants && isLowStock(stockInfo);
                  const noStock = !stockInfo;

                  return (
                    <React.Fragment key={product.id}>
                      <tr
                        className={`border-b border-gray-50 cursor-pointer transition-colors group ${isLow ? 'bg-red-50/30 hover:bg-red-50/60' : 'hover:bg-teal-50/40'}`}
                        onClick={() => setPopupProduct(product)}
                      >
                        {/* Expand toggle */}
                        <td className="py-3 px-4">
                          {hasVariants && (
                            <button type="button" onClick={e => { e.stopPropagation(); toggleExpand(product.id); }} className="text-gray-400 hover:text-teal-600 transition-colors">
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800 group-hover:text-teal-700 transition-colors">{product.name}</span>
                            {isLow && <AlertTriangle size={14} className="text-red-500 shrink-0" title="สต๊อกต่ำ" />}
                            {hasVariants && <span className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded-full font-bold">{(product.product_variants || []).length} ตัวเลือก</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-500 text-xs hidden md:table-cell">{product.sku}</td>
                        <td className="py-3 px-4 text-gray-500 hidden lg:table-cell">{catNames || '—'}</td>
                        <td className="py-3 px-4 text-center">
                          {noStock ? (
                            <span className="text-xs text-gray-300">—</span>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className={`inline-block font-bold text-base px-3 py-1 rounded-xl ${isLow ? 'bg-red-100 text-red-700' : 'bg-teal-50 text-teal-700'}`}>
                                {stockInfo.quantity}
                              </span>
                              {stockInfo.locations?.length > 0 ? (
                                <div className="flex flex-wrap gap-1 justify-center max-w-[130px]">
                                  {stockInfo.locations.slice(0, 2).map((loc, i) => (
                                    <span key={i} className="text-[10px] font-mono text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                                      {loc.code}
                                    </span>
                                  ))}
                                  {stockInfo.locations.length > 2 && (
                                    <span className="text-[10px] text-gray-400">+{stockInfo.locations.length - 2}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-gray-400">ไม่ระบุที่จัดเก็บ</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                            {!hasVariants && noStock && can('stock', 'create') && (
                              <button onClick={() => onStockIn(product, null)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors">
                                <Plus size={13} /> เริ่มติดตาม
                              </button>
                            )}
                            {!hasVariants && !noStock && (
                              <>
                                {can('stock', 'stock_in') && (
                                  <button onClick={() => onStockIn(product, null)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                                    <PackageCheck size={13} /> รับเข้า
                                  </button>
                                )}
                                {can('stock', 'stock_out') && (
                                  <button onClick={() => onStockOut(product, null)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                                    <PackageMinus size={13} /> เบิกออก
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Variant rows */}
                      {hasVariants && isExpanded && (product.product_variants || []).map(variant => {
                        const vs = getStockForVariant(product.id, variant.id);
                        const vLow = isLowStock(vs);
                        return (
                          <tr key={variant.id} className={`border-b border-gray-50 bg-teal-50/20 ${vLow ? 'bg-red-50/30' : ''}`}>
                            <td className="py-2 px-4"></td>
                            <td className="py-2 px-4 pl-8">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0"></span>
                                <span className="text-sm text-gray-700">{variant.name}</span>
                                {vLow && <AlertTriangle size={12} className="text-red-500" />}
                              </div>
                            </td>
                            <td className="py-2 px-4 font-mono text-gray-400 text-xs hidden md:table-cell">{variant.sku}</td>
                            <td className="py-2 px-4 hidden lg:table-cell"></td>
                            <td className="py-2 px-4 text-center">
                              {!vs ? (
                                <span className="text-xs text-gray-300">—</span>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  <span className={`inline-block font-bold px-3 py-0.5 rounded-lg text-sm ${vLow ? 'bg-red-100 text-red-700' : 'bg-teal-50 text-teal-700'}`}>
                                    {vs.quantity}
                                  </span>
                                  {vs.locations?.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 justify-center">
                                      {vs.locations.slice(0, 2).map((loc, i) => (
                                        <span key={i} className="text-[10px] font-mono text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                                          {loc.code}
                                        </span>
                                      ))}
                                      {vs.locations.length > 2 && <span className="text-[10px] text-gray-400">+{vs.locations.length - 2}</span>}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-gray-400">ไม่ระบุ</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-4">
                              <div className="flex items-center justify-center gap-1">
                                {can('stock', 'stock_in') && (
                                  <button onClick={() => onStockIn(product, variant)} className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                                    <PackageCheck size={12} /> รับเข้า
                                  </button>
                                )}
                                {can('stock', 'stock_out') && (
                                  <button onClick={() => onStockOut(product, variant)} className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                                    <PackageMinus size={12} /> เบิกออก
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {popupProduct && (
        <StockProductDetailModal
          product={popupProduct}
          onClose={() => setPopupProduct(null)}
          onStockIn={can('stock', 'stock_in') ? () => { setPopupProduct(null); onStockIn(popupProduct, null); } : null}
          onStockOut={can('stock', 'stock_out') ? () => { setPopupProduct(null); onStockOut(popupProduct, null); } : null}
        />
      )}
    </div>
  );
};

export default StockList;
