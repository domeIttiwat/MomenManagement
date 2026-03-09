import React, { useState, useEffect } from 'react';
import { Tag, Plus, Pencil, Trash2, Check, X, ArrowLeft, Loader2, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { logAction } from '@/lib/auditLog';

const CategoryManagerPage = ({ onBack }) => {
  const { can, profile } = useAuth();
  const meRef = () => profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null;

  const [categories, setCategories] = useState([]);
  const [productCounts, setProductCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchCategories(), fetchProductCounts()]);
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
  };

  const fetchProductCounts = async () => {
    const { data } = await supabase
      .from('product_categories')
      .select('category_id');
    if (data) {
      const counts = {};
      data.forEach(row => {
        counts[row.category_id] = (counts[row.category_id] || 0) + 1;
      });
      setProductCounts(counts);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('categories')
      .insert([{ name: newName.trim() }])
      .select()
      .single();
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } else {
      await logAction({
        resource_type: 'product',
        resource_id: data.id,
        action: 'create',
        resource_label: `หมวดหมู่: ${data.name}`,
        new_data: { name: data.name },
        created_by: meRef(),
      });
      setCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'th')));
      setNewName('');
      setIsAdding(false);
    }
    setSaving(false);
  };

  const handleStartEdit = (cat) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const handleSaveEdit = async (cat) => {
    if (!editingName.trim() || editingName.trim() === cat.name) {
      setEditingId(null);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('categories')
      .update({ name: editingName.trim() })
      .eq('id', cat.id);
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } else {
      await logAction({
        resource_type: 'product',
        resource_id: cat.id,
        action: 'update',
        resource_label: `หมวดหมู่: ${cat.name}`,
        old_data: { name: cat.name },
        new_data: { name: editingName.trim() },
        created_by: meRef(),
      });
      setCategories(prev =>
        prev.map(c => c.id === cat.id ? { ...c, name: editingName.trim() } : c)
          .sort((a, b) => a.name.localeCompare(b.name, 'th'))
      );
    }
    setEditingId(null);
    setSaving(false);
  };

  const handleDelete = async (cat) => {
    const count = productCounts[cat.id] || 0;
    const msg = count > 0
      ? `หมวดหมู่ "${cat.name}" มีสินค้าอยู่ ${count} รายการ ยืนยันลบหมวดหมู่นี้?`
      : `ยืนยันลบหมวดหมู่ "${cat.name}"?`;
    if (!confirm(msg)) return;
    setSaving(true);
    await supabase.from('product_categories').delete().eq('category_id', cat.id);
    const { error } = await supabase.from('categories').delete().eq('id', cat.id);
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } else {
      await logAction({
        resource_type: 'product',
        resource_id: cat.id,
        action: 'delete',
        resource_label: `หมวดหมู่: ${cat.name}`,
        old_data: { name: cat.name },
        created_by: meRef(),
      });
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      setProductCounts(prev => { const n = { ...prev }; delete n[cat.id]; return n; });
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft size={16} /> กลับรายการสินค้า
        </button>
      </div>

      <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 rounded-2xl shadow-lg text-white">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Tag size={28} className="text-orange-100" /> จัดการหมวดหมู่สินค้า
        </h1>
        <p className="text-orange-100 mt-1 font-medium ml-1">
          {loading ? 'กำลังโหลด...' : `${categories.length} หมวดหมู่`}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Add row */}
        {can('categories', 'create') && (
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            {isAdding ? (
              <div className="flex gap-2 animate-in slide-in-from-top-2">
                <input
                  className="flex-1 px-4 py-2 border rounded-xl text-sm focus:outline-none focus:border-orange-400"
                  placeholder="ชื่อหมวดหมู่ใหม่..."
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setIsAdding(false); }}
                  autoFocus
                  disabled={saving}
                />
                <button
                  onClick={handleAdd}
                  disabled={saving || !newName.trim()}
                  className="px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1.5 text-sm font-semibold"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  บันทึก
                </button>
                <button
                  onClick={() => { setIsAdding(false); setNewName(''); }}
                  className="px-3 py-2 bg-white border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 text-sm"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="w-full py-2.5 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50/50 transition-all text-sm font-bold flex items-center justify-center gap-2"
              >
                <Plus size={16} /> เพิ่มหมวดหมู่ใหม่
              </button>
            )}
          </div>
        )}

        {/* Category List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-orange-500" size={28} />
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <Tag size={40} className="mb-3 text-gray-200" />
            <p className="font-medium">ยังไม่มีหมวดหมู่</p>
            <p className="text-sm mt-1">เพิ่มหมวดหมู่แรกด้านบน</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {categories.map(cat => {
              const count = productCounts[cat.id] || 0;
              const isEditing = editingId === cat.id;
              return (
                <li key={cat.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/60 transition-colors group">
                  <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <Tag size={16} className="text-orange-500" />
                  </div>

                  {isEditing ? (
                    <input
                      className="flex-1 px-3 py-1.5 border border-orange-300 rounded-lg text-sm font-medium focus:outline-none focus:border-orange-500 bg-orange-50"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(cat); if (e.key === 'Escape') setEditingId(null); }}
                      autoFocus
                      disabled={saving}
                    />
                  ) : (
                    <span className="flex-1 font-semibold text-gray-800">{cat.name}</span>
                  )}

                  <div className="flex items-center gap-2 text-gray-400 text-xs shrink-0">
                    <Package size={13} />
                    <span className="font-medium">{count} รายการ</span>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(cat)}
                          disabled={saving}
                          className="p-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                        >
                          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200"
                        >
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        {can('categories', 'edit') && (
                          <button
                            onClick={() => handleStartEdit(cat)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="แก้ไข"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {can('categories', 'delete') && (
                          <button
                            onClick={() => handleDelete(cat)}
                            disabled={saving}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="ลบ"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CategoryManagerPage;
