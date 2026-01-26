import React from 'react';

const NumericInput = ({ value, onChange, className, placeholder, ...props }) => {
  // ฟอร์แมตตัวเลขใส่ comma
  const format = (val) => {
    if (val === '' || val === null || val === undefined) return '';
    // ถ้าเป็น 0 ให้แสดง "0" ไปเลย
    if (Number(val) === 0 && val !== '') return '0'; 
    return Number(val).toLocaleString('en-US');
  };

  const handleChange = (e) => {
    // ลบ comma ออกเพื่อให้ได้ค่าดิบ
    const rawValue = e.target.value.replace(/,/g, '');
    
    // อนุญาตให้ว่างได้ หรือเป็นตัวเลข (รวมทศนิยม)
    if (rawValue === '' || /^\d*\.?\d*$/.test(rawValue)) {
      onChange(rawValue);
    }
  };

  const handleFocus = (e) => {
    // เมื่อกดที่ช่อง ให้เลือกข้อความทั้งหมดทันที เพื่อให้พิมพ์ทับเลข 0 ได้เลย
    e.target.select();
  };

  return (
    <input
      type="text"
      className={className}
      placeholder={placeholder}
      value={format(value)}
      onChange={handleChange}
      onFocus={handleFocus} // เพิ่ม event onFocus
      {...props}
    />
  );
};

export default NumericInput;