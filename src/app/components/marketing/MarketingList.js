import React from 'react';
import MarketingListItem from './MarketingListItem';
import MarketingCard from './MarketingCard';
import { Megaphone } from 'lucide-react';

const MarketingList = ({ expenses, viewMode, onSelect }) => {
  if (expenses.length === 0) return (
    <div className="p-20 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
      <Megaphone size={48} className="mx-auto text-gray-300 mb-4"/>
      <p className="text-gray-500">ยังไม่มีรายการค่าใช้จ่าย</p>
    </div>
  );

  if (viewMode === 'card') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-20">
        {expenses.map(e => <MarketingCard key={e.id} item={e} onClick={() => onSelect(e)} />)}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left">
          <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">ช่องทาง / หัวข้อ</th>
              <th className="px-6 py-4">วันที่</th>
              <th className="px-6 py-4">หมายเหตุ</th>
              <th className="px-6 py-4 text-right">ยอดเงิน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {expenses.map(e => <MarketingListItem key={e.id} item={e} onClick={() => onSelect(e)} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default MarketingList;