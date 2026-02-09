
'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, ArrowUpDown, Factory, LoaderCircle, AlertTriangle } from 'lucide-react';
import AssemblyListItem from './AssemblyListItem';

export default function AssemblyMain() {
  const [assemblyQueue, setAssemblyQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('dueDate_asc');

  useEffect(() => {
    const fetchAssemblyData = async () => {
      try {
        setLoading(true);
        
        // Fetch orders with status 'sent_to_assembly'
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            order_date,
            due_date,
            order_details:order_details (
              id,
              product_id,
              quantity,
              products:products (
                name,
                image_url
              )
            )
          `)
          .eq('status', 'sent_to_assembly');

        if (ordersError) {
          throw ordersError;
        }
        
        // Transform the data into a flat structure suitable for the assembly queue
        const queue = orders.flatMap(order => 
          order.order_details.map(detail => ({
            id: detail.id,
            orderId: `ORD-${String(order.id).padStart(6, '0')}`,
            productName: detail.products.name,
            quantity: detail.quantity,
            dueDate: order.due_date,
            status: 'รอประกอบ' // Default status for new items in the queue
          }))
        );

        setAssemblyQueue(queue);
        setError(null);
      } catch (err) {
        setError('ไม่สามารถโหลดข้อมูลคิวงานประกอบได้');
        console.error('Error fetching assembly data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAssemblyData();
  }, []);

  const filteredAndSortedQueue = useMemo(() => {
    return assemblyQueue
      .filter(item =>
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.orderId.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        switch (sortOrder) {
          case 'dueDate_asc':
            return new Date(a.dueDate) - new Date(b.dueDate);
          case 'dueDate_desc':
            return new Date(b.dueDate) - new Date(a.dueDate);
          case 'name_asc':
            return a.productName.localeCompare(b.productName);
          case 'name_desc':
            return b.productName.localeCompare(a.productName);
          default:
            return 0;
        }
      });
  }, [assemblyQueue, searchTerm, sortOrder]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div className="flex items-center space-x-3 mb-4 md:mb-0">
             <div className="bg-blue-100 p-2 rounded-lg">
                <Factory className="h-6 w-6 text-blue-600" />
             </div>
             <h1 className="text-2xl md:text-3xl font-bold text-gray-800">คิวงานประกอบ</h1>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-grow">
            <Search size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาสินค้า หรือ เลขที่ออเดอร์..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm"
            />
          </div>
          <div className="relative w-full md:w-52">
             <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full appearance-none bg-white pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm"
             >
                <option value="dueDate_asc">กำหนดส่ง ใกล้-ไกล</option>
                <option value="dueDate_desc">กำหนดส่ง ไกล-ใกล้</option>
                <option value="name_asc">ชื่อสินค้า ก-ฮ</option>
                <option value="name_desc">ชื่อสินค้า ฮ-ก</option>
             </select>
             <ArrowUpDown size={16} className="absolute left-3.5 top-3.5 text-gray-400 pointer-events-none"/>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <LoaderCircle className="animate-spin h-10 w-10 text-blue-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center text-center py-20 bg-red-50 rounded-lg border border-red-200">
             <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
             <p className="text-red-700 font-semibold">{error}</p>
             <p className="text-red-600">กรุณาลองใหม่อีกครั้งในภายหลัง</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredAndSortedQueue.length > 0 ? (
              filteredAndSortedQueue.map(item => (
                <AssemblyListItem key={item.id} item={item} />
              ))
            ) : (
              <div className="text-center py-20 bg-white rounded-lg border border-gray-200">
                 <p className="text-gray-500">ไม่พบรายการในคิวงานประกอบ</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
