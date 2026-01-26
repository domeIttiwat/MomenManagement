import React from 'react';
import { MapPin, Package, Trophy } from 'lucide-react';

const TopRankings = ({ topProducts, topLocations }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top Products */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Trophy size={20} className="text-yellow-500" /> สินค้าขายดี 5 อันดับแรก
        </h3>
        <div className="space-y-4">
          {topProducts.map((p, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="font-bold text-gray-300 w-4 text-center">{i + 1}</div>
              <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                {p.image ? <img src={p.image} className="w-full h-full object-cover"/> : <Package className="p-2 text-gray-400 w-full h-full"/>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{p.name}</p>
                <p className="text-xs text-gray-500">ขายได้ {p.quantity} ชิ้น</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-indigo-600">฿{p.total.toLocaleString()}</p>
              </div>
            </div>
          ))}
          {topProducts.length === 0 && <p className="text-center text-gray-400 text-sm py-4">ไม่มีข้อมูลสินค้า</p>}
        </div>
      </div>

      {/* Top Locations */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <MapPin size={20} className="text-red-500" /> พื้นที่ยอดนิยม
        </h3>
        <div className="space-y-3">
          {topLocations.map((loc, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-8 rounded-full ${i===0?'bg-red-500':i===1?'bg-orange-500':'bg-yellow-500'}`}></div>
                <span className="font-bold text-gray-700">{loc.province}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">{loc.count} ออเดอร์</p>
                <p className="text-[10px] text-gray-500">฿{loc.total.toLocaleString()}</p>
              </div>
            </div>
          ))}
          {topLocations.length === 0 && <p className="text-center text-gray-400 text-sm py-4">ไม่มีข้อมูลที่อยู่</p>}
        </div>
      </div>
    </div>
  );
};

export default TopRankings;