import React from 'react';
import { Plus, Package } from 'lucide-react';

const ProductPage = ({ products }) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">คลังสินค้า ({products.length})</h2>
        <button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors">
          <Plus size={18} />
          <span>เพิ่มสินค้า</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Wrapper เพื่อให้ Scroll แนวนอนได้บนมือถือ */}
        <div className="overflow-x-auto">
          <div className="min-w-[600px]"> {/* กำหนดความกว้างขั้นต่ำเพื่อให้ตารางไม่เบี้ยว */}
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 text-sm">
              <div className="col-span-5">ชื่อสินค้า</div>
              <div className="col-span-3">หมวดหมู่</div>
              <div className="col-span-2">ราคา</div>
              <div className="col-span-2 text-center">สถานะ</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-100">
              {products.map((product) => (
                <div key={product.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-5 flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                      <Package size={20} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 truncate">{product.name}</p>
                      <p className="text-xs text-slate-500">ID: {product.id}</p>
                    </div>
                  </div>
                  <div className="col-span-3 text-slate-600 text-sm">{product.category}</div>
                  <div className="col-span-2 font-medium text-slate-800">฿{product.price.toLocaleString()}</div>
                  <div className="col-span-2 flex justify-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      product.stock > 10 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {product.stock} ชิ้น
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;