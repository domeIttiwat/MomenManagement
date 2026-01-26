import React from 'react';
import { Megaphone, Calendar } from 'lucide-react';

const MarketingCard = ({ item, onClick }) => {
  return (
    <div onClick={onClick} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-pink-200 transition-all cursor-pointer group flex flex-col h-full">
      <div className="relative aspect-video bg-gray-50 rounded-xl overflow-hidden mb-4 border border-gray-50">
        {item.images && item.images.length > 0 ? (
          <img src={item.images[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300"><Megaphone size={32}/></div>
        )}
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm text-gray-700">
          {item.channel_name}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
           <div>
             <h3 className="font-bold text-gray-800 text-sm line-clamp-1">{item.title || item.channel_name}</h3>
             <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1">
               <Calendar size={10}/> {new Date(item.expense_date).toLocaleDateString('th-TH')}
             </div>
           </div>
           <p className="font-bold text-pink-600 text-sm">฿{Number(item.amount).toLocaleString()}</p>
        </div>
        {item.notes && (
          <div className="mt-auto pt-2 border-t border-gray-50 text-[10px] text-gray-500 line-clamp-2">
            {item.notes}
          </div>
        )}
      </div>
    </div>
  );
};
export default MarketingCard;