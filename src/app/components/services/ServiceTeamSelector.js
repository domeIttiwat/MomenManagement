import React, { useState, useEffect } from 'react';
import { UserPlus, X, User, Search, Briefcase } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const ServiceTeamSelector = ({ assignees = [], onChange }) => {
  const [users, setUsers] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('status', 'active');
      if (data) setUsers(data);
    };
    fetchUsers();
  }, []);

  const addAssignee = (user) => {
    if (assignees.some(a => a.user_id === user.id)) return;
    onChange([...assignees, { user_id: user.id, user, job_role: 'ช่างซ่อม' }]);
    setIsOpen(false);
  };

  const removeAssignee = (idx) => {
    onChange(assignees.filter((_, i) => i !== idx));
  };

  const updateRole = (idx, role) => {
    const newAssignees = [...assignees];
    newAssignees[idx].job_role = role;
    onChange(newAssignees);
  };

  const filteredUsers = users.filter(u => 
    (u.first_name + ' ' + u.last_name).toLowerCase().includes(search.toLowerCase()) ||
    u.nickname?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        {assignees.map((a, i) => (
          <div key={i} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 shadow-sm group">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold border border-indigo-100 shrink-0">
              {a.user?.first_name?.[0]}
            </div>
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
              <div>
                 <p className="text-sm font-bold text-gray-800 truncate">{a.user?.first_name} {a.user?.last_name}</p>
                 <p className="text-xs text-gray-500 truncate">{a.user?.nickname ? `(${a.user.nickname})` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase size={14} className="text-gray-400 shrink-0"/>
                <input 
                  className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-700 w-full"
                  value={a.job_role}
                  onChange={e => updateRole(i, e.target.value)}
                  placeholder="ระบุหน้าที่ (เช่น รับรถ, ช่างเครื่อง)..."
                />
              </div>
            </div>
            <button onClick={() => removeAssignee(i)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X size={18}/></button>
          </div>
        ))}
        
        <div className="relative">
          <button 
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center gap-2 text-gray-500 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all font-medium"
          >
            <UserPlus size={18} /> เพิ่มทีมงานรับผิดชอบ
          </button>

          {isOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
              <div className="absolute top-12 left-0 z-20 w-full md:w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-2 animate-in fade-in zoom-in-95">
                <div className="relative mb-2">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={14}/>
                    <input 
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="ค้นหาชื่อ..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      autoFocus
                    />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {filteredUsers.map(u => (
                    <div 
                      key={u.id} 
                      onClick={() => addAssignee(u)}
                      className="flex items-center gap-3 p-2 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 font-bold">
                        {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full rounded-full object-cover"/> : u.first_name?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">{u.first_name} {u.last_name}</p>
                        <p className="text-[10px] text-gray-400">{u.roles?.name || 'No Role'}</p>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && <p className="text-center text-xs text-gray-400 py-4">ไม่พบรายชื่อ</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
export default ServiceTeamSelector;