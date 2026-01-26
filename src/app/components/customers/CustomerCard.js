import React, { useState, useEffect } from 'react';
import { Phone, User, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CustomerCard = ({ customer, onClick }) => {
  // สร้าง State เก็บยอดเงินจริง
  const [realTotalSpent, setRealTotalSpent] = useState(customer.total_spent || 0);

  // ดึงยอดรวมจากออเดอร์จริงของลูกค้าคนนี้
  useEffect(() => {
    const fetchTotal = async () => {
      if (!customer?.id) return;

      const { data } = await supabase
        .from('orders')
        .select('grand_total')
        .eq('customer_id', customer.id)
        .neq('status', 'Cancelled'); // ไม่นับออเดอร์ที่ยกเลิก
      
      if (data) {
        const sum = data.reduce((acc, curr) => acc + (curr.grand_total || 0), 0);
        setRealTotalSpent(sum);
      }
    };

    fetchTotal();
  }, [customer.id]);

  return (
    <div onClick={onClick} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="flex gap-3">
          <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden border-2 border-white shadow-sm shrink-0">
            {customer.images?.[0] ? (
              <img src={customer.images[0]} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-xl">
                <User size={24} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors truncate pr-2">
              {customer.first_name} {customer.last_name}
            </h3>
            <p className="text-sm text-gray-500">({customer.nickname || '-'})</p>
          </div>
        </div>
        <span className="px-2 py-1 bg-gray-50 text-gray-400 text-[10px] rounded-lg font-mono shrink-0">{customer.code}</span>
      </div>

      <div className="space-y-2 mb-4 flex-1">
        <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg">
          <Phone size={14} className="text-green-600 shrink-0"/> 
          <span className="truncate">{customer.phone || '-'}</span>
        </div>
        {customer.social_channels?.slice(0, 2).map((soc, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-gray-600 px-2">
            <MessageCircle size={12} className="text-blue-500 shrink-0"/> 
            <span className="truncate">{soc.type}: {soc.value}</span>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-gray-50 flex justify-between items-center text-xs">
        <span className="text-gray-400 truncate max-w-[50%]">{customer.address_parsed?.prov || 'ไม่ระบุจังหวัด'}</span>
        <div className="text-right">
          <p className="text-gray-400 text-[10px] uppercase tracking-wide">ยอดซื้อรวม</p>
          <p className="font-black text-indigo-600 text-sm">฿{realTotalSpent.toLocaleString()}</p>
        </div>
      </div>
      
      {customer.notes && (
        <div className="mt-3 text-[10px] text-gray-500 italic bg-yellow-50/50 p-2 rounded border border-yellow-100 line-clamp-2">
          {customer.notes}
        </div>
      )}
    </div>
  );
};
export default CustomerCard;