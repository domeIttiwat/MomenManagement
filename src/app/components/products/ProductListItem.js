import React, { useState } from 'react';
import { Package, Layers, Check, Bike, TrendingUp, Puzzle, Wrench } from 'lucide-react';

const ProductListItem = ({ product, showCost, onClick }) => {
  const [hovered, setHovered] = useState(false);
  
  if (!product) return null; // ป้องกันข้อมูลว่าง

  // 1. Safe Price Logic
  let priceDisplay = '฿0';
  let costDisplay = '฿0';
  let profitDisplay = '+฿0';

  const sellPrice = Number(product.sell_price) || 0;
  const hasBaseCost = product.cost_price !== null && product.cost_price !== undefined && product.cost_price !== '';
  const costPrice = hasBaseCost ? (Number(product.cost_price) || 0) : null;

  if (product.has_variants && product.product_variants && product.product_variants.length > 0) {
    const prices = product.product_variants.map(v => Number(v.sell_price) || 0);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    priceDisplay = minPrice === maxPrice 
      ? `฿${minPrice.toLocaleString()}` 
      : `฿${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`;
    
    const costs = product.product_variants
      .filter(v => v.cost_price !== null && v.cost_price !== undefined && v.cost_price !== '')
      .map(v => Number(v.cost_price) || 0);
    if (costs.length > 0) {
      const minCost = Math.min(...costs);
      costDisplay = `เริ่ม ฿${minCost.toLocaleString()}`;
      profitDisplay = "ดูรายละเอียด";
    } else {
      costDisplay = 'ยังไม่ระบุต้นทุน';
      profitDisplay = 'ยังไม่ระบุต้นทุน';
    }
  } else {
    priceDisplay = `฿${sellPrice.toLocaleString()}`;
    costDisplay = hasBaseCost ? `฿${costPrice.toLocaleString()}` : 'ยังไม่ระบุต้นทุน';
    profitDisplay = hasBaseCost ? `+฿${(sellPrice - costPrice).toLocaleString()}` : 'ยังไม่ระบุต้นทุน';
  }

  // 2. Safe Stats Logic
  const stats = product.stats || {};
  const soldCount = stats.soldCount || 0;
  const timesOrdered = stats.timesOrdered || 0;
  const totalSalesVal = stats.totalSalesVal || 0;
  const totalProfitVal = stats.totalProfitVal || 0;

  // 3. Safe Category Logic (รองรับทั้งแบบชื่อเดียวและหลายชื่อ)
  let displayCategories = [];
  if (product.categoryNames && Array.isArray(product.categoryNames) && product.categoryNames.length > 0) {
    displayCategories = product.categoryNames;
  } else if (product.categories?.name) {
    displayCategories = [product.categories.name];
  }

  const getCategoryColor = (cat) => {
      if (!cat) return 'bg-gray-100 text-gray-600 border-gray-200';
      const name = String(cat).toLowerCase();
      if (name.includes('scoot')) return 'bg-blue-100 text-blue-700 border-blue-200';
      if (name.includes('part') || name.includes('อะไหล่')) return 'bg-orange-100 text-orange-700 border-orange-200';
      if (name.includes('access')) return 'bg-purple-100 text-purple-700 border-purple-200';
      if (name.includes('wheel') || name.includes('l')) return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  return (
    <tr 
      onClick={onClick} 
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group hover:bg-orange-50/30 transition-colors cursor-pointer border-b border-gray-50 last:border-none"
    >
      {/* Column 1: Product Info */}
      <td className="px-8 py-5">
        <div className="flex items-start gap-4">
          <div className="relative w-16 h-16 shrink-0">
             <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden shadow-sm border border-gray-100 absolute top-0 left-0 z-10">
                {product.images?.[0] ? (
                  <img src={product.images[0]} className="w-full h-full object-cover"/>
                ) : <div className="flex items-center justify-center h-full text-gray-300"><Package size={20}/></div>}
             </div>
             {product.images?.length > 1 && (
               <div className="absolute top-1 left-1 w-16 h-16 bg-gray-200 rounded-xl -z-0 scale-95 origin-top-left"></div>
             )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 text-sm group-hover:text-orange-600 transition-colors truncate">{product.name || 'ชื่อสินค้า'}</p>
            
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 font-mono">{product.sku || '-'}</span>
              
              {product.has_variants && (
                <span className="flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded font-medium border border-purple-100">
                  <Layers size={10}/> สเปค
                </span>
              )}
              {/* ไอคอน อะไหล่ */}
              {product.hasBundles && (
                <span className="flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-medium border border-indigo-100" title="มีอะไหล่ประกอบ">
                  <Puzzle size={10}/> อะไหล่
                </span>
              )}
              {/* ไอคอน น็อต */}
              {product.hasFasteners && (
                <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium border border-amber-100" title="มีข้อมูลน็อต">
                  <Wrench size={10}/> น็อต
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Column 2: Category */}
      <td className="px-6 py-5">
        <div className="flex flex-wrap gap-1">
          {displayCategories.length > 0 ? (
            displayCategories.map((cat, i) => (
              <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border ${getCategoryColor(cat)}`}>
                {cat}
              </span>
            ))
          ) : (
            <span className="text-gray-400 text-xs">-</span>
          )}
        </div>
      </td>

      {/* Column 3: Price */}
      <td className="px-6 py-5 text-right">
        <span className="font-bold text-gray-900">{priceDisplay}</span>
      </td>
      
      {/* Column 4: Sold Count */}
      <td className="px-6 py-5 text-center">
        <div className="flex flex-col items-center">
          <span className="font-bold text-gray-800 text-sm">{soldCount} ชิ้น</span>
          <span className="text-[10px] text-gray-400">{timesOrdered} ออเดอร์</span>
        </div>
      </td>

      {/* Column 5: Total Sales */}
      <td className="px-6 py-5 text-right bg-indigo-50/30">
        <span className="font-bold text-indigo-700 text-sm">฿{totalSalesVal.toLocaleString()}</span>
      </td>

      {/* Optional Columns: Cost & Profit */}
      {showCost && (
        <>
          <td className="px-6 py-5 text-right bg-amber-50/20">
            <span className="text-sm font-medium text-amber-700">{costDisplay}</span>
          </td>
          <td className="px-6 py-5 text-right bg-emerald-50/20">
            <span className="text-sm font-bold text-emerald-600">{profitDisplay}</span>
          </td>
          <td className="px-6 py-5 text-right bg-emerald-100/20">
            <span className="text-sm font-black text-emerald-700">+฿{totalProfitVal.toLocaleString()}</span>
          </td>
        </>
      )}
    </tr>
  );
};
export default ProductListItem;
