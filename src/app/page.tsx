"use client";

import React, { useState, useEffect } from 'react';
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
import AssemblyMain from './components/assembly/AssemblyMain';

// สร้าง Wrapper Component
const ALL_TABS = ['dashboard', 'products', 'customers', 'orders', 'services', 'assembly', 'marketing', 'users'];

const AppContent = () => {
  const { user, loading, profile, canView, permissions, isImpersonating, stopImpersonating, role } = useAuth();
  const [activeTab, setActiveTab] = useState<any>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [navData, setNavData] = useState<any>(null);

  // เมื่อ permissions โหลดเสร็จหรือเปลี่ยน ถ้าแท็บที่อยู่ไม่มีสิทธิ์ → ย้ายไปแท็บแรกที่เข้าถึงได้
  useEffect(() => {
    if (permissions.length > 0 && !canView(activeTab)) {
      const first = ALL_TABS.find(t => canView(t)) || 'dashboard';
      setActiveTab(first);
    }
  }, [permissions]);

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
    if (canView('customers')) { setActiveTab('customers'); setNavData({ target: 'customer', id: customerId, timestamp: Date.now() }); }
  };
  const handleNavigateToOrder = (order: any) => {
    if (canView('orders')) { setActiveTab('orders'); setNavData({ target: 'order', data: order, timestamp: Date.now() }); }
  };
  const handleTabChange = (tab: any) => {
    if (canView(tab)) { setActiveTab(tab); setNavData(null); }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 flex">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <main className="flex-1 md:ml-72 overflow-y-auto h-screen w-full transition-all flex flex-col">
        {isImpersonating && (
          <div className="sticky top-0 z-40 bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between shadow-lg shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-lg">👁</span>
              <span className="font-bold">โหมดจำลองมุมมอง:</span>
              <span className="bg-white/20 px-2 py-0.5 rounded font-bold">{role?.name}</span>
              <span className="text-amber-200 hidden sm:inline">— เมนูและสิทธิ์แสดงตามตำแหน่งนี้</span>
            </div>
            <button
              onClick={stopImpersonating}
              className="bg-white text-amber-700 hover:bg-amber-50 px-3 py-1 rounded-lg text-xs font-bold transition-colors shrink-0"
            >
              ✕ ออกจากโหมดจำลอง
            </button>
          </div>
        )}
        <div className="flex-1 p-4 md:p-8">
        {/* Mobile Header */}
        <div className="md:hidden mb-6 flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-200">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100">
             ☰
          </button>
          <span className="font-bold text-slate-800 text-lg">ShopManager</span>
          <div className="w-8" />
        </div>

        <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500">
          {activeTab === 'dashboard' && (canView('dashboard') ? <DashboardMain /> : <AccessDenied />)}
          {activeTab === 'products' && (canView('products') ? <ProductMain /> : <AccessDenied />)}
          {activeTab === 'customers' && (canView('customers') ? (
            <CustomerMain
              initialNavData={navData?.target === 'customer' ? navData : null}
              onViewOrder={handleNavigateToOrder}
            />
          ) : <AccessDenied />)}
          {activeTab === 'orders' && (canView('orders') ? (
            <OrderMain
              initialNavData={navData?.target === 'order' ? navData : null}
              onViewCustomer={handleNavigateToCustomer}
            />
          ) : <AccessDenied />)}
          {activeTab === 'services' && (canView('services') ? <ServiceMain /> : <AccessDenied />)}
          {activeTab === 'assembly' && (canView('assembly') ? <AssemblyMain /> : <AccessDenied />)}
          {activeTab === 'marketing' && (canView('marketing') ? <MarketingMain /> : <AccessDenied />)}
          {activeTab === 'users' && (canView('users') ? <UserMain /> : <AccessDenied />)}
        </div>
        </div>
      </main>
    </div>
  );
};

const AccessDenied = () => (
  <div className="flex flex-col items-center justify-center py-32 text-center">
    <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
      <span className="text-3xl">🔒</span>
    </div>
    <h2 className="text-xl font-bold text-gray-700 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
    <p className="text-gray-400 text-sm">ตำแหน่งของคุณไม่มีสิทธิ์เข้าถึงหน้านี้<br/>กรุณาติดต่อผู้ดูแลระบบ</p>
  </div>
);

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}