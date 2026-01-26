import React from 'react';
import { Search, MoreVertical } from 'lucide-react';

const CustomerPage = ({ customers }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">สมาชิก ({customers.length})</h2>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="ค้นหาลูกค้า..." 
            className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((customer) => (
          <div key={customer.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                {customer.name.charAt(0)}
              </div>
              <button className="text-slate-400 hover:text-slate-600">
                <MoreVertical size={18} />
              </button>
            </div>
            <h3 className="font-bold text-slate-800">{customer.name}</h3>
            <p className="text-sm text-slate-500 mb-4">{customer.email}</p>
            <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-sm">
              <span className="text-slate-600">{customer.phone}</span>
              <span className="text-blue-600 font-medium cursor-pointer hover:underline">ดูประวัติ</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomerPage;