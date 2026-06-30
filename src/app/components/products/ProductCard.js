import React from 'react';
import { Package, Layers, Check, Bike, TrendingUp, Puzzle, Wrench } from 'lucide-react';

const ProductCard = ({ product, showCost, onClick }) => {
  let priceDisplay = `฿${product.sell_price.toLocaleString()}`;
  if (product.has_variants && product.product_variants && product.product_variants.length > 0) {
    const prices = product.product_variants.map(v => v.sell_price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    priceDisplay = minPrice === maxPrice 
      ? `฿${minPrice.toLocaleString()}` 
      : `฿${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`;
  }

  const { soldCount, totalSalesVal, totalProfitVal } = product.stats || { soldCount: 0, totalSalesVal: 0, totalProfitVal: 0 };
  const categoryName = product.categories?.name || 'Uncategorized';

  const getCategoryColor = (cat) => {
      if (!cat) return 'bg-gray-100 text-gray-600';
      const name = cat.toLowerCase();
      if (name.includes('scoot')) return 'bg-blue-100 text-blue-700 border-blue-200';
      if (name.includes('part') || name.includes('อะไหล่')) return 'bg-orange-100 text-orange-700 border-orange-200';
      if (name.includes('access')) return 'bg-purple-100 text-purple-700 border-purple-200';
      return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  return (
    <div onClick={onClick} className="bg-white rounded-2xl p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group border border-gray-100 flex flex-col h-full">
      <div className="aspect-[4/3] bg-gray-50 rounded-xl relative overflow-hidden mb-3">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300"><Package size={40} /></div>
        )}
        
        <div className="absolute top-2 left-2 flex flex-col gap-1">
           {product.has_variants && (
            <span className="bg-white/90 backdrop-blur-md text-purple-600 px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-1 border border-purple-100">
              <Layers size={10}/> สเปค
            </span>
          )}
          {/* FIX: เพิ่มไอคอนในการ์ด */}
          {product.hasBundles && (
            <span className="bg-white/90 backdrop-blur-md text-indigo-600 px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-1 border border-indigo-100">
              <Puzzle size={10}/> อะไหล่
            </span>
          )}
          {product.hasFasteners && (
            <span className="bg-white/90 backdrop-blur-md text-amber-600 px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-1 border border-amber-100">
              <Wrench size={10}/> น็อต
            </span>
          )}
          {product.requires_frame && (
            <span className="bg-white/90 backdrop-blur-md text-sky-700 px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-1 border border-sky-100">
              <Wrench size={10}/> ทำโครง
            </span>
          )}
        </div>
      </div>

      <div className="px-1 flex-1 flex flex-col">
        <h3 className="font-bold text-gray-800 line-clamp-2 mb-1 group-hover:text-orange-600 transition-colors h-[2.5em] leading-tight">{product.name}</h3>
        
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${getCategoryColor(categoryName)}`}>
             {categoryName}
          </span>
          <span className="text-[10px] text-gray-400 flex items-center gap-1 ml-auto">
             <TrendingUp size={10} /> {soldCount}
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
