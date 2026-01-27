import React, { useState } from 'react';
import { Plus, Trash2, Calendar, Clock, X, Paperclip, Edit } from 'lucide-react';
import ImageUploader from './ImageUploader';

const OrderUpdateManager = ({ updates = [], onChange }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);

  const [newUpdate, setNewUpdate] = useState({
    description: '',
    update_date: new Date().toISOString().split('T')[0],
    images: [] 
  });

  const handleSave = () => {
    if (!newUpdate.description.trim()) return alert('กรุณากรอกรายละเอียด');
    
    let updatedList = [...updates];
    if (editingIndex >= 0) {
      updatedList[editingIndex] = { ...newUpdate };
    } else {
      updatedList.push({ 
        ...newUpdate, 
        id: Date.now(), 
        created_at: new Date().toISOString() 
      });
    }

    onChange(updatedList);
    resetForm();
  };

  const startEdit = (index) => {
    setEditingIndex(index);
    setNewUpdate({ ...updates[index] });
    setIsAdding(true);
  };

  const removeUpdate = (idx) => {
    if(!confirm('ลบรายการนี้?')) return;
    const newList = updates.filter((_, i) => i !== idx);
    onChange(newList);
    if (editingIndex === idx) resetForm();
  };

  const resetForm = () => {
    setEditingIndex(-1);
    setIsAdding(false);
    setNewUpdate({
      description: '',
      update_date: new Date().toISOString().split('T')[0],
      images: []
    });
  };

  return (
    <div className="space-y-4">
      {/* Timeline List */}
      <div className="space-y-4 relative pl-4 border-l-2 border-indigo-100 ml-2">
        {updates.map((update, i) => (
          <div key={i} className={`relative bg-white border p-4 rounded-xl shadow-sm hover:shadow-md transition-all group ${editingIndex === i ? 'border-indigo-500 ring-1 ring-indigo-200' : 'border-gray-100'}`}>
            <div className={`absolute -left-[23px] top-4 w-3 h-3 rounded-full border-2 border-white shadow-sm ${editingIndex === i ? 'bg-indigo-600' : 'bg-indigo-400'}`}></div>
            
            <div className="flex justify-between items-start mb-2">
               <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar size={12}/> {new Date(update.update_date).toLocaleDateString('th-TH')}
                  <span className="text-gray-300">|</span>
                  <Clock size={12}/> {update.created_at ? new Date(update.created_at).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) : '-'}
               </div>
               <div className="flex gap-1">
                 <button type="button" onClick={() => startEdit(i)} className="text-gray-300 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-indigo-50"><Edit size={14}/></button>
                 <button type="button" onClick={() => removeUpdate(i)} className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"><Trash2 size={14}/></button>
               </div>
            </div>

            <p className="text-sm text-gray-800 whitespace-pre-line mb-3">{update.description}</p>

            {update.images && update.images.length > 0 && (
               <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {update.images.map((img, imgIdx) => (
                    <img key={imgIdx} src={img.url || img} className="w-16 h-16 object-cover rounded-lg border border-gray-100" />
                  ))}
               </div>
            )}
          </div>
        ))}
        {updates.length === 0 && !isAdding && (
            <div className="text-sm text-gray-400 italic pl-2">ยังไม่มีประวัติการอัปเดต</div>
        )}
      </div>

      {/* Add/Edit Form */}
      {isAdding ? (
        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2 space-y-3">
           <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
                {editingIndex >= 0 ? 'แก้ไขข้อมูล' : 'เพิ่มความคืบหน้า'}
              </span>
              <button type="button" onClick={resetForm} className="text-gray-400 hover:text-indigo-600"><X size={16}/></button>
           </div>
           
           <div>
              <label className="text-[10px] text-gray-500 font-bold mb-1 block">วันที่</label>
              <input 
                type="date" 
                className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={newUpdate.update_date}
                onChange={e => setNewUpdate({...newUpdate, update_date: e.target.value})}
              />
           </div>

           <div>
              <label className="text-[10px] text-gray-500 font-bold mb-1 block">รายละเอียด</label>
              <textarea 
                className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[80px]"
                placeholder="รายละเอียดความคืบหน้า..."
                value={newUpdate.description}
                onChange={e => setNewUpdate({...newUpdate, description: e.target.value})}
              />
           </div>

           <div>
              <label className="text-[10px] text-gray-500 font-bold mb-1 block flex items-center gap-1"><Paperclip size={12}/> รูปภาพประกอบ</label>
              <div className="bg-white p-2 rounded-lg border border-indigo-200">
                <ImageUploader images={newUpdate.images} onChange={imgs => setNewUpdate({...newUpdate, images: imgs})} />
              </div>
           </div>

           <div className="flex gap-2">
             <button type="button" onClick={handleSave} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-all">
               {editingIndex >= 0 ? 'บันทึกการแก้ไข' : 'บันทึกอัปเดต'}
             </button>
             <button type="button" onClick={resetForm} className="px-4 py-2 bg-white text-gray-500 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
               ยกเลิก
             </button>
           </div>
        </div>
      ) : (
        <button 
          type="button" 
          onClick={() => setIsAdding(true)} 
          className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 flex items-center justify-center gap-2 font-bold transition-all"
        >
          <Plus size={18}/> เพิ่มอัปเดต / Timeline
        </button>
      )}
    </div>
  );
};

export default OrderUpdateManager;