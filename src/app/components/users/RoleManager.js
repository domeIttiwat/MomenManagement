import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, CheckCircle, AlertCircle, RefreshCw, Loader2, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';

// รายการระบบและสิทธิ์ที่ทำได้
const RESOURCES = [
  { id: 'dashboard', label: 'ภาพรวม (Dashboard)' },
  { id: 'products', label: 'สินค้า (Products)' },
  { id: 'categories', label: 'หมวดหมู่สินค้า (Categories)' },
  { id: 'orders', label: 'คำสั่งซื้อ (Orders)' },
  { id: 'customers', label: 'ลูกค้า (Customers)' },
  { id: 'services', label: 'งานบริการ/ซ่อม (Services)' },
  { id: 'assembly', label: 'งานประกอบ (Assembly)' },
  { id: 'marketing', label: 'การตลาด (Marketing)' },
  { id: 'stock', label: 'สต๊อกสินค้า (Stock)' },
  { id: 'procurement', label: 'สั่งของ / Supplier (Procurement)' },
  { id: 'finance', label: 'การจัดการเงิน (Finance)' },
  { id: 'users', label: 'จัดการทีมงาน (Users)' },
];

const ACTIONS = [
  { id: 'view',        label: 'ดูข้อมูล' },
  { id: 'create',      label: 'เพิ่ม' },
  { id: 'edit',        label: 'แก้ไข' },
  { id: 'delete',      label: 'ลบ' },
  { id: 'show_cost',   label: 'เห็นราคาทุน', onlyFor: ['products', 'orders', 'services', 'procurement'] },
  { id: 'show_profit', label: 'เห็นกำไร',    onlyFor: ['products', 'orders', 'services'] },
  { id: 'prepare',     label: 'เตรียมของ',    onlyFor: ['assembly'] },
  { id: 'assemble',    label: 'ประกอบ/ทำ',   onlyFor: ['assembly'] },
  { id: 'qc',          label: 'QC / ตีกลับ', onlyFor: ['assembly'] },
  { id: 'stock_in',   label: 'รับเข้าสินค้า',   onlyFor: ['stock'] },
  { id: 'stock_out',  label: 'เบิกออกสินค้า',  onlyFor: ['stock'] },
  { id: 'delete_tx',  label: 'ลบประวัติสต๊อก', onlyFor: ['stock'] },
  { id: 'bom',        label: 'จัดการสูตร BOM', onlyFor: ['products'] },
  { id: 'mark_paid',    label: 'ระบุว่าจ่ายแล้ว', onlyFor: ['procurement'] },
  { id: 'mark_arrived', label: 'ระบุว่าของถึงแล้ว', onlyFor: ['procurement'] },
  { id: 'receive_stock', label: 'รับเข้าสต๊อก', onlyFor: ['procurement'] },
  { id: 'adjust', label: 'ปรับยอด/กระทบยอด', onlyFor: ['finance'] },
  { id: 'offset', label: 'เห็นหมวด Offset (ลับ)', onlyFor: ['finance'] },
  { id: 'close_period', label: 'ปิด/เปิดงวด (สิ้นเดือน)', onlyFor: ['finance'] },
];

const RoleManager = () => {
  const { realRole, impersonate, isImpersonating, stopImpersonating, role: currentRole, refreshPermissions } = useAuth();
  const canSimulate = realRole?.name === 'Supervisor' || realRole?.name === 'Admin';

  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [permissions, setPermissions] = useState({}); // { resource: { action: true/false } }
  const [loading, setLoading] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

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

    // Init default false for all resources + actions
    const permObj = {};
    RESOURCES.forEach(r => {
      permObj[r.id] = {};
      ACTIONS.forEach(a => { permObj[r.id][a.id] = false; });
    });

    // Fill existing data
    if (data) {
      data.forEach(p => {
        if (permObj[p.resource]) {
          permObj[p.resource] = { ...permObj[p.resource], ...p.actions };
        }
      });
    }

    // ถ้ามีข้อมูลแต่ไม่ครบทุก resource (เช่น resource ใหม่ถูกเพิ่มทีหลัง)
    // ให้บันทึก record ที่ขาดหายเพื่อให้ can() ทำงานถูกต้อง
    if (data && data.length > 0) {
      const savedResources = new Set(data.map(p => p.resource));
      const missingResources = RESOURCES.filter(r => !savedResources.has(r.id));
      if (missingResources.length > 0) {
        const insertData = missingResources.map(res => ({
          role_id: roleId,
          resource: res.id,
          actions: permObj[res.id],
        }));
        await supabase.from('role_permissions').insert(insertData);
      }
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

  const togglePermission = async (resId, actId) => {
    const newPermissions = {
      ...permissions,
      [resId]: {
        ...permissions[resId],
        [actId]: !permissions[resId][actId]
      }
    };
    setPermissions(newPermissions);
    await savePermissions(newPermissions);
  };

  const savePermissions = async (permData) => {
    if (!selectedRole) return;
    setLoading(true);
    try {
      const upsertData = RESOURCES.map(res => ({
        role_id: selectedRole.id,
        resource: res.id,
        actions: permData[res.id],
      }));
      await supabase.from('role_permissions').delete().eq('role_id', selectedRole.id);
      const { error } = await supabase.from('role_permissions').insert(upsertData);
      if (error) throw error;
      await refreshPermissions();
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } catch (err) {
      alert('บันทึกไม่สำเร็จ: ' + err.message);
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
          {roles.map(r => {
            const isSimulating = isImpersonating && currentRole?.id === r.id;
            return (
              <div key={r.id} className={`rounded-xl border transition-all ${selectedRole?.id === r.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'border-transparent hover:bg-gray-50'}`}>
                <div
                  onClick={() => handleRoleSelect(r)}
                  className={`p-3 cursor-pointer flex justify-between items-center ${selectedRole?.id === r.id ? 'text-indigo-700' : 'text-gray-600'}`}
                >
                  <div className="flex items-center gap-2">
                    <Shield size={16} className={selectedRole?.id === r.id ? 'text-indigo-500' : 'text-gray-400'}/>
                    <span className="font-medium text-sm">{r.name}</span>
                    {isSimulating && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">จำลองอยู่</span>}
                  </div>
                  {r.is_system && <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">System</span>}
                </div>
                {canSimulate && (
                  <div className="px-3 pb-2">
                    {isSimulating ? (
                      <button
                        onClick={stopImpersonating}
                        className="w-full text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Eye size={12}/> ออกจากโหมดจำลอง
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); impersonate(r.name); }}
                        className="w-full text-xs font-semibold text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Eye size={12}/> จำลองมุมมอง
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
               <div className="flex gap-3 items-center">
                 {loading ? (
                   <span className="flex items-center gap-1.5 text-gray-400 text-sm font-medium">
                     <Loader2 size={15} className="animate-spin"/> กำลังบันทึก...
                   </span>
                 ) : savedMsg ? (
                   <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium animate-in fade-in">
                     <CheckCircle size={15}/> บันทึกแล้ว
                   </span>
                 ) : null}
                 {!selectedRole.is_system && (
                   <button onClick={() => handleDeleteRole(selectedRole.id)} className="px-4 py-2 border border-red-100 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50">ลบตำแหน่ง</button>
                 )}
               </div>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-gray-50/30">
              <div className="space-y-3">
                {RESOURCES.map(res => {
                  const mainActions = ACTIONS.filter(a => !a.onlyFor);
                  const subActions  = ACTIONS.filter(a => a.onlyFor?.includes(res.id));
                  return (
                    <div key={res.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      {/* Resource header */}
                      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                        <span className="font-bold text-gray-800 text-sm">{res.label}</span>
                      </div>

                      {/* Main actions */}
                      <div className="px-5 py-3 flex flex-wrap gap-4">
                        {mainActions.map(act => {
                          const checked = permissions[res.id]?.[act.id] || false;
                          return (
                            <label key={act.id} className={`flex items-center gap-2 text-sm ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} group`}>
                              <div
                                onClick={() => !loading && togglePermission(res.id, act.id)}
                                className={`w-5 h-5 border-2 rounded transition-all flex items-center justify-center shrink-0 ${
                                  checked
                                    ? 'bg-indigo-600 border-indigo-600'
                                    : `border-gray-300 bg-white ${!loading ? 'group-hover:border-indigo-400' : ''}`
                                }`}
                              >
                                {checked && <CheckCircle size={14} className="text-white" strokeWidth={3} />}
                              </div>
                              <span className="text-gray-700 select-none">{act.label}</span>
                            </label>
                          );
                        })}
                      </div>

                      {/* Sub-actions (resource-specific) */}
                      {subActions.length > 0 && (
                        <div className="px-5 py-3 border-t border-dashed border-gray-100 bg-amber-50/40 flex flex-wrap gap-4">
                          <span className="text-xs text-amber-600 font-semibold w-full -mb-1">สิทธิ์เฉพาะ</span>
                          {subActions.map(act => {
                            const checked = permissions[res.id]?.[act.id] || false;
                            return (
                              <label key={act.id} className={`flex items-center gap-2 text-sm ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} group`}>
                                <div
                                  onClick={() => !loading && togglePermission(res.id, act.id)}
                                  className={`w-5 h-5 border-2 rounded transition-all flex items-center justify-center shrink-0 ${
                                    checked
                                      ? 'bg-amber-500 border-amber-500'
                                      : `border-amber-300 bg-white ${!loading ? 'group-hover:border-amber-400' : ''}`
                                  }`}
                                >
                                  {checked && <CheckCircle size={14} className="text-white" strokeWidth={3} />}
                                </div>
                                <span className="text-gray-700 select-none">{act.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-800 text-sm">
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
