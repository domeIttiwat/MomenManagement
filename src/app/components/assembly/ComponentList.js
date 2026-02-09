
'use client';

import { Package, ChevronRight } from 'lucide-react';

export default function ComponentList({ components }) {
  if (!components || components.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic mt-2">ไม่มีข้อมูลส่วนประกอบ</div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-200">
      <h4 className="text-sm font-semibold text-slate-600 mb-2">ส่วนประกอบ:</h4>
      <ul className="space-y-2">
        {components.map((component) => (
          <li key={component.id} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-md">
            <div className="flex items-center">
                <Package size={14} className="text-slate-500 mr-2" />
                <span className="text-slate-700 font-medium">{component.name}</span>
            </div>
            <span className="text-slate-500 font-mono">x{component.quantity}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

