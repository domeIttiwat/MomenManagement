import React from 'react';
import CustomerCard from './CustomerCard';
import CustomerListItem from './CustomerListItem';
import { UserX } from 'lucide-react';

const CustomerList = ({ customers, viewMode, onSelect }) => {
  if (customers.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
      <div className="bg-white p-4 rounded-full shadow-sm mb-4"><UserX size={40} className="text-gray-300" /></div>
      <p className="text-gray-500 font-medium">ไม่พบข้อมูลลูกค้า</p>
    </div>
  );

  if (viewMode === 'card') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {customers.map(c => <CustomerCard key={c.id} customer={c} onClick={() => onSelect(c)} />)}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
              <th className="px-6 py-4">ลูกค้า</th>
              <th className="px-6 py-4">ช่องทางหลัก</th>
              <th className="px-6 py-4">จังหวัด</th>
              <th className="px-6 py-4">เบอร์โทร</th>
              <th className="px-6 py-4 text-right">ยอดซื้อ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {customers.map(c => <CustomerListItem key={c.id} customer={c} onClick={() => onSelect(c)} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default CustomerList;