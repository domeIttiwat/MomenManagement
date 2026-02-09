'use client';

import { Package, X } from 'lucide-react';

export default function ComponentList({ 
  components, 
  pickedStates, 
  onComponentCheck, 
  itemId,
  onRemoveManualComponent // Function to remove a manually added component
}) {
  const allComponents = components || [];

  if (allComponents.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic mt-2 px-4 pb-4">ไม่มีส่วนประกอบใน Checklist</div>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t border-slate-200">
      <h4 className="text-sm font-semibold text-slate-600 mb-2 px-4">Checklist ส่วนประกอบ:</h4>
      <ul className="space-y-1.5 px-4 pb-4">
        {allComponents.map((component) => {
          const isChecked = pickedStates.has(component.id);
          const isManual = !!component.manual; // Check if it's a manually added component

          return (
            <li key={component.id} 
                className={`rounded-md transition-all duration-150 group ${isChecked ? 'bg-green-50' : 'bg-slate-50'}`}>
              <label className="flex justify-between items-center text-sm p-2.5 cursor-pointer w-full">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => onComponentCheck(itemId, component.id, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3 shadow-sm"
                  />
                  <div className="flex items-center">
                      <Package size={14} className={`mr-2 transition-colors ${isChecked ? 'text-green-600' : 'text-slate-500'}`} />
                      <span className={`font-medium transition-colors ${isChecked ? 'text-green-800 line-through decoration-green-800' : 'text-slate-700'}`}>
                        {component.name}
                      </span>
                      {isManual && <span className="text-xs text-blue-500 ml-2">(เพิ่มเอง)</span>}
                  </div>
                </div>
                <div className="flex items-center">
                  <span className={`font-mono text-xs transition-colors mr-3 ${isChecked ? 'text-green-700' : 'text-slate-500'}`}>
                    x{component.quantity}
                  </span>
                  {isManual && (
                     <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemoveManualComponent(itemId, component.id); }} 
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                        aria-label="ลบส่วนประกอบนี้"
                      >
                       <X size={14} />
                     </button>
                  )}
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
