import React from 'react';
import { MapPin, Package, Trophy } from 'lucide-react';

const TopRankings = ({ topProducts = [], topLocations = [] }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Top Products */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Trophy size={20} className="text-yellow-500" /> 10 อันดับสินค้าขายดี
        </h3>

        <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] pr-2">
          {topProducts.map((p, i) => (
            <div key={i} className="flex items-center gap-4 p-2 hover:bg-gray-50 rounded-xl transition-colors">
              <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm shrink-0 ${i < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{p.name}</p>
                <p className="text-[11px] text-gray-500">ขายได้ {p.quantity} ชิ้น</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-indigo-600">฿{p.total.toLocaleString()}</p>
              </div>
            </div>
          ))}
          {topProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Package size={32} className="mb-2 opacity-20" />
              <p className="text-sm">ไม่มีข้อมูลการขายในช่วงนี้</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Locations */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <MapPin size={20} className="text-red-500" /> พื้นที่ยอดนิยม (5 อันดับ)
        </h3>
        <div className="space-y-4">
          {topLocations.map((loc, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-10 rounded-full ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : i === 2 ? 'bg-yellow-500' : 'bg-gray-300'}`}></div>
                <div>
                  <span className="font-bold text-gray-800 text-sm block">{loc.province}</span>
                  <span className="text-[10px] text-gray-500">{loc.count} ออเดอร์</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">฿{loc.total.toLocaleString()}</p>
              </div>
            </div>
          ))}
          {topLocations.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <MapPin size={32} className="mb-2 opacity-20" />
              <p className="text-sm">ไม่มีข้อมูลที่อยู่</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopRankings;
