import React from 'react';
import { ArrowLeft, Edit, Trash2, Shield, Phone, Mail, User, CheckCircle, Ban } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const UserDetail = ({ user, roles, onBack, onEdit, onDelete }) => {
  if (!user) return null;

  // ฟังก์ชันเปลี่ยนสถานะด่วน
  const toggleStatus = async (newStatus) => {
    await supabase.from('profiles').update({ status: newStatus }).eq('id', user.id);
    onBack(); // กลับไปหน้า List เพื่อ refresh (หรือจะทำ refresh ในนี้ก็ได้)
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right-4">
      {/* Navbar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
          <ArrowLeft size={20} /> กลับหน้ารายชื่อ
        </button>
        <div className="flex gap-2">
          {user.status === 'pending' && (
             <button onClick={() => toggleStatus('active')} className="px-4 py-2 bg-green-600 text-white rounded-xl flex items-center gap-2 hover:bg-green-700 font-medium text-sm shadow-lg shadow-green-200"><CheckCircle size={16}/> อนุมัติการใช้งาน</button>
          )}
          {user.status === 'active' && (
             <button onClick={() => toggleStatus('suspended')} className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl flex items-center gap-2 hover:bg-amber-100 font-medium text-sm"><Ban size={16}/> ระงับชั่วคราว</button>
          )}
          
          <button onClick={onEdit} className="px-4 py-2 bg-indigo-600 text-white rounded-xl flex items-center gap-2 hover:bg-indigo-700 font-medium text-sm shadow-lg shadow-indigo-200"><Edit size={16}/> แก้ไขข้อมูล</button>
          <button onClick={onDelete} className="px-4 py-2 bg-white text-red-600 border border-red-100 rounded-xl flex items-center gap-2 hover:bg-red-50 font-medium text-sm"><Trash2 size={16}/> ลบ</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="md:col-span-1">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div className="w-32 h-32 rounded-full bg-indigo-50 border-4 border-white shadow-lg mb-4 flex items-center justify-center overflow-hidden">
                    {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover"/> : <User size={48} className="text-indigo-300"/>}
                </div>
                <h2 className="text-xl font-bold text-gray-900">{user.first_name} {user.last_name}</h2>
                <p className="text-gray-500 font-medium mb-4">"{user.nickname || '-'}"</p>
                
                <div className="w-full border-t border-gray-100 pt-4 space-y-3">
                    <div className="flex items-center gap-3 text-gray-600 bg-gray-50 p-3 rounded-xl justify-center">
                        <Shield size={18} className="text-indigo-500"/>
                        <span className="font-bold text-indigo-900">{user.roles?.name || 'ไม่มีตำแหน่ง'}</span>
                    </div>
                    <div className={`flex items-center gap-2 text-sm justify-center px-3 py-1 rounded-full w-fit mx-auto font-bold uppercase tracking-wider ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {user.status}
                    </div>
                </div>
            </div>
        </div>

        {/* Info */}
        <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-6 text-lg flex items-center gap-2 border-b border-gray-100 pb-2">
                    <User size={20} className="text-indigo-500"/> ข้อมูลส่วนตัว
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">เบอร์โทรศัพท์</label>
                        <p className="text-gray-800 font-medium text-lg mt-1 flex items-center gap-2"><Phone size={16} className="text-gray-400"/> {user.phone || '-'}</p>
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">อีเมล (Login)</label>
                        <p className="text-gray-800 font-medium text-lg mt-1 flex items-center gap-2"><Mail size={16} className="text-gray-400"/> {user.email || 'user@example.com'}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-6 text-lg flex items-center gap-2 border-b border-gray-100 pb-2">
                    <Shield size={20} className="text-indigo-500"/> สิทธิ์การใช้งาน
                </h3>
                <p className="text-gray-600 leading-relaxed">
                    ผู้ใช้นี้อยู่ในตำแหน่ง <b>{user.roles?.name}</b> ซึ่งมีสิทธิ์การเข้าถึงดังนี้:
                </p>
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-500">
                    {/* ตรงนี้ในอนาคตดึง Permission จริงมาโชว์ได้ */}
                    <ul className="list-disc pl-5 space-y-1">
                        <li>เข้าถึง Dashboard</li>
                        <li>จัดการสินค้า (ตามสิทธิ์)</li>
                        <li>จัดการออเดอร์ (ตามสิทธิ์)</li>
                    </ul>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
export default UserDetail;