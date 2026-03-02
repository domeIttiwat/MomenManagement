import React from 'react';
import { User, ChevronRight, Users } from 'lucide-react';

const STATUS_CONFIG = {
  active:    { cls: 'bg-green-50 text-green-700 border-green-200',  label: 'ใช้งานปกติ' },
  pending:   { cls: 'bg-amber-50 text-amber-700 border-amber-200',  label: 'รออนุมัติ' },
  suspended: { cls: 'bg-red-50 text-red-700 border-red-200',        label: 'ระงับการใช้งาน' },
  inactive:  { cls: 'bg-gray-100 text-gray-500 border-gray-200',    label: 'ปิดบัญชี' },
};

const UserList = ({ users, onSelect }) => {
  if (!users || users.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-20 text-center">
        <Users size={48} className="text-gray-200 mb-4"/>
        <p className="font-semibold text-gray-400">ไม่พบรายชื่อทีมงาน</p>
        <p className="text-sm text-gray-300 mt-1">ลองเปลี่ยนคำค้นหา หรือเพิ่มทีมงานใหม่</p>
      </div>
    );
  }

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
          {users.map(u => {
            const status = STATUS_CONFIG[u.status] || STATUS_CONFIG.pending;
            return (
              <tr
                key={u.id}
                onClick={() => onSelect(u)}
                className="hover:bg-indigo-50/30 cursor-pointer transition-colors group"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0 border border-indigo-100 overflow-hidden">
                      {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" alt=""/> : <User size={20}/>}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-gray-400">{u.email || 'ไม่มีอีเมล'}</p>
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
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide border ${status.cls}`}>
                    {status.label}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-gray-400">
                  <ChevronRight size={18} className="ml-auto group-hover:text-indigo-400"/>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
export default UserList;
