
"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, ArrowUpDown, AlertTriangle } from 'lucide-react';
import AssemblyList from './AssemblyList';
import AssemblyDetail from './AssemblyDetail';
import { supabase } from '../../../lib/supabase';

const AssemblyMain = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [assemblies, setAssemblies] = useState([]);
  const [selectedAssembly, setSelectedAssembly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAssemblyTasks = async () => {
      setLoading(true);
      setError(null);

      // Step 1: Verify the user session first.
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Error getting session:', sessionError);
        setError('เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์ผู้ใช้');
        setLoading(false);
        return;
      }

      if (!session) {
        console.log('No active session found before fetching data.');
        setError('ไม่พบข้อมูลผู้ใช้, กรุณาเข้าสู่ระบบก่อนลองอีกครั้ง');
        setLoading(false);
        return;
      }

      // Step 2: If a session exists, proceed to fetch data.
      console.log('Active session found. Fetching data for user:', session.user.id);
      const { data: orders, error: dbError } = await supabase
        .from('orders')
        .select('id, created_at, due_date, customer_id, status')
        .eq('status', 'ส่งประกอบ');

      if (dbError) {
        console.error('Error fetching assembly tasks (with active session):', dbError);
        // Displaying the actual error message from the DB now
        setError(`เกิดข้อผิดพลาดจากฐานข้อมูล: ${dbError.message}`)
        setAssemblies([]);
      } else if (orders) {
        const assemblyTasks = orders.map(order => ({
          id: order.id,
          orderId: order.id,
          customerName: `ลูกค้า ID: ${order.customer_id}`,
          taskName: `งานประกอบสำหรับออเดอร์ #${order.id}`,
          assignedTo: 'ยังไม่ระบุทีม',
          status: 'Pending',
          dueDate: order.due_date,
          createdAt: order.created_at,
        }));
        setAssemblies(assemblyTasks);
      }
      setLoading(false);
    };

    fetchAssemblyTasks();
  }, []);

  const filteredAndSortedAssemblies = useMemo(() => {
     if (!assemblies) return [];
    let filtered = assemblies.filter(assembly =>
      (assembly.taskName && assembly.taskName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (assembly.orderId && assembly.orderId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (assembly.customerName && assembly.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    switch (sortOrder) {
      case 'newest':
        return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      case 'oldest':
        return filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      case 'due_date':
        return filtered.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      case 'name_asc':
        return filtered.sort((a,b) => a.taskName.localeCompare(b.taskName));
      default:
        return filtered;
    }
  }, [assemblies, searchTerm, sortOrder]);

  const handleSelectAssembly = (assembly) => {
    setSelectedAssembly(assembly);
  };
  
  const handleBackToList = () => {
      setSelectedAssembly(null);
  };

  return (
    <div className="flex h-screen bg-gray-50/50 overflow-hidden">
      <div className="flex-1 flex flex-col">
        <main className="flex-1 overflow-y-auto">
          <div className="p-8">
            {selectedAssembly ? (
              <AssemblyDetail assembly={selectedAssembly} onBack={handleBackToList} />
            ) : (
              <>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">รายการงานประกอบ (Assembly List)</h1>
                    <p className="text-sm text-gray-500 mt-1">
                      ค้นหา, ติดตาม, และจัดการงานประกอบทั้งหมด
                    </p>
                  </div>
                  <button className="flex items-center gap-2 bg-teal-600 text-white px-5 py-3 rounded-xl shadow-md hover:bg-teal-700 transition-colors">
                    <Plus size={20} />
                    <span>เพิ่มงานประกอบ</span>
                  </button>
                </div>

                <div className="flex items-center space-x-4 mb-6">
                  <div className="relative flex-1">
                    <Search
                      size={20}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      placeholder="ค้นหางานประกอบ, เลขออเดอร์, ชื่อลูกค้า..."
                      className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                     <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                        className="appearance-none w-full bg-white border border-gray-200 text-gray-700 py-3 pl-4 pr-10 rounded-xl leading-tight focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="newest">ใหม่ล่าสุด</option>
                        <option value="oldest">เก่าที่สุด</option>
                        <option value="due_date">ตามวันกำหนดเสร็จ</option>
                        <option value="name_asc">ตามชื่อ ก-ฮ</option>
                      </select>
                      <ArrowUpDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                  </div>
                </div>

                {loading && <div className="text-center py-16"><span className="loading loading-spinner text-teal-600"></span></div>}
                
                {error && 
                  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
                    <div className="flex">
                      <div className="py-1"><AlertTriangle className="h-6 w-6 text-red-500 mr-4"/></div>
                      <div>
                        <p className="font-bold">เกิดข้อผิดพลาด</p>
                        <p className="text-sm">{error}</p>
                      </div>
                    </div>
                  </div>
                }

                {!loading && !error && <AssemblyList assemblies={filteredAndSortedAssemblies} onSelectAssembly={handleSelectAssembly} />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AssemblyMain;
