import React from 'react';
import OrderListItem from './OrderListItem';
import { FileText } from 'lucide-react';

const OrderList = ({ orders, showProfit, onSelect, focusIds, onToggleFocus }) => {
  if (orders.length === 0) return (
    <div className="p-20 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
      <FileText size={48} className="mx-auto text-gray-300 mb-4"/>
      <p className="text-gray-500">ยังไม่มีรายการสั่งซื้อ</p>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left">
          <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">ลูกค้า (Customer)</th>
              <th className="px-6 py-4 w-[30%]">สินค้าหลัก (Main Item)</th>
              <th className="px-6 py-4 text-center">จำนวน</th>
              <th className="px-6 py-4">เลขที่ / วันที่</th>
              <th className="px-6 py-4 text-center">สถานะ</th>
              <th className="px-6 py-4 text-center">สถานะโครง</th>
              <th className="px-6 py-4 text-right">ยอดขายรวม</th>
              {showProfit && <th className="px-6 py-4 text-right text-emerald-600 bg-emerald-50/30">กำไรรวม</th>}
            </tr>
          </thead>
          <tbody>
            {orders.map(o => <OrderListItem key={o.id} order={o} showProfit={showProfit} onClick={() => onSelect(o)} focused={focusIds?.has(String(o.id))} onToggleFocus={onToggleFocus ? () => onToggleFocus(o.id) : null} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default OrderList;
