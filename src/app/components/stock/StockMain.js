'use client';
import React, { useState } from 'react';
import { Boxes, History, Warehouse } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import StockList from './StockList';
import StockTransactionLog from './StockTransactionLog';
import StoreList from './StoreList';
import StoreForm from './StoreForm';
import StoreDetail from './StoreDetail';
import StockTransactionForm from './StockTransactionForm';

const StockMain = () => {
  const { can } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('items');

  // items sub-view
  const [itemsView, setItemsView] = useState('list'); // 'list' | 'transaction_form'
  const [txFormInitial, setTxFormInitial] = useState(null); // { type, product, variant }

  // stores sub-view
  const [storeView, setStoreView] = useState('list'); // 'list' | 'form' | 'detail'
  const [selectedStore, setSelectedStore] = useState(null);

  // ---- handlers ----
  const openTxForm = (type, product = null, variant = null) => {
    setTxFormInitial({ type, product, variant });
    setItemsView('transaction_form');
  };

  const handleTxSuccess = () => {
    setItemsView('list');
    setTxFormInitial(null);
  };

  const openStoreForm = (store = null) => {
    setSelectedStore(store);
    setStoreView('form');
  };

  const openStoreDetail = (store) => {
    setSelectedStore(store);
    setStoreView('detail');
  };

  const handleAddToLocation = (store, location) => {
    setTxFormInitial({ type: 'stock_in', prefilledStore: store, prefilledLocation: location });
    setActiveSubTab('items');
    setItemsView('transaction_form');
  };

  const canAccessStores = can('stock', 'view') || can('stock', 'edit') || can('stock', 'create');

  const tabs = [
    { id: 'items',  label: 'สต๊อกสินค้า',        icon: Boxes },
    { id: 'log',    label: 'ประวัติการเคลื่อนไหว', icon: History },
    ...(canAccessStores ? [{ id: 'stores', label: 'จัดการคลัง', icon: Warehouse }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-500 rounded-3xl p-8 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <Boxes size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">จัดการสต๊อกสินค้า</h1>
            <p className="text-teal-100 text-sm mt-1">ติดตามสินค้าเข้า-ออก และจัดการคลังสินค้า</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex gap-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeSubTab === 'items' && (
        itemsView === 'list'
          ? <StockList onStockIn={(p, v) => openTxForm('stock_in', p, v)} onStockOut={(p, v) => openTxForm('stock_out', p, v)} onAdjust={(p, v) => openTxForm('adjustment', p, v)} onNewTx={() => openTxForm(null)} />
          : <StockTransactionForm initialData={txFormInitial} onCancel={() => setItemsView('list')} onSuccess={handleTxSuccess} />
      )}

      {activeSubTab === 'log' && <StockTransactionLog />}

      {activeSubTab === 'stores' && canAccessStores && (
        storeView === 'list'
          ? <StoreList onNew={() => openStoreForm(null)} onEdit={openStoreForm} onView={openStoreDetail} />
          : storeView === 'form'
            ? <StoreForm initialData={selectedStore} onCancel={() => setStoreView('list')} onSuccess={() => setStoreView('list')} />
            : <StoreDetail store={selectedStore} onBack={() => setStoreView('list')} onEdit={() => openStoreForm(selectedStore)} onAddToLocation={handleAddToLocation} />
      )}
    </div>
  );
};

export default StockMain;
