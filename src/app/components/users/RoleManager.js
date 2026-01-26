import React, { useState, useEffect } from 'react';
import { Shield, Plus, Save, Trash2, CheckCircle, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// รายการระบบและสิทธิ์ที่ทำได้
const RESOURCES = [
  { id: 'dashboard', label: 'ภาพรวม (Dashboard)' },
  { id: 'products', label: 'สินค้า (Products)' },
  { id: 'orders', label: 'คำสั่งซื้อ (Orders)' },
  { id: 'customers', label: 'ลูกค้า (Customers)' },
  { id: 'marketing', label: 'การตลาด (Marketing)' },
  { id: 'users', label: 'จัดการทีมงาน (Users)' },
];

const ACTIONS = [
  { id: 'view', label: 'ดูข้อมูล' },
  { id: 'create', label: 'เพิ่ม' },
  { id: 'edit', label: 'แก้ไข' },
  { id: 'delete', label: 'ลบ' },
  { id: 'show_cost', label: 'เห็นราคาทุน' }, // Special
  { id: 'show_profit', label: 'เห็นกำไร' },   // Special
];

const RoleManager = () => {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [permissions, setPermissions] = useState({}); // { resource: { action: true/false } }
  const [loading, setLoading] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    const { data } = await supabase.from('roles').select('*').order('id');
    if (data) {
      setRoles(data);
      // ถ้ายังไม่เลือก Role ให้เลือกตัวแรก
      if (!selectedRole && data.length > 0) handleRoleSelect(data[0]);
    }
    setLoading(false);
  };

  const fetchPermissions = async (roleId) => {
    // ดึง Permission เดิมของ Role นี้
    const { data } = await supabase.from('role_permissions').select('*').eq('role_id', roleId);
    
    // แปลงข้อมูล DB (Array) -> Object เพื่อใช้ง่ายใน UI
    const permObj = {};
    // Init default false
    RESOURCES.forEach(r => {
      permObj[r.id] = {};
      ACTIONS.forEach(a => permObj[r.id][a.id] = false);
    });

    // Fill data
    if (data) {
      data.forEach(p => {
        permObj[p.resource] = { ...permObj[p.resource], ...p.actions };
      });
    }
    setPermissions(permObj);
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    fetchPermissions(role.id);
  };

  const handleAddRole = async () => {
    if (!newRoleName.trim()) return;
    const { data, error } = await supabase.from('roles').insert([{ name: newRoleName }]).select().single();
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } else {
      setRoles([...roles, data]);
      handleRoleSelect(data);
      setNewRoleName('');
      setIsAdding(false);
    }
  };

  const handleDeleteRole = async (id) => {
    if (!confirm('ยืนยันลบตำแหน่งนี้? ผู้ใช้งานในตำแหน่งนี้จะเสียสิทธิ์ทันที')) return;
    await supabase.from('roles').delete().eq('id', id);
    const newRoles = roles.filter(r => r.id !== id);
    setRoles(newRoles);
    if (newRoles.length > 0) handleRoleSelect(newRoles[0]);
    else setSelectedRole(null);
  };

  const togglePermission = (resId, actId) => {
    setPermissions(prev => ({
      ...prev,
      [resId]: {
        ...prev[resId],
        [actId]: !prev[resId][actId]
      }
    }));
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    setLoading(true);
    
    try {
      // 1. Prepare Upsert Data
      const upsertData = RESOURCES.map(res => ({
        role_id: selectedRole.id,
        resource: res.id,
        actions: permissions[res.id]
      }));

      // 2. Clear old perms & Insert new (Simple Sync)
      // Note: Using delete+insert is safer for full sync here
      await supabase.from('role_permissions').delete().eq('role_id', selectedRole.id);
      const { error } = await supabase.from('role_permissions').insert(upsertData);
      
      if (error) throw error;
      alert('บันทึกสิทธิ์เรียบร้อย');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
      
      {/* Sidebar: Roles List */}
      <div className="md:col-span-1 bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-700">ตำแหน่งงาน</h3>
          <button onClick={fetchRoles} className="text-gray-400 hover:text-indigo-600"><RefreshCw size={16}/></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {roles.map(r => (
            <div 
              key={r.id}
              onClick={() => handleRoleSelect(r)}
              className={`p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all ${selectedRole?.id === r.id ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm' : 'hover:bg-gray-50 text-gray-600 border border-transparent'}`}
            >
              <div className="flex items-center gap-2">
                 <Shield size={16} className={selectedRole?.id === r.id ? 'text-indigo-500' : 'text-gray-400'}/>
                 <span className="font-medium text-sm">{r.name}</span>
              </div>
              {r.is_system && <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">System</span>}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-gray-100 bg-gray-50">
          {isAdding ? (
            <div className="flex gap-2 animate-in slide-in-from-bottom-2">
              <input 
                className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:border-indigo-500" 
                placeholder="ชื่อตำแหน่ง..."
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                autoFocus
              />
              <button onClick={handleAddRole} className="p-2 bg-indigo-600 text-white rounded-lg"><CheckCircle size={16}/></button>
              <button onClick={() => setIsAdding(false)} className="p-2 bg-white text-red-500 border rounded-lg"><Trash2 size={16}/></button>
            </div>
          ) : (
            <button 
              onClick={() => setIsAdding(true)} 
              className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl hover:border-indigo-400 hover:text-indigo-600 hover:bg-white transition-all text-sm font-bold flex items-center justify-center gap-2"
            >
              <Plus size={16}/> เพิ่มตำแหน่งใหม่
            </button>
          )}
        </div>
      </div>

      {/* Main: Permission Matrix */}
      <div className="md:col-span-3 bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        {selectedRole ? (
          <>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
               <div>
                 <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                   กำหนดสิทธิ์: <span className="text-indigo-600">{selectedRole.name}</span>
                 </h2>
                 <p className="text-sm text-gray-500 mt-1">{selectedRole.description || 'จัดการสิทธิ์การเข้าถึงสำหรับตำแหน่งนี้'}</p>
               </div>
               <div className="flex gap-3">
                 {!selectedRole.is_system && (
                   <button onClick={() => handleDeleteRole(selectedRole.id)} className="px-4 py-2 border border-red-100 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50">ลบตำแหน่ง</button>
                 )}
                 <button onClick={savePermissions} disabled={loading} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 flex items-center gap-2">
                   {loading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} บันทึกการเปลี่ยนแปลง
                 </button>
               </div>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-gray-50/30">
               <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                 <table className="w-full text-sm">
                   <thead>
                     <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 text-xs uppercase tracking-wider">
                       <th className="px-6 py-4 text-left font-bold w-48">ระบบงาน (Module)</th>
                       {ACTIONS.map(act => (
                         <th key={act.id} className={`px-4 py-4 text-center font-bold ${
                           ['show_cost', 'show_profit'].includes(act.id) ? 'bg-amber-50 text-amber-700' : ''
                         }`}>
                           {act.label}
                         </th>
                       ))}
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {RESOURCES.map(res => (
                       <tr key={res.id} className="hover:bg-gray-50 transition-colors">
                         <td className="px-6 py-4 font-bold text-gray-800">{res.label}</td>
                         {ACTIONS.map(act => {
                           const isSpecial = ['show_cost', 'show_profit'].includes(act.id);
                           // บาง Module อาจไม่มี cost/profit ให้ซ่อน checkbox
                           const isHidden = isSpecial && ['users', 'marketing'].includes(res.id); 

                           return (
                             <td key={act.id} className={`px-4 py-4 text-center ${isSpecial ? 'bg-amber-50/30' : ''}`}>
                               {!isHidden && (
                                 <label className="relative inline-flex items-center justify-center cursor-pointer group">
                                   <input 
                                     type="checkbox" 
                                     className="peer sr-only"
                                     checked={permissions[res.id]?.[act.id] || false}
                                     onChange={() => togglePermission(res.id, act.id)}
                                   />
                                   <div className={`w-5 h-5 border-2 rounded transition-all flex items-center justify-center ${
                                     permissions[res.id]?.[act.id] 
                                       ? (isSpecial ? 'bg-amber-500 border-amber-500' : 'bg-indigo-600 border-indigo-600') 
                                       : 'border-gray-300 bg-white group-hover:border-indigo-400'
                                   }`}>
                                     {permissions[res.id]?.[act.id] && <CheckCircle size={14} className="text-white" strokeWidth={3} />}
                                   </div>
                                 </label>
                               )}
                             </td>
                           );
                         })}
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
               
               <div className="mt-6 flex gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-800 text-sm">
                 <AlertCircle size={20} className="shrink-0"/>
                 <p>
                   <b>คำแนะนำ:</b> สิทธิ์การ "เห็นราคาทุน/กำไร" เป็นข้อมูลความลับ ควรระมัดระวังในการให้สิทธิ์ 
                   ส่วนสิทธิ์ "ลบ" ควรจำกัดเฉพาะ Admin หรือ Supervisor เท่านั้น
                 </p>
               </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
             <Shield size={48} className="mb-4 text-gray-200"/>
             <p>เลือกตำแหน่งงานทางซ้ายเพื่อจัดการสิทธิ์</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleManager;