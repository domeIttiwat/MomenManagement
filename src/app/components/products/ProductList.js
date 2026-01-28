import React from 'react';
import ProductListItem from './ProductListItem';
import { PackageOpen } from 'lucide-react';
import ProductCard from './ProductCard'; // Ensure Card is imported for switching

const ProductList = ({ products, viewMode, showCost, onSelectProduct }) => {
  // 1. ถ้าไม่มีสินค้า
  if (!products || products.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
      <div className="bg-white p-4 rounded-full shadow-sm mb-4"><PackageOpen size={40} className="text-gray-300" /></div>
      <p className="text-gray-500 font-medium">ไม่พบสินค้าในรายการ</p>
    </div>
  );

  // 2. ถ้าเป็นโหมดการ์ด
  if (viewMode === 'card') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
        {products.map(p => (
           <ProductCard key={p.id} product={p} showCost={showCost} onClick={() => onSelectProduct(p)} />
        ))}
      </div>
    );
  }

  // 3. ถ้าเป็นโหมดตาราง (List)
  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-8 py-5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider w-[300px]">สินค้า</th>
              <th className="px-6 py-5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">หมวดหมู่</th>
              <th className="px-6 py-5 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">ราคาขาย</th>
              {/* Stats Columns */}
              <th className="px-6 py-5 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">ขายไปแล้ว</th>
              <th className="px-6 py-5 text-right text-xs font-bold text-indigo-500 uppercase tracking-wider bg-indigo-50/30">ยอดขายรวม</th>
              
              {showCost && (
                <>
                  <th className="px-6 py-5 text-right text-xs font-bold text-amber-500 uppercase tracking-wider bg-amber-50/30">ต้นทุน</th>
                  <th className="px-6 py-5 text-right text-xs font-bold text-emerald-500 uppercase tracking-wider bg-emerald-50/30">กำไร</th>
                  <th className="px-6 py-5 text-right text-xs font-bold text-emerald-600 uppercase tracking-wider bg-emerald-100/30">กำไรรวม</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map(p => (
                <ProductListItem key={p.id} product={p} showCost={showCost} onClick={() => onSelectProduct(p)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default ProductList;