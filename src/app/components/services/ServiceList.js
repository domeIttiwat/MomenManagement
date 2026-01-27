import React from 'react';
import ServiceListItem from './ServiceListItem';
import ServiceCard from './ServiceCard'; // Import Card
import { Wrench } from 'lucide-react';

const ServiceList = ({ services, viewMode, onSelect }) => {
  if (services.length === 0) return (
    <div className="p-20 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
      <Wrench size={48} className="mx-auto text-gray-300 mb-4"/>
      <p className="text-gray-500">ยังไม่มีงานซ่อม</p>
    </div>
  );

  // Switch View Logic
  if (viewMode === 'card') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
        {services.map(s => <ServiceCard key={s.id} service={s} onClick={() => onSelect(s)} />)}
      </div>
    );
  }

  // Table View (Default)
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left">
          <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">เลขที่ / วันรับ</th>
              <th className="px-6 py-4">ลูกค้า</th>
              <th className="px-6 py-4 w-[25%]">อาการ / งานซ่อม</th>
              <th className="px-6 py-4 text-center">สถานะงาน</th>
              <th className="px-6 py-4 text-center">การชำระเงิน</th>
              <th className="px-6 py-4">ผู้รับผิดชอบ</th>
              <th className="px-6 py-4 text-right">ค่าใช้จ่าย</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {services.map(s => <ServiceListItem key={s.id} service={s} onClick={() => onSelect(s)} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default ServiceList;