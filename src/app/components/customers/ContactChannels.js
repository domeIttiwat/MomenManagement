import React from 'react';
import { Plus, X, Facebook, Instagram, Phone, MessageCircle, Twitter } from 'lucide-react';

// Icon mapping
const ICONS = {
  Facebook: <Facebook size={16} />,
  Line: <MessageCircle size={16} className="text-green-500"/>,
  Instagram: <Instagram size={16} className="text-pink-500"/>,
  TikTok: <span className="font-bold text-xs">TK</span>,
  WhatsApp: <Phone size={16} className="text-green-600"/>,
  WeChat: <span className="font-bold text-xs">WC</span>,
  Phone: <Phone size={16} />,
  Other: <span className="text-xs">Oth</span>
};

const ContactChannels = ({ contacts = [], onChange }) => {
  const addContact = () => {
    onChange([...contacts, { type: 'Line', value: '' }]);
  };

  const removeContact = (index) => {
    onChange(contacts.filter((_, i) => i !== index));
  };

  const updateContact = (index, field, value) => {
    const newContacts = [...contacts];
    newContacts[index][field] = value;
    onChange(newContacts);
  };

  return (
    <div className="space-y-3">
      {contacts.map((contact, idx) => (
        <div key={idx} className="flex gap-2 items-center animate-in slide-in-from-left-2">
          <div className="relative w-1/3">
            <select
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={contact.type}
              onChange={(e) => updateContact(idx, 'type', e.target.value)}
            >
              {Object.keys(ICONS).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <div className="absolute left-3 top-2.5 text-gray-500 pointer-events-none">
              {ICONS[contact.type] || ICONS['Other']}
            </div>
          </div>
          
          <input
            type="text"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            placeholder="ID หรือ เบอร์โทร..."
            value={contact.value}
            onChange={(e) => updateContact(idx, 'value', e.target.value)}
          />
          
          <button 
            type="button" 
            onClick={() => removeContact(idx)}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      ))}
      
      <button 
        type="button" 
        onClick={addContact}
        className="text-sm text-indigo-600 font-medium flex items-center gap-1 hover:text-indigo-800 px-1 py-1 rounded"
      >
        <Plus size={16} /> เพิ่มช่องทางติดต่อ
      </button>
    </div>
  );
};

export default ContactChannels;