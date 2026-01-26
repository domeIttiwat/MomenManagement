import React, { useState } from 'react';
import { ArrowLeft, Edit, Trash2, Calendar, DollarSign, Megaphone, FileText, X } from 'lucide-react';

const MarketingDetail = ({ expense, onBack, onEdit, onDelete }) => {
  const [lightbox, setLightbox] = useState(null);
  if (!expense) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right-4">
      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-h-[90vh] rounded-lg shadow-2xl"/>
          <button className="absolute top-4 right-4 text-white"><X size={24}/></button>
        </div>
      )}

      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium px-3 py-2 rounded-lg hover:bg-gray-50"><ArrowLeft size={20}/> กลับ</button>
        <div className="flex gap-2">
          <button onClick={onEdit} className="px-4 py-2 bg-gray-900 text-white rounded-xl flex items-center gap-2 hover:bg-black text-sm"><Edit size={16}/> แก้ไข</button>
          <button onClick={onDelete} className="px-4 py-2 bg-white text-red-600 border border-red-100 rounded-xl flex items-center gap-2 hover:bg-red-50 text-sm"><Trash2 size={16}/> ลบ</button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start mb-6 border-b border-gray-100 pb-6 gap-4">
           <div>
             <span className="bg-pink-50 text-pink-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 inline-block">{expense.channel_name}</span>
             <h1 className="text-3xl font-bold text-gray-900">{expense.title || 'ค่าใช้จ่ายการตลาด'}</h1>
             <div className="flex items-center gap-2 text-gray-500 mt-2">
               <Calendar size={18}/> {new Date(expense.expense_date).toLocaleDateString('th-TH', {dateStyle: 'long'})}
             </div>
           </div>
           <div className="text-left md:text-right bg-pink-50 p-6 rounded-2xl border border-pink-100 min-w-[200px]">
             <p className="text-pink-800 text-sm font-bold uppercase tracking-wide mb-1">ยอดชำระ</p>
             <p className="text-4xl font-black text-pink-600">฿{Number(expense.amount).toLocaleString()}</p>
           </div>
        </div>

        {expense.notes && (
          <div className="mb-8">
            <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><FileText size={18} className="text-pink-500"/> หมายเหตุ</h3>
            <p className="text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl">{expense.notes}</p>
          </div>
        )}

        {expense.images?.length > 0 && (
          <div>
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Megaphone size={18} className="text-pink-500"/> รูปภาพหลักฐาน</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {expense.images.map((img, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity border border-gray-200 shadow-sm" onClick={() => setLightbox(img)}>
                  <img src={img} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default MarketingDetail;