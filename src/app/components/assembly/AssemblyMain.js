'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase'; // Re-enabled for Phase 2
import { Search, ArrowUpDown, Factory, LoaderCircle, AlertTriangle, List } from 'lucide-react';
import AssemblyOrderListItem from './AssemblyOrderListItem';
import AssemblyBoard from './AssemblyBoard';

export default function AssemblyMain() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('dueDate_asc');
  const [activeBoardOrder, setActiveBoardOrder] = useState(null);
  
  const ASSEMBLY_STATUSES = ['Picking', 'Assembling', 'Testing'];

  useEffect(() => {
    // --- PHASE 2: Reconnecting to the LIVE Supabase database ---
    const fetchAssemblyOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Using the safe, simplified query to fetch real data.
        const { data, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id, 
            due_date,
            status,
            customers(first_name, last_name),
            order_items(*, products(id, name, sku))
          `)
          .in('status', ASSEMBLY_STATUSES);

        if (ordersError) throw ordersError;

        if (!data) { 
          setOrders([]); 
          return; 
        }

        const processedOrders = data.map(order => {
            if (!order.order_items || order.order_items.length === 0) return null;

            const processedItems = order.order_items.map(item => ({
                id: item.id,
                name: item.products?.name || '[ไม่มีชื่อสินค้า]',
                sku: item.products?.sku || 'N/A',
                quantity: item.quantity,
                // Status will be managed inside the AssemblyBoard
                status: order.status, 
                components: [] // BOM components feature is temporarily disabled
            }));

            // A simple way to find the main vehicle name, can be improved later
            const vehicleName = processedItems[0]?.name || 'สินค้าประกอบ';

            return {
                id: order.id,
                orderId: `ORD-${String(order.id).padStart(6, '0')}`,
                customerName: `${order.customers?.first_name || ''} ${order.customers?.last_name || ''}`.trim() || '(ไม่มีชื่อลูกค้า)',
                dueDate: order.due_date,
                status: order.status,
                itemCount: processedItems.reduce((acc, item) => acc + item.quantity, 0),
                items: processedItems,
                vehicleName: vehicleName,
            };
        }).filter(Boolean); // Filter out any null orders

        setOrders(processedOrders);
      } catch (err) {
        console.error('Live Data Fetch Error:', err);
        setError('ไม่สามารถโหลดข้อมูลจริงได้: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAssemblyOrders();
  }, []);

  const handleSelectOrderFromList = (order) => setActiveBoardOrder(order);
  const handleBackFromBoard = () => setActiveBoardOrder(null);

  const filteredForList = useMemo(() => {
      return orders
        .filter(order =>
            order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.customerName.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            switch (sortOrder) {
            case 'dueDate_asc': return new Date(a.dueDate) - new Date(b.dueDate);
            case 'dueDate_desc': return new Date(b.dueDate) - new Date(a.dueDate);
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
    return <div className="flex items-center justify-center h-screen bg-slate-50 text-red-500"><AlertTriangle className="mr-2" />{error}</div>
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

            <div className="flex flex-col gap-y-6 animate-in fade-in duration-300">
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
                <div className="space-y-4 pb-6 overflow-y-auto pr-2">
                    {filteredForList.length > 0 ? (
                        filteredForList.map(order => (
                            <AssemblyOrderListItem key={order.id} order={order} onSelect={() => handleSelectOrderFromList(order)} />
                        ))
                    ) : (
                        <div className="text-center py-20 bg-white rounded-lg border border-slate-200 shadow-sm col-span-full">
                                <Factory className="mx-auto h-12 w-12 text-slate-400" />
                                <h3 className="mt-4 text-lg font-semibold text-slate-700">ไม่พบรายการที่ต้องประกอบ</h3>
                                <p className="mt-1 text-sm text-slate-500">ไม่มีออเดอร์ในสถานะ 'Picking', 'Assembling', หรือ 'Testing'</p>
                            </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
}
