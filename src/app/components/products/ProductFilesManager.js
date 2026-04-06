import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { Plus, Trash2, Upload, Edit2, X, Check, Settings, Download, FileText, Loader2, Link } from 'lucide-react';

const EMPTY_LINK = { name: '', url: '' };

const ProductFilesManager = ({ productId }) => {
  const { profile } = useAuth();
  const meRef = () => profile ? { id: profile.id, name: `${profile.first_name} ${profile.last_name}` } : null;

  const [fileEntries, setFileEntries] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Entry form state
  const [entryForm, setEntryForm] = useState({
    name: '', material_id: '', notes: '',
    thumbnailFile: null, thumbnailPreview: null,
    links: [{ ...EMPTY_LINK }],
  });

  // Material modal state
  const [newMaterialName, setNewMaterialName] = useState('');
  const [editingMaterial, setEditingMaterial] = useState(null);

  useEffect(() => {
    if (productId) fetchAll();
  }, [productId]);

  const fetchAll = async () => {
    setLoading(true);
    const [entriesRes, materialsRes] = await Promise.all([
      supabase.from('product_files')
        .select('*, product_file_versions(*)')
        .eq('product_id', productId)
        .order('sort_order')
        .order('version_number', { referencedTable: 'product_file_versions', ascending: true }),
      supabase.from('product_materials').select('*').order('name'),
    ]);
    if (entriesRes.data) setFileEntries(entriesRes.data);
    if (materialsRes.data) setMaterials(materialsRes.data);
    setLoading(false);
  };

  // ---- Entry Form ----
  const openAddEntry = () => {
    setEditingEntry(null);
    setEntryForm({ name: '', material_id: '', notes: '', thumbnailFile: null, thumbnailPreview: null, links: [{ ...EMPTY_LINK }] });
    setShowEntryForm(true);
  };

  const openEditEntry = (entry) => {
    const existingLinks = (entry.product_file_versions || []).map(v => ({
      id: v.id,
      name: v.drive_file_name || '',
      url: v.drive_download_url || '',
    }));
    setEditingEntry(entry);
    setEntryForm({
      name: entry.name,
      material_id: entry.material_id || '',
      notes: entry.notes || '',
      thumbnailFile: null,
      thumbnailPreview: entry.thumbnail_url || null,
      links: existingLinks.length > 0 ? existingLinks : [{ ...EMPTY_LINK }],
    });
    setShowEntryForm(true);
  };

  // Link row helpers
  const updateLink = (idx, field, value) => {
    setEntryForm(prev => {
      const links = [...prev.links];
      links[idx] = { ...links[idx], [field]: value };
      return { ...prev, links };
    });
  };
  const addLink = () => setEntryForm(prev => ({ ...prev, links: [...prev.links, { ...EMPTY_LINK }] }));
  const removeLink = (idx) => setEntryForm(prev => ({ ...prev, links: prev.links.filter((_, i) => i !== idx) }));

  const handleThumbnailChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEntryForm(prev => ({ ...prev, thumbnailFile: file, thumbnailPreview: URL.createObjectURL(file) }));
    e.target.value = '';
  };

  const handleSaveEntry = async () => {
    if (!entryForm.name.trim()) return alert('กรุณาระบุชื่อรายการ');
    setSaving(true);
    try {
      // Thumbnail
      let thumbnailUrl = editingEntry?.thumbnail_url || null;
      if (entryForm.thumbnailFile) {
        const fileName = `file-thumb-${Date.now()}-${Math.random()}`;
        await supabase.storage.from('products').upload(fileName, entryForm.thumbnailFile);
        const { data } = supabase.storage.from('products').getPublicUrl(fileName);
        thumbnailUrl = data.publicUrl;
      }

      const payload = {
        name: entryForm.name.trim(),
        material_id: entryForm.material_id || null,
        notes: entryForm.notes.trim() || null,
        thumbnail_url: thumbnailUrl,
      };

      let entryId;
      if (editingEntry) {
        const { error: updErr } = await supabase.from('product_files').update({ ...payload, updated_by: meRef(), updated_at: new Date().toISOString() }).eq('id', editingEntry.id);
        if (updErr) throw new Error('product_files update: ' + updErr.message);
        entryId = editingEntry.id;
      } else {
        const { data, error: insErr } = await supabase.from('product_files').insert({ ...payload, product_id: productId, sort_order: fileEntries.length, created_by: meRef() }).select().single();
        if (insErr) throw new Error('product_files insert: ' + insErr.message);
        entryId = data.id;
      }

      // Save links — delete old, insert new (only non-empty links)
      const { error: delErr } = await supabase.from('product_file_versions').delete().eq('file_entry_id', entryId);
      if (delErr) throw new Error('product_file_versions delete: ' + delErr.message);

      const validLinks = entryForm.links.filter(l => l.url.trim());
      if (validLinks.length > 0) {
        const { error: linksErr } = await supabase.from('product_file_versions').insert(
          validLinks.map((l, idx) => ({
            file_entry_id: entryId,
            version_number: idx + 1,
            drive_file_id: null,
            drive_file_name: l.name.trim() || `ไฟล์ ${idx + 1}`,
            drive_download_url: l.url.trim(),
            drive_view_url: l.url.trim(),
            uploaded_by: meRef(),
          }))
        );
        if (linksErr) throw new Error('product_file_versions insert: ' + linksErr.message);
      }

      setShowEntryForm(false);
      fetchAll();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ---- Delete Entry ----
  const handleDeleteEntry = async (entry) => {
    if (!confirm(`ลบ "${entry.name}"?`)) return;
    await supabase.from('product_files').delete().eq('id', entry.id);
    fetchAll();
  };

  // ---- Material Modal ----
  const handleAddMaterial = async () => {
    if (!newMaterialName.trim()) return;
    await supabase.from('product_materials').insert({ name: newMaterialName.trim(), created_by: meRef() });
    setNewMaterialName('');
    const { data } = await supabase.from('product_materials').select('*').order('name');
    if (data) setMaterials(data);
  };

  const handleEditMaterial = async (mat) => {
    if (!editingMaterial?.name?.trim()) return;
    await supabase.from('product_materials').update({ name: editingMaterial.name }).eq('id', mat.id);
    setEditingMaterial(null);
    const { data } = await supabase.from('product_materials').select('*').order('name');
    if (data) setMaterials(data);
  };

  const handleDeleteMaterial = async (id) => {
    if (!confirm('ลบวัสดุนี้?')) return;
    await supabase.from('product_materials').delete().eq('id', id);
    const { data } = await supabase.from('product_materials').select('*').order('name');
    if (data) setMaterials(data);
  };

  const getMaterial = (id) => materials.find(m => m.id === id);

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-gray-400">
      <Loader2 className="animate-spin mr-2" size={20} /> กำลังโหลด...
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-800">ไฟล์ที่เกี่ยวข้อง</h3>
          <p className="text-sm text-gray-400 mt-0.5">Drawing, Spec Sheet, CAD และไฟล์อื่นๆ</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowMaterialModal(true)} className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors font-medium">
            <Settings size={14} /> จัดการวัสดุ
          </button>
          <button type="button" onClick={openAddEntry} className="flex items-center gap-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg transition-colors font-medium shadow-sm">
            <Plus size={14} /> เพิ่มรายการ
          </button>
        </div>
      </div>

      {/* Entry Form */}
      {showEntryForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2">
          <h4 className="font-bold text-indigo-800 text-sm">{editingEntry ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}</h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">ชื่อรายการ *</label>
              <input
                value={entryForm.name}
                onChange={e => setEntryForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="เช่น Assembly Drawing Rev.A"
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">วัสดุ</label>
              <select
                value={entryForm.material_id}
                onChange={e => setEntryForm(prev => ({ ...prev, material_id: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-sm outline-none focus:border-indigo-500"
              >
                <option value="">— ไม่ระบุ —</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">หมายเหตุ</label>
            <input
              value={entryForm.notes}
              onChange={e => setEntryForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="หมายเหตุเพิ่มเติม..."
              className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-sm outline-none focus:border-indigo-500"
            />
          </div>

          {/* Thumbnail */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">รูป Thumbnail</label>
            <div className="flex items-center gap-3">
              {entryForm.thumbnailPreview && (
                <img src={entryForm.thumbnailPreview} className="w-12 h-12 rounded-lg object-cover border border-indigo-200" />
              )}
              <label className="flex items-center gap-2 text-xs text-indigo-600 bg-white border border-indigo-200 px-3 py-2 rounded-xl cursor-pointer hover:bg-indigo-50 font-medium">
                <input type="file" accept="image/*" className="hidden" onChange={handleThumbnailChange} />
                <Upload size={14} /> {entryForm.thumbnailPreview ? 'เปลี่ยนรูป' : 'เลือกรูป'}
              </label>
            </div>
          </div>

          {/* File Links */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-gray-500">ลิงก์ดาวน์โหลดไฟล์</label>
              <button type="button" onClick={addLink} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                <Plus size={13} /> เพิ่มลิงก์
              </button>
            </div>
            <div className="space-y-2">
              {entryForm.links.map((link, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    value={link.name}
                    onChange={e => updateLink(idx, 'name', e.target.value)}
                    placeholder="ชื่อไฟล์ เช่น PDF Drawing"
                    className="w-36 shrink-0 px-3 py-2 bg-white border border-indigo-200 rounded-xl text-sm outline-none focus:border-indigo-500"
                  />
                  <input
                    value={link.url}
                    onChange={e => updateLink(idx, 'url', e.target.value)}
                    placeholder="วาง URL ที่นี่..."
                    className="flex-1 px-3 py-2 bg-white border border-indigo-200 rounded-xl text-sm outline-none focus:border-indigo-500 font-mono text-xs"
                  />
                  {entryForm.links.length > 1 && (
                    <button type="button" onClick={() => removeLink(idx)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">* วาง URL จาก Google Drive, Dropbox, OneDrive หรือที่ใดก็ได้</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowEntryForm(false)} disabled={saving} className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50">ยกเลิก</button>
            <button type="button" onClick={handleSaveEntry} disabled={saving} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 font-medium shadow-sm flex items-center gap-2 disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {fileEntries.length === 0 && !showEntryForm && (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
          <FileText size={36} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">ยังไม่มีไฟล์</p>
          <p className="text-xs mt-1">คลิก "เพิ่มรายการ" เพื่อเริ่มต้น</p>
        </div>
      )}

      {/* Entry List */}
      <div className="space-y-3">
        {fileEntries.map(entry => {
          const links = entry.product_file_versions || [];
          const material = getMaterial(entry.material_id);

          return (
            <div key={entry.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-start gap-3 p-4">
                {/* Thumbnail */}
                <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden shrink-0 border border-gray-200">
                  {entry.thumbnail_url
                    ? <img src={entry.thumbnail_url} className="w-full h-full object-cover" />
                    : <div className="flex items-center justify-center h-full"><FileText size={22} className="text-gray-300" /></div>
                  }
                </div>

                {/* Info + Links */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-gray-800 text-sm">{entry.name}</span>
                    {material && (
                      <span className="text-[11px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">{material.name}</span>
                    )}
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{links.length} ไฟล์</span>
                  </div>
                  {entry.notes && <p className="text-xs text-gray-400 mb-2">{entry.notes}</p>}

                  {/* Links */}
                  {links.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {links.map(v => (
                        <a
                          key={v.id}
                          href={v.drive_download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                        >
                          <Download size={12} />
                          {v.drive_file_name}
                        </a>
                      ))}
                    </div>
                  )}
                  {links.length === 0 && <p className="text-[11px] text-gray-300 italic">ยังไม่มีลิงก์</p>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => openEditEntry(entry)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button type="button" onClick={() => handleDeleteEntry(entry)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Material Modal */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowMaterialModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-gray-900">จัดการประเภทวัสดุ</h3>
              <button type="button" onClick={() => setShowMaterialModal(false)} className="p-1.5 hover:bg-gray-100 rounded-full"><X size={18} /></button>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                value={newMaterialName}
                onChange={e => setNewMaterialName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddMaterial()}
                placeholder="ชื่อวัสดุใหม่..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400"
              />
              <button type="button" onClick={handleAddMaterial} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {materials.map(mat => (
                <div key={mat.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-100">
                  {editingMaterial?.id === mat.id ? (
                    <>
                      <input value={editingMaterial.name} onChange={e => setEditingMaterial(prev => ({ ...prev, name: e.target.value }))} className="flex-1 px-2 py-1 border border-indigo-300 rounded-lg text-sm outline-none" autoFocus />
                      <button type="button" onClick={() => handleEditMaterial(mat)} className="p-1 text-green-600 hover:bg-green-50 rounded-lg"><Check size={14} /></button>
                      <button type="button" onClick={() => setEditingMaterial(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-700 font-medium">{mat.name}</span>
                      <button type="button" onClick={() => setEditingMaterial({ id: mat.id, name: mat.name })} className="p-1 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={13} /></button>
                      <button type="button" onClick={() => handleDeleteMaterial(mat.id)} className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
              ))}
              {materials.length === 0 && <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีวัสดุ</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductFilesManager;
