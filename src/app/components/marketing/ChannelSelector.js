import React, { useState, useEffect } from 'react';
import { Plus, X, Megaphone, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const ChannelSelector = ({ selectedChannelId, onChange }) => {
  const [channels, setChannels] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newChannel, setNewChannel] = useState('');

  useEffect(() => { fetchChannels(); }, []);

  const fetchChannels = async () => {
    const { data } = await supabase.from('marketing_channels').select('*').order('name');
    if (data) setChannels(data);
  };

  const addChannel = async () => {
    if (!newChannel.trim()) return;
    const { data } = await supabase.from('marketing_channels').insert([{ name: newChannel }]).select().single();
    if (data) {
      setChannels([...channels, data]);
      onChange(data.id, data.name);
      setNewChannel('');
      setIsAdding(false);
    }
  };

  const deleteChannel = async (id, e) => {
    e.stopPropagation();
    if(!confirm('ลบช่องทางนี้?')) return;
    await supabase.from('marketing_channels').delete().eq('id', id);
    setChannels(channels.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">ช่องทางการตลาด</label>
      
      {!isAdding ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {channels.map(c => (
            <div 
              key={c.id} 
              onClick={() => onChange(c.id, c.name)}
              className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all group ${selectedChannelId === c.id ? 'bg-pink-600 text-white border-pink-600 shadow-md transform scale-105' : 'bg-white text-gray-600 border-gray-200 hover:border-pink-300'}`}
            >
              <span className="text-sm font-medium truncate">{c.name}</span>
              {selectedChannelId !== c.id && (
                 <button onClick={(e) => deleteChannel(c.id, e)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
              )}
            </div>
          ))}
          <button 
            onClick={() => setIsAdding(true)} 
            className="p-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:text-pink-600 hover:border-pink-300 hover:bg-pink-50 flex items-center justify-center gap-2 transition-all"
          >
            <Plus size={16}/> <span className="text-xs font-bold">เพิ่มใหม่</span>
          </button>
        </div>
      ) : (
        <div className="flex gap-2 animate-in fade-in slide-in-from-left-2">
          <input 
            className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-pink-500" 
            placeholder="ชื่อช่องทาง (เช่น Twitter Ads)..."
            value={newChannel}
            onChange={e => setNewChannel(e.target.value)}
            autoFocus
          />
          <button onClick={addChannel} className="px-4 py-2 bg-pink-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-pink-700">บันทึก</button>
          <button onClick={() => setIsAdding(false)} className="px-3 py-2 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200"><X size={18}/></button>
        </div>
      )}
    </div>
  );
};
export default ChannelSelector;