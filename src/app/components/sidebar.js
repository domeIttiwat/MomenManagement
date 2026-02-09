import React from 'react';
import { LayoutDashboard, Package, Users, ShoppingBag, X, LogOut, Megaphone, ShieldCheck, Wrench } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, isOpen, onClose = () => {} }) => {
  const menuItems = [
    { id: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard },
    { id: 'products', label: 'สินค้า', icon: Package },
    { id: 'customers', label: 'ลูกค้า', icon: Users },
    { id: 'orders', label: 'คำสั่งซื้อ', icon: ShoppingBag },
    { id: 'services', label: 'งานบริการ/ซ่อม', icon: Wrench },
    { id: 'assembly', label: 'งานประกอบ', icon: Wrench },
    { id: 'marketing', label: 'การตลาด', icon: Megaphone },
    { id: 'users', label: 'จัดการทีมงาน', icon: ShieldCheck }, 
  ];

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />}
      
      <aside className={`
        fixed left-0 top-0 h-screen w-72 bg-white border-r border-gray-100 flex flex-col z-50
        transition-transform duration-300 ease-out shadow-2xl md:shadow-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0
      `}>
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-indigo-200 shadow-lg">S</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">ShopManager</h1>
              <p className="text-xs text-gray-400 font-medium">Store Admin</p>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden text-gray-400 hover:text-gray-900"><X size={24} /></button>
        </div>

        <nav className="flex-1 px-4 space-y-2 py-4 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); onClose(); }}
                className={`
                  w-full flex items-center space-x-3.5 px-4 py-3.5 rounded-xl transition-all duration-200 group
                  ${isActive 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm font-semibold' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium'
                  }
                `}
              >
                <item.icon size={22} className={`transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  );
};
export default Sidebar;