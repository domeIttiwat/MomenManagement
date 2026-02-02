import React, { useState, useEffect } from 'react';
import { Phone, MapPin, User, DollarSign, Map } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CustomerListItem = ({ customer, onClick }) => {
  const mainContact = customer.social_channels?.[0];
  const [realTotalSpent, setRealTotalSpent] = useState(customer.total_spent || 0);

  useEffect(() => {
    const fetchTotal = async () => {
      if (!customer?.id) return;
      const { data } = await supabase
        .from('orders')
        .select('grand_total')
        .eq('customer_id', customer.id)
        .neq('status', 'Cancelled');
      
      if (data) {
        const sum = data.reduce((acc, curr) => acc + (curr.grand_total || 0), 0);
        setRealTotalSpent(sum);
      }
    };
    fetchTotal();
  }, [customer.id]);

  return (
    <tr onClick={onClick} className="group hover:bg-indigo-50/30 transition-colors cursor-pointer border-b border-gray-50 last:border-none">
      <td className="px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden shrink-0 border border-gray-100 shadow-sm group-hover:scale-105 transition-transform">
            {customer.images?.[0] ? (
              <img src={customer.images[0]} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 bg-indigo-50 text-indigo-300 font-bold text-lg">
                {customer.first_name?.[0]}
              </div>
            )}
          </div>
          <div>
            <p className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors text-base">
              {customer.first_name} {customer.last_name}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">ชื่อเล่น: {customer.nickname || '-'}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-5">
        {mainContact ? (
          <div className="text-sm flex flex-col">
            <span className="font-bold text-gray-700 text-xs uppercase tracking-wide mb-0.5">{mainContact.type}</span>
            <span className="text-gray-600">{mainContact.value}</span>
          </div>
        ) : <span className="text-gray-400 text-xs">-</span>}
      </td>
      <td className="px-6 py-5">
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg w-fit border border-gray-100">
                <MapPin size={14} className="text-indigo-400"/>
                {customer.address_parsed?.prov || 'ไม่ระบุ'}
            </div>
            {customer.location_url && (
                <a 
                    href={customer.location_url} 
                    target="_blank" 
                    rel="noreferrer" 
                    onClick={(e) => e.stopPropagation()} // ไม่ให้กดแล้วเด้งเข้าหน้า Detail
                    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    title="เปิดแผนที่"
                >
                    <Map size={16}/>
                </a>
            )}
        </div>
      </td>
      <td className="px-6 py-5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
          <Phone size={14} className="text-emerald-500"/>
          {customer.phone || '-'}
        </div>
      </td>
      <td className="px-6 py-5 text-right">
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">ยอดซื้อรวม</span>
          <div className="font-black text-indigo-600 text-base flex items-center gap-1">
             ฿{realTotalSpent.toLocaleString()}
          </div>
        </div>
      </td>
    </tr>
  );
};
export default CustomerListItem;