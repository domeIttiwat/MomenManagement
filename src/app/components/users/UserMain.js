import React, { useState, useEffect, useMemo } from 'react';
import { Users, Plus, Search, ShieldCheck, UserPlus, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import UserList from './UserList';
import UserDetail from './UserDetail';
import UserForm from './UserForm'; 
import AddMemberForm from './AddMemberForm'; // Import ฟอร์มใหม่
import RoleManager from './RoleManager';

const UserMain = () => {
  const [view, setView] = useState('list'); // list, detail, form, roles, add_member
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [search, setSearch] = useState('');

  const fetchAll = () => {
    fetchUsers();
    fetchRoles();
  };

  useEffect(() => { fetchAll(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    // ดึง users ทั้งหมด (รวมที่สร้าง manual ด้วย)
    const { data } = await supabase.from('profiles').select('*, roles(*)').order('created_at', { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  };

  const fetchRoles = async () => {
    const { data } = await supabase.from('roles').select('*');
    if (data) setRoles(data);
  };

  const handleDelete = async (id) => {
    if(!confirm('ยืนยันการลบผู้ใช้งานนี้?')) return;
    await supabase.from('profiles').delete().eq('id', id); // ลบจาก Profile ได้เลยเพราะปลดล็อก FK แล้ว
    fetchUsers();
    setView('list');
  };

  const handleRoleManagerBack = () => {
    fetchRoles(); 
    setView('list');
  };

  const updateStatus = async (id, status) => {
    await supabase.from('profiles').update({ status }).eq('id', id);
    fetchUsers();
  };

  const updateRole = async (userId, roleId) => {
    await supabase.from('profiles').update({ role_id: roleId }).eq('id', userId);
    fetchUsers();
  };

  const filteredUsers = useMemo(() => {
    let result = users;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(u => 
        u.first_name?.toLowerCase().includes(s) || 
        u.email?.toLowerCase().includes(s) ||
        u.nickname?.toLowerCase().includes(s)
      );
    }
    return result;
  }, [users, search]);

  // Views Routing
  if (view === 'roles') return (
    <div className="space-y-4 animate-in fade-in">
        <button onClick={handleRoleManagerBack} className="text-sm font-bold text-gray-500 hover:text-indigo-600 mb-2 flex items-center gap-1">← กลับหน้ารายชื่อ</button>
        <RoleManager />
    </div>
  );
  
  // เปลี่ยนจาก InviteGenerator เป็น AddMemberForm
  if (view === 'add_member') return (
    <div className="space-y-4 animate-in fade-in">
        <AddMemberForm 
           onCancel={() => setView('list')}
           onSuccess={() => { setView('list'); fetchUsers(); }}
           roles={roles}
        />
    </div>
  );

  if (view === 'detail' && selectedUser) return (
    <UserDetail 
      user={selectedUser} 
      roles={roles}
      onBack={() => setView('list')} 
      onEdit={() => setView('form')} 
      onDelete={() => handleDelete(selectedUser.id)}
    />
  );

  if (view === 'form') return (
    <UserForm 
      initialData={selectedUser} 
      roles={roles}
      onCancel={() => setView('list')} 
      onSuccess={() => { setView('list'); fetchUsers(); }} 
    />
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-indigo-600 to-violet-600 p-6 rounded-2xl shadow-lg text-white">
         <div>
           <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
             <Users size={32} className="text-indigo-100" /> จัดการทีมงาน
           </h1>
           <p className="text-indigo-100 mt-1 font-medium ml-1">สมาชิกทั้งหมด ({filteredUsers.length})</p>
         </div>
         <div className="flex gap-2">
            <button onClick={() => setView('roles')} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl font-medium backdrop-blur-sm transition-all text-sm border border-white/10">
                <ShieldCheck size={18} className="inline mr-2"/> จัดการตำแหน่ง
            </button>
            <button 
                onClick={() => setView('add_member')} 
                className="bg-white text-indigo-600 hover:bg-indigo-50 px-5 py-2.5 rounded-xl font-bold shadow-md flex items-center gap-2 transition-all active:scale-95"
            >
              <UserPlus size={18} /> เพิ่มทีมงาน
            </button>
         </div>
      </div>

      {/* List Toolbar */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex gap-3 justify-between items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20}/>
          <input 
            className="w-full pl-12 pr-4 py-3 bg-gray-50 hover:bg-gray-100 focus:bg-white border-transparent focus:border-indigo-500 rounded-xl transition-all outline-none text-gray-700 placeholder:text-gray-400 font-medium" 
            placeholder="ค้นหาชื่อ, ชื่อเล่น, อีเมล..." 
            value={search} onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <button onClick={fetchAll} className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors">
            <RefreshCw size={20} className={loading ? "animate-spin" : ""}/>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" size={32}/></div>
      ) : (
        <UserList 
            users={filteredUsers} 
            roles={roles}
            onSelect={(u) => { setSelectedUser(u); setView('detail'); }} 
            onUpdateStatus={updateStatus}
            onUpdateRole={updateRole}
        />
      )}
    </div>
  );
};
export default UserMain;