import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

const MonthYearPicker = ({ value, onChange }) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Parse selected value
  let selectedYear = null;
  let selectedMonth = null; // 0-indexed
  if (value && value.startsWith('custom_')) {
    const parts = value.split('_');
    selectedYear = parseInt(parts[1]);
    selectedMonth = parseInt(parts[2]) - 1;
  }

  const [pickerYear, setPickerYear] = useState(selectedYear || currentYear);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isFuture = (year, month) =>
    year > currentYear || (year === currentYear && month > currentMonth);

  const handleSelect = (monthIdx) => {
    if (isFuture(pickerYear, monthIdx)) return;
    onChange(`custom_${pickerYear}_${monthIdx + 1}`);
    setOpen(false);
  };

  const label = selectedYear !== null
    ? `${THAI_MONTHS_SHORT[selectedMonth]} ${selectedYear + 543}`
    : null;

  const isActive = value?.startsWith('custom_');

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => { setOpen(!open); if (!open && selectedYear) setPickerYear(selectedYear); }}
        className={`flex items-center gap-2 px-3 py-2.5 text-sm font-bold rounded-xl border transition-all whitespace-nowrap ${
          isActive
            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
        }`}
      >
        <CalendarDays size={15} />
        {label || 'เลือกเดือน/ปี'}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
          {/* Year navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setPickerYear(y => y - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="text-center">
              <p className="font-extrabold text-gray-800 text-sm">{pickerYear + 543}</p>
              <p className="text-[10px] text-gray-400">{pickerYear}</p>
            </div>
            <button
              onClick={() => setPickerYear(y => Math.min(y + 1, currentYear))}
              disabled={pickerYear >= currentYear}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {THAI_MONTHS_SHORT.map((name, i) => {
              const future = isFuture(pickerYear, i);
              const isSelected = selectedYear === pickerYear && selectedMonth === i;
              const isCurrentMonth = pickerYear === currentYear && i === currentMonth;

              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={future}
                  className={`py-2 rounded-xl text-xs font-bold transition-all relative ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : future
                      ? 'text-gray-200 cursor-not-allowed'
                      : isCurrentMonth
                      ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {name}
                  {isCurrentMonth && !isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full"></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Clear button */}
          {isActive && (
            <button
              onClick={() => { onChange('this_month'); setOpen(false); }}
              className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl py-2 transition-all font-medium"
            >
              ล้างการเลือก → กลับเดือนนี้
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MonthYearPicker;
