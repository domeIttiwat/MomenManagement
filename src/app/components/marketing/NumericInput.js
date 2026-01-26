import React from 'react';

const NumericInput = ({ value, onChange, className, placeholder, ...props }) => {
  const format = (val) => {
    if (val === '' || val === null || val === undefined) return '';
    if (Number(val) === 0 && val !== '') return '0'; 
    return Number(val).toLocaleString('en-US');
  };

  const handleChange = (e) => {
    const rawValue = e.target.value.replace(/,/g, '');
    if (rawValue === '' || /^\d*\.?\d*$/.test(rawValue)) {
      onChange(rawValue);
    }
  };

  const handleFocus = (e) => e.target.select();

  return (
    <input
      type="text"
      className={className}
      placeholder={placeholder}
      value={format(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      {...props}
    />
  );
};

export default NumericInput;