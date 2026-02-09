
"use client";
import React, { useState, useMemo } from 'react';
import { Plus, Search, ArrowUpDown } from 'lucide-react';
import AssemblyList from './AssemblyList';
import AssemblyDetail from './AssemblyDetail';

// Mock data for assembly tasks
const mockAssemblyData = [
  {
    id: 'ASM-001',
    orderId: 'ORD-2024-001',
    customerName: 'บริษัทรุ่งเรืองเทรดดิ้ง',
    taskName: 'ประกอบคอมพิวเตอร์เซ็ต i7',
    assignedTo: 'ทีมช่าง A',
    status: 'Pending', // Pending, In Progress, QA, Completed
    dueDate: '2024-08-15',
    createdAt: '2024-08-01',
  },
  {
    id: 'ASM-002',
    orderId: 'ORD-2024-003',
    customerName: 'คุณสมชาย ใจดี',
    taskName: 'ประกอบชุดโต๊ะทำงาน',
    assignedTo: 'ทีมช่าง B',
    status: 'In Progress',
    dueDate: '2024-08-10',
    createdAt: '2024-08-02',
  },
    {
    id: 'ASM-003',
    orderId: 'ORD-2024-002',
    customerName: 'ร้านเกมเมอร์โซน',
    taskName: 'ประกอบ Rig ขุดเหรียญ',
    assignedTo: 'ทีมช่าง A',
    status: 'QA',
    dueDate: '2024-08-05',
    createdAt: '2024-08-03',
  },
  {
    id: 'ASM-004',
    orderId: 'ORD-2024-004',
    customerName: 'ออฟฟิศสดใส',
    taskName: 'ประกอบเฟอร์นิเจอร์สำนักงาน',
    assignedTo: 'ทีมช่าง C',
    status: 'Completed',
    dueDate: '2024-07-30',
    createdAt: '2024-07-25',
  },
];

const AssemblyMain = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [assemblies, setAssemblies] = useState(mockAssemblyData);
  const [selectedAssembly, setSelectedAssembly] = useState(null);

  const filteredAndSortedAssemblies = useMemo(() => {
    let filtered = assemblies.filter(assembly =>
      assembly.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assembly.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assembly.customerName.toLowerCase().includes(searchTerm.toLowerCase())
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

                <AssemblyList assemblies={filteredAndSortedAssemblies} onSelectAssembly={handleSelectAssembly} />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AssemblyMain;
