"use client";

import React, { useState } from 'react';
import { LayoutDashboard, Menu } from 'lucide-react';

import Sidebar from './components/sidebar'; 
import ProductMain from './components/products/ProductMain';
import CustomerMain from './components/customers/CustomerMain';
import OrderMain from './components/orders/OrderMain'; 
import MarketingMain from './components/marketing/MarketingMain'; // Import

export default function Home() {
  const [activeTab, setActiveTab] = useState('orders'); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [navData, setNavData] = useState(null);

  const handleNavigateToCustomer = (customerId) => {
    setActiveTab('customers');
    setNavData({ target: 'customer', id: customerId, timestamp: Date.now() });
  };

  const handleNavigateToOrder = (order) => {
    setActiveTab('orders');
    setNavData({ target: 'order', data: order, timestamp: Date.now() });
  };

  const handleTabChange = (tab) => {
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
          {activeTab === 'dashboard' && <div className="p-20 text-center border-2 border-dashed rounded-3xl">Dashboard Coming Soon</div>}
          
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

          {/* Marketing System */}
          {activeTab === 'marketing' && <MarketingMain />}
        </div>
      </main>
    </div>
  );
}