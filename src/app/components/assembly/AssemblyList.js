import React from 'react';
import AssemblyListItem from './AssemblyListItem';

const AssemblyList = ({ assemblies, onSelectAssembly }) => {
  if (!assemblies || assemblies.length === 0) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-gray-500">ไม่พบรายการงานประกอบ</p>
        </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
            <thead className="bg-gray-50/75 border-b border-gray-200">
                <tr className="text-xs text-gray-500 uppercase font-semibold">
                    <th className="px-6 py-4">ชื่องาน / ลูกค้า</th>
                    <th className="px-6 py-4">ทีมที่รับผิดชอบ</th>
                    <th className="px-6 py-4">กำหนดเสร็จ</th>
                    <th className="px-6 py-4 text-center">สถานะ</th>
                    <th className="px-6 py-4"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {assemblies.map(assembly => (
                    <AssemblyListItem key={assembly.id} assembly={assembly} onSelect={onSelectAssembly} />
                ))}
            </tbody>
        </table>
    </div>
  );
};

export default AssemblyList;
