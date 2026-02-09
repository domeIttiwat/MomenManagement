'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, ArrowUpDown, Factory, LoaderCircle, AlertTriangle } from 'lucide-react';
import AssemblyOrderListItem from './AssemblyOrderListItem';
import AssemblyBoard from './AssemblyBoard';

export default function AssemblyMain() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('dueDate_asc');
  const [activeBoardOrder, setActiveBoardOrder] = useState(null);
  
  const fetchAssemblyOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Updated select query to fetch logs and comments
      const { data: orderData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id, 
          completed_at, 
          status,
          customers(first_name, last_name),
          order_items(*, 
            products(id, name, sku),
            assembly_logs(*),
            assembly_comments(*)
          )
        `)
        .in('status', ['Picking', 'Assembling', 'Testing']);

      if (ordersError) throw ordersError;

      if (!orderData || orderData.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const productIds = [...new Set(
        orderData
          .flatMap(order => order.order_items || [])
          .map(item => item.products?.id)
          .filter(Boolean)
      )];

      let componentsMap = new Map();

        if (productIds.length > 0) {
            const { data: bomData, error: bomError } = await supabase
                .from('product_bundles')
                .select(`parent_product_id, quantity, components:products!child_product_id(id, name, sku)`)
                .in('parent_product_id', productIds);

            if (bomError) throw new Error(`Failed to fetch BOM: ${bomError.message}`);

            const aggregatedComponents = new Map();

            if (bomData) {
                bomData.forEach(bomItem => {
                    if (!bomItem?.components) return;
                    
                    const parentId = bomItem.parent_product_id;
                    const component = bomItem.components;
                    const quantity = bomItem.quantity;

                    if (!aggregatedComponents.has(parentId)) {
                        aggregatedComponents.set(parentId, new Map());
                    }

                    const parentComponentMap = aggregatedComponents.get(parentId);

                    if (parentComponentMap.has(component.id)) {
                        parentComponentMap.get(component.id).quantity += quantity;
                    } else {
                        parentComponentMap.set(component.id, {
                            id: component.id,
                            name: component.name,
                            sku: component.sku,
                            quantity: quantity,
                        });
                    }
                });
            }
            
            for (const [parentId, innerMap] of aggregatedComponents.entries()) {
                componentsMap.set(parentId, Array.from(innerMap.values()));
            }
        }

      const processedOrders = orderData.map(order => {
          if (!order?.order_items) return null;

          const processedItems = order.order_items.map(item => {
            if (!item?.products) return null;
            // Sort logs and comments by creation date
            const sortedLogs = (item.assembly_logs || []).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
            const sortedComments = (item.assembly_comments || []).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

            return {
              id: item.id,
              name: item.products.name || '[ไม่มีชื่อสินค้า]',
              sku: item.products.sku || 'N/A',
              quantity: item.quantity,
              status: item.status,
              picked_component_ids: item.picked_component_ids || [],
              manual_components: item.manual_components || [],
              components: componentsMap.get(item.products.id) || [],
              assembly_logs: sortedLogs, // Add sorted logs
              assembly_comments: sortedComments // Add sorted comments
            }
          }).filter(Boolean);

          if (processedItems.length === 0) return null;

          return {
              id: order.id,
              orderId: `ORD-${String(order.id).padStart(6, '0')}`,
              customerName: `${order.customers?.first_name || ''} ${order.customers?.last_name || ''}`.trim() || '(ไม่มีชื่อลูกค้า)',
              dueDate: order.completed_at,
              status: order.status,
              itemCount: processedItems.reduce((acc, currentItem) => acc + currentItem.quantity, 0),
              items: processedItems,
              vehicleName: processedItems[0]?.name || 'สินค้าประกอบ',
          };
      }).filter(Boolean);

      setOrders(processedOrders);
    } catch (err) {
      console.error('Data Fetch Error:', err);
      setError('ไม่สามารถโหลดข้อมูลได้: ' + (err.message || 'เกิดข้อผิดพลาดที่ไม่สามารถระบุสาเหตุได้'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssemblyOrders();

    const handleRefresh = () => fetchAssemblyOrders();
    window.addEventListener('refreshOrders', handleRefresh);
    return () => window.removeEventListener('refreshOrders', handleRefresh);

  }, []);

  const handleSelectOrderFromList = (order) => setActiveBoardOrder(order);
  const handleBackFromBoard = () => {
      setActiveBoardOrder(null);
      window.dispatchEvent(new Event('refreshOrders'));
  };

  const filteredForList = useMemo(() => {
      return orders
        .filter(order =>
            order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.customerName.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            const dateA = new Date(a.dueDate);
            const dateB = new Date(b.dueDate);

            switch (sortOrder) {
            case 'dueDate_asc': return dateA - dateB;
            case 'dueDate_desc': return dateB - dateA;
            case 'customer_asc': return a.customerName.localeCompare(b.customerName, 'th');
            case 'customer_desc': return b.customerName.localeCompare(a.customerName, 'th');
            default: return 0;
            }
        });
  }, [orders, searchTerm, sortOrder]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-slate-50"><LoaderCircle className="animate-spin h-10 w-10 text-blue-500" /></div>;
  }

  if (error) {
    return <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-red-600 p-4">
        <div className="text-center bg-red-50 border border-red-200 p-6 rounded-lg">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
            <h3 className="mt-2 text-lg font-semibold">เกิดข้อผิดพลาด</h3>
            <p className="mt-1 text-sm text-red-700 max-w-md">{error}</p>
        </div>
    </div>
  }
  
  if (activeBoardOrder) {
      return <AssemblyBoard order={activeBoardOrder} onBack={handleBackFromBoard} />;
  }

  return (
    <div className="bg-slate-50 min-h-screen">
        <div className="max-w-screen-2xl mx-auto p-4 md:p-6 flex flex-col h-[calc(100vh-1rem)]">
            <header className="pb-6">
                 <div className="flex items-center gap-3">
                    <div className='p-3 rounded-xl border bg-blue-100 border-blue-200'><Factory className='h-6 w-6 text-blue-600' /></div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">คิวงานประกอบ</h1>
                </div>
                <p className="text-slate-500 mt-2 ml-1">มี {filteredForList.length} รายการในคิว</p>
            </header>

            <div className="flex flex-col gap-y-6 animate-in fade-in duration-300 flex-1 overflow-hidden">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3 sticky top-0 z-10">
                    <div className="relative flex-grow">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="ค้นหาด้วยเลขที่ออเดอร์, ชื่อลูกค้า..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border-transparent rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition" />
                    </div>
                    <div className="relative w-full md:w-56">
                        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-full appearance-none bg-slate-50 pl-11 pr-4 py-2.5 border-transparent rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition font-medium text-slate-600">
                            <option value="dueDate_asc">กำหนดส่ง ใกล้-ไกล</option>
                            <option value="dueDate_desc">กำหนดส่ง ไกล-ใกล้</option>
                            <option value="customer_asc">ชื่อลูกค้า ก-ฮ</option>
                            <option value="customer_desc">ชื่อลูกค้า ฮ-ก</option>
                        </select>
                        <ArrowUpDown size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                    </div>
                </div>
                <main className="flex-1 overflow-y-auto">
                    <div className="space-y-4 pb-6 pr-2">
                        {filteredForList.length > 0 ? (
                            filteredForList.map(order => (
                                <AssemblyOrderListItem key={order.id} order={order} onSelect={() => handleSelectOrderFromList(order)} />
                            ))
                        ) : (
                            <div className="text-center py-20 bg-white rounded-lg border border-slate-200 shadow-sm">
                                <Factory className="mx-auto h-12 w-12 text-slate-400" />
                                <h3 className="mt-4 text-lg font-semibold text-slate-700">ไม่พบรายการที่ต้องประกอบ</h3>
                                <p className="mt-1 text-sm text-slate-500">ไม่มีออเดอร์ในสถานะ 'Picking', 'Assembling', หรือ 'Testing'</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    </div>
  );
}
