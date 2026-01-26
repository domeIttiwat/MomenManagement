import React from 'react';
import { User, ChevronRight } from 'lucide-react';

const UserList = ({ users, onSelect }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
          <tr>
            <th className="px-6 py-4">ชื่อ - นามสกุล</th>
            <th className="px-6 py-4">ชื่อเล่น</th>
            <th className="px-6 py-4">ตำแหน่ง</th>
            <th className="px-6 py-4 text-center">สถานะ</th>
            <th className="px-6 py-4 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {users.map(u => (
            <tr 
                key={u.id} 
                onClick={() => onSelect(u)}
                className="hover:bg-indigo-50/30 cursor-pointer transition-colors group"
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0 border border-indigo-100">
                    {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full rounded-full object-cover"/> : <User size={20}/>}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{u.first_name} {u.last_name}</p>
                    <p className="text-xs text-gray-400">{u.email || 'No Email'}</p> 
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-gray-600">{u.nickname || '-'}</td>
              <td className="px-6 py-4">
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-medium border border-gray-200">
                    {u.roles?.name || 'ไม่มีตำแหน่ง'}
                </span>
              </td>
              <td className="px-6 py-4 text-center">
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                  u.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 
                  u.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                  {u.status}
                </span>
              </td>
              <td className="px-6 py-4 text-right text-gray-400">
                <ChevronRight size={18} className="ml-auto group-hover:text-indigo-400"/>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
export default UserList;