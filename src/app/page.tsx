"use client";

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';

// Import Components
import Sidebar from './components/sidebar'; 
import ProductMain from './components/products/ProductMain';
import CustomerMain from './components/customers/CustomerMain';
import OrderMain from './components/orders/OrderMain'; 
import MarketingMain from './components/marketing/MarketingMain';
import DashboardMain from './components/dashboard/DashboardMain';
import UserMain from './components/users/UserMain';
import Login from './login/page';
import ServiceMain from './components/services/ServiceMain';

// สร้าง Wrapper Component
const AppContent = () => {
  const { user, loading, profile } = useAuth();
  // FIX: ตั้งค่าเริ่มต้นเป็น 'dashboard'
  const [activeTab, setActiveTab] = useState<any>('dashboard'); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [navData, setNavData] = useState<any>(null);

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50 text-gray-500">กำลังโหลดข้อมูล...</div>;
  
  // ถ้ายังไม่ล็อกอิน
  if (!user) return <Login />;

  // ถ้าสถานะเป็น Pending
  if (profile?.status === 'pending') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 flex-col p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">รอการอนุมัติสิทธิ์</h1>
        <p className="text-gray-500">บัญชีของคุณสมัครเรียบร้อยแล้ว<br/>กรุณารอให้ Admin อนุมัติการใช้งาน</p>
      </div>
    );
  }

  // Navigation Handlers
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
        {/* Mobile Header */}
        <div className="md:hidden mb-6 flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-200">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100">
             ☰
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
          {activeTab === 'users' && <UserMain />}
          {activeTab === 'services' && <ServiceMain />}
        </div>
      </main>
    </div>
  );
};

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}