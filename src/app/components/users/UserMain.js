import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, ShieldCheck, UserPlus, Loader2, RefreshCw, CheckCircle, XCircle, Clock, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import UserList from './UserList';
import UserDetail from './UserDetail';
import UserForm from './UserForm';
import AddMemberForm from './AddMemberForm';
import RoleManager from './RoleManager';

const UserMain = () => {
  const [view, setView] = useState('list');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = () => { fetchUsers(); fetchRoles(); };
  useEffect(() => { fetchAll(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*, roles(*)')
      .neq('status', 'inactive')
      .order('created_at', { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  };

  const fetchRoles = async () => {
    const { data } = await supabase.from('roles').select('*');
    if (data) setRoles(data);
  };

  // Soft delete — ตั้ง status เป็น inactive แทนลบจริง
  const handleDelete = async (id) => {
    if (!confirm('ยืนยันการลบผู้ใช้งานนี้? (บัญชีจะถูกปิดและซ่อนจากระบบ)')) return;
    await supabase.from('profiles').update({ status: 'inactive' }).eq('id', id);
    fetchUsers();
    setView('list');
    showToast('ลบผู้ใช้งานเรียบร้อยแล้ว');
  };

  const handleRoleManagerBack = () => { fetchRoles(); setView('list'); };

  const updateStatus = async (id, status) => {
    await supabase.from('profiles').update({ status }).eq('id', id);
    fetchUsers();
  };

  // อัพเดท DB + selectedUser state ทันที (ไม่ต้อง back แล้วเข้าใหม่)
  const handleStatusChange = async (id, status) => {
    await updateStatus(id, status);
    setSelectedUser(prev => prev?.id === id ? { ...prev, status } : prev);
    const labels = { active: 'เปิดใช้งานแล้ว', suspended: 'ระงับการใช้งานแล้ว' };
    showToast(labels[status] || 'อัพเดทสถานะแล้ว');
  };

  const updateRole = async (userId, roleId) => {
    await supabase.from('profiles').update({ role_id: roleId }).eq('id', userId);
    fetchUsers();
  };

  const pendingUsers = useMemo(() => users.filter(u => u.status === 'pending'), [users]);

  const filteredUsers = useMemo(() => {
    let list = filterStatus === 'pending' ? users.filter(u => u.status === 'pending') : users;
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter(u =>
      u.first_name?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s) ||
      u.nickname?.toLowerCase().includes(s)
    );
  }, [users, search, filterStatus]);

  // Views Routing
  if (view === 'roles') return (
    <div className="space-y-4 animate-in fade-in">
      <button onClick={handleRoleManagerBack} className="text-sm font-bold text-gray-500 hover:text-indigo-600 mb-2 flex items-center gap-1">← กลับหน้ารายชื่อ</button>
      <RoleManager />
    </div>
  );

  if (view === 'add_member') return (
    <div className="space-y-4 animate-in fade-in">
      <AddMemberForm
        onCancel={() => setView('list')}
        onSuccess={() => { setView('list'); fetchUsers(); showToast('เพิ่มทีมงานเรียบร้อยแล้ว'); }}
        roles={roles}
      />
    </div>
  );

  if (view === 'detail' && selectedUser) return (
    <>
      <UserDetail
        user={selectedUser}
        roles={roles}
        onBack={() => setView('list')}
        onEdit={() => setView('form')}
        onDelete={() => handleDelete(selectedUser.id)}
        onStatusChange={handleStatusChange}
      />
      {toast && <Toast toast={toast} />}
    </>
  );

  if (view === 'form') return (
    <UserForm
      initialData={selectedUser}
      roles={roles}
      onCancel={() => setView(selectedUser?.status === 'pending' ? 'list' : 'detail')}
      onSuccess={() => { setView('list'); fetchUsers(); showToast('บันทึกข้อมูลเรียบร้อยแล้ว'); }}
    />
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in">
      {/* Toast */}
      {toast && <Toast toast={toast} />}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-indigo-600 to-violet-600 p-6 rounded-2xl shadow-lg text-white">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Users size={32} className="text-indigo-100" /> จัดการทีมงาน
          </h1>
          <p className="text-indigo-100 mt-1 font-medium ml-1">
            {filterStatus === 'pending' ? `รออนุมัติ (${filteredUsers.length})` : `สมาชิกทั้งหมด (${filteredUsers.length})`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('roles')} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl font-medium backdrop-blur-sm transition-all text-sm border border-white/10">
            <ShieldCheck size={18} className="inline mr-2"/> จัดการตำแหน่ง
          </button>
          <button onClick={() => setView('add_member')} className="bg-white text-indigo-600 hover:bg-indigo-50 px-5 py-2.5 rounded-xl font-bold shadow-md flex items-center gap-2 transition-all active:scale-95">
            <UserPlus size={18} /> เพิ่มทีมงาน
          </button>
        </div>
      </div>

      {/* Pending Banner */}
      {pendingUsers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Clock size={18} className="text-amber-600 shrink-0" />
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
              {pendingUsers.length}
            </span>
            <p className="text-sm font-semibold text-amber-800 shrink-0">คำขอรออนุมัติ</p>
            <p className="text-xs text-amber-600 truncate hidden sm:block">
              {pendingUsers.map(u => `${u.first_name} ${u.last_name}`.trim()).join(', ')}
            </p>
          </div>
          {filterStatus === 'pending' ? (
            <button onClick={() => setFilterStatus('all')} className="text-xs text-amber-700 font-semibold hover:underline flex items-center gap-1 shrink-0">
              <ArrowLeft size={12} /> ดูทั้งหมด
            </button>
          ) : (
            <button onClick={() => setFilterStatus('pending')} className="text-xs text-amber-700 font-semibold hover:underline shrink-0">
              ดูทั้งหมด →
            </button>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex gap-3 justify-between items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20}/>
          <input
            className="w-full pl-12 pr-4 py-3 bg-gray-50 hover:bg-gray-100 focus:bg-white border-transparent focus:border-indigo-500 rounded-xl transition-all outline-none text-gray-700 placeholder:text-gray-400 font-medium"
            placeholder="ค้นหาชื่อ, ชื่อเล่น, อีเมล..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button onClick={fetchAll} className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''}/>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" size={32}/></div>
      ) : (
        <UserList
          users={filteredUsers}
          roles={roles}
          onSelect={(u) => { setSelectedUser(u); setView(u.status === 'pending' ? 'form' : 'detail'); }}
          onUpdateStatus={updateStatus}
          onUpdateRole={updateRole}
        />
      )}
    </div>
  );
};

const Toast = ({ toast }) => (
  <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white font-medium text-sm animate-in slide-in-from-right-4 ${
    toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'
  }`}>
    {toast.type === 'error' ? <XCircle size={18}/> : <CheckCircle size={18}/>}
    {toast.msg}
  </div>
);

export default UserMain;
