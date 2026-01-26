"use client";

import React, { useState } from 'react';
import { LayoutDashboard, Menu } from 'lucide-react';

// Import Components
import Sidebar from './components/sidebar'; 
import ProductMain from './components/products/ProductMain';
import CustomerMain from './components/customers/CustomerMain';
import OrderMain from './components/orders/OrderMain'; 
import MarketingMain from './components/marketing/MarketingMain';
import DashboardMain from './components/dashboard/DashboardMain';
import UserMain from './components/users/UserMain'; // 1. เพิ่ม Import นี้

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>('dashboard'); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [navData, setNavData] = useState<any>(null);

  const handleNavigateToCustomer = (customerId: any) => {
    setActiveTab('customers');
    setNavData({ target: 'customer', id: customerId, timestamp: Date.now() });
  };

  const handleNavigateToOrder = (order: any) => {
    setActiveTab('orders');
    setNavData({ target: 'order', data: order, timestamp: Date.now() });
  };

  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    setNavData(null); 
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 flex">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <main className="flex-1 md:ml-72 p-4 md:p-8 overflow-y-auto h-screen w-full transition-all">
        <div className="md:hidden mb-6 flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-200">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition-colors">
            <Menu size={24} />
          </button>
          <span className="font-bold text-slate-800 text-lg">ShopManager</span>
          <div className="w-8" />
        </div>

        <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500">
          {activeTab === 'dashboard' && <DashboardMain />}
          
          {activeTab === 'products' && <ProductMain />}
          
          {activeTab === 'customers' && (
            <CustomerMain 
              initialNavData={navData?.target === 'customer' ? navData : null} 
              onViewOrder={handleNavigateToOrder}
            />
          )}
          
          {activeTab === 'orders' && (
            <OrderMain 
              initialNavData={navData?.target === 'order' ? navData : null} 
              onViewCustomer={handleNavigateToCustomer}
            />
          )}

          {activeTab === 'marketing' && <MarketingMain />}

          {/* 2. เพิ่มส่วนแสดงผลหน้าจัดการ User ตรงนี้ */}
          {activeTab === 'users' && <UserMain />}
        </div>
      </main>
    </div>
  );
}