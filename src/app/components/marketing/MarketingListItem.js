import React from 'react';
import { Megaphone, Calendar, FileText } from 'lucide-react';

const MarketingListItem = ({ item, onClick }) => {
  return (
    <tr onClick={onClick} className="group hover:bg-pink-50/30 transition-colors cursor-pointer border-b border-gray-50 last:border-none">
      <td className="px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center text-pink-500 shrink-0 border border-pink-100 group-hover:scale-105 transition-transform">
             {item.images?.[0] ? <img src={item.images[0]} className="w-full h-full object-cover rounded-xl"/> : <Megaphone size={20}/>}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm group-hover:text-pink-600 transition-colors">{item.channel_name}</p>
            {item.title && <p className="text-xs text-gray-500 mt-0.5">{item.title}</p>}
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
           <Calendar size={14} className="text-gray-400"/>
           {new Date(item.expense_date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })}
        </div>
      </td>
      <td className="px-6 py-4">
        <p className="text-sm text-gray-600 line-clamp-1 max-w-[200px]">{item.notes || '-'}</p>
      </td>
      <td className="px-6 py-4 text-right">
        <span className="font-bold text-pink-600">฿{Number(item.amount).toLocaleString()}</span>
      </td>
    </tr>
  );
};
export default MarketingListItem;