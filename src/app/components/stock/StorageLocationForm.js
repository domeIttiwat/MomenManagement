'use client';
import React, { useState } from 'react';
import { Save, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';

const StorageLocationForm = ({ storeId, initialData, onCancel, onSuccess }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState(initialData?.code || '');
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [sortOrder, setSortOrder] = useState(initialData?.sort_order ?? 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return alert('กรุณาระบุรหัสชั้นวาง');
    setLoading(true);
    try {
      if (initialData?.id) {
        const { error } = await supabase.from('storage_locations').update({
          code: code.trim(),
          name: name.trim() || null,
          description: description.trim() || null,
          sort_order: sortOrder,
          updated_at: new Date().toISOString(),
        }).eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('storage_locations').insert([{
          store_id: storeId,
          code: code.trim(),
          name: name.trim() || null,
          description: description.trim() || null,
          sort_order: sortOrder,
          created_by: profile?.id,
        }]);
        if (error) throw error;
      }
      onSuccess();
    } catch (err) {
      if (err.code === '23505') alert(`รหัสชั้นวาง "${code}" มีอยู่แล้วในคลังนี้`);
      else alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 rounded-xl transition-all outline-none text-gray-700 text-sm font-medium";

  return (
    <form onSubmit={handleSubmit} className="bg-teal-50/60 border border-teal-200 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-teal-800 text-sm">
          {initialData?.id ? 'แก้ไขชั้นวาง' : 'เพิ่มชั้นวางใหม่'}
        </h4>
        <button type="button" onClick={onCancel} className="p-1 hover:bg-teal-100 rounded-lg text-teal-500 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">
            รหัสชั้นวาง <span className="text-red-400">*</span>
          </label>
          <input
            className={inputClass}
            placeholder="เช่น A-01, ชั้น1, B-03"
            value={code}
            onChange={e => setCode(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">ชื่อ (ไม่บังคับ)</label>
          <input
            className={inputClass}
            placeholder="เช่น ชั้นสินค้าหนัก"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 mb-1">คำอธิบาย</label>
        <input
          className={inputClass}
          placeholder="รายละเอียดเพิ่มเติม..."
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl font-medium transition-colors"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-60"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          บันทึก
        </button>
      </div>
    </form>
  );
};

export default StorageLocationForm;
