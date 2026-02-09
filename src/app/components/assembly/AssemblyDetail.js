import React from 'react';
import { ArrowLeft } from 'lucide-react';

const AssemblyDetail = ({ assembly, onBack }) => {
  if (!assembly) return null;

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-indigo-600 font-semibold mb-4">
        <ArrowLeft size={20} />
        กลับไปที่รายการ
      </button>
      <h1 className="text-3xl font-bold">{assembly.taskName}</h1>
      <p className="text-gray-500">รายละเอียดงานประกอบสำหรับออเดอร์: {assembly.orderId}</p>
      {/* More details will be added here */}
    </div>
  );
};

export default AssemblyDetail;
