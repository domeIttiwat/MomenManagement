import React, { useState } from 'react';
import { Package, Layers, Check, Bike, TrendingUp } from 'lucide-react';

const ProductListItem = ({ product, showCost, onClick }) => {
  const [hovered, setHovered] = useState(false);
  
  // Logic หาช่วงราคา
  let priceDisplay = `฿${product.sell_price.toLocaleString()}`;
  let costDisplay = `฿${product.cost_price.toLocaleString()}`;
  let profitDisplay = `+฿${(product.sell_price - product.cost_price).toLocaleString()}`;

  if (product.has_variants && product.product_variants && product.product_variants.length > 0) {
    const prices = product.product_variants.map(v => v.sell_price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    priceDisplay = minPrice === maxPrice 
      ? `฿${minPrice.toLocaleString()}` 
      : `฿${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`;
    
    // Cost Range
    const costs = product.product_variants.map(v => v.cost_price);
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    costDisplay = minCost === maxCost ? `฿${minCost.toLocaleString()}` : `฿${minCost.toLocaleString()} - ...`;
    
    profitDisplay = "ดูรายละเอียด";
  }

  // Stats
  const { soldCount, timesOrdered, totalSalesVal, totalProfitVal } = product.stats || { soldCount: 0, timesOrdered: 0, totalSalesVal: 0, totalProfitVal: 0 };

  return (
    <tr 
      onClick={onClick} 
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group hover:bg-indigo-50/30 transition-colors cursor-pointer border-b border-gray-50 last:border-none"
    >
      <td className="px-8 py-5">
        <div className="flex items-start gap-4">
          {/* Image Stack */}
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
            <p className="font-bold text-gray-800 text-sm group-hover:text-indigo-600 transition-colors truncate">{product.name}</p>
            
            {/* Tags Row */}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 font-mono">{product.sku}</span>
              {product.has_variants && (
                <span className="flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded font-medium border border-purple-100">
                  <Layers size={10}/> {product.product_variants?.length} รุ่นย่อย
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-5">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          {product.categories?.name || 'ทั่วไป'}
        </span>
      </td>
      <td className="px-6 py-5 text-right">
        <span className="font-bold text-gray-900">{priceDisplay}</span>
      </td>
      
      {/* Sales Stats Columns */}
      <td className="px-6 py-5 text-center">
        <div className="flex flex-col items-center">
          <span className="font-bold text-gray-800 text-sm">{soldCount} ชิ้น</span>
          <span className="text-[10px] text-gray-400">{timesOrdered} ออเดอร์</span>
        </div>
      </td>
      <td className="px-6 py-5 text-right bg-indigo-50/30">
        <span className="font-bold text-indigo-700 text-sm">฿{totalSalesVal.toLocaleString()}</span>
      </td>

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