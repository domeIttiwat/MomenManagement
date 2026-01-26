import React from 'react';
import { Package, Layers, Check, Bike, TrendingUp } from 'lucide-react';

const ProductCard = ({ product, showCost, onClick }) => {
  // Logic หาช่วงราคา
  let priceDisplay = `฿${product.sell_price.toLocaleString()}`;
  if (product.has_variants && product.product_variants && product.product_variants.length > 0) {
    const prices = product.product_variants.map(v => v.sell_price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    priceDisplay = minPrice === maxPrice 
      ? `฿${minPrice.toLocaleString()}` 
      : `฿${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`;
  }

  // Stats
  const { soldCount, totalSalesVal, totalProfitVal } = product.stats || { soldCount: 0, totalSalesVal: 0, totalProfitVal: 0 };

  return (
    <div onClick={onClick} className="bg-white rounded-2xl p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group border border-gray-100 flex flex-col h-full">
      <div className="aspect-[4/3] bg-gray-50 rounded-xl relative overflow-hidden mb-3">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300"><Package size={40} /></div>
        )}
        
        <div className="absolute top-2 left-2 flex gap-1">
           {product.has_variants && (
            <span className="bg-white/90 backdrop-blur-md text-purple-600 px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-1 border border-purple-100">
              <Layers size={10}/> สเปค
            </span>
          )}
        </div>
      </div>

      <div className="px-1 flex-1 flex flex-col">
        <h3 className="font-bold text-gray-800 line-clamp-2 mb-1 group-hover:text-indigo-600 transition-colors h-[2.5em] leading-tight">{product.name}</h3>
        
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{product.categories?.name || 'Uncategorized'}</span>
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
             <TrendingUp size={10} /> ขายแล้ว {soldCount}
          </span>
        </div>
        
        <div className="mt-auto border-t border-gray-50 pt-3">
          <div className="flex justify-between items-end">
            <p className="text-lg font-bold text-gray-900">{priceDisplay}</p>
            <div className="text-right">
              <p className="text-[10px] text-gray-400">ยอดรวม</p>
              <p className="text-xs font-bold text-indigo-600">฿{totalSalesVal.toLocaleString()}</p>
            </div>
          </div>
          {showCost && (
            <div className="flex justify-between mt-2 text-[10px] bg-emerald-50 p-1.5 rounded border border-emerald-100">
              <span className="text-emerald-700 font-medium">กำไรรวม</span>
              <span className="text-emerald-700 font-bold">+฿{totalProfitVal.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ProductCard;