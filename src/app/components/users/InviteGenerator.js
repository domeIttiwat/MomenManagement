import React, { useState } from 'react';
import { Copy, QrCode } from 'lucide-react';
// import QRCode from 'react-qr-code'; // ถ้าจะใช้ต้อง npm install react-qr-code

const InviteGenerator = () => {
  // สมมติ URL (ของจริงต้องเป็น domain ที่ deploy แล้ว)
  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/login` : ''; 

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    alert('คัดลอกลิงก์แล้ว');
  };

  return (
    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm max-w-lg mx-auto text-center">
      <h3 className="text-xl font-bold text-gray-900 mb-4">เชิญทีมงานเข้าระบบ</h3>
      <p className="text-gray-500 mb-6 text-sm">ส่งลิงก์หรือ QR Code นี้ให้พนักงานเพื่อสมัครสมาชิก</p>
      
      <div className="bg-gray-50 p-4 rounded-xl flex items-center gap-3 mb-6 border border-gray-200">
        <input className="bg-transparent flex-1 outline-none text-gray-600 text-sm" value={inviteLink} readOnly />
        <button onClick={copyLink} className="text-indigo-600 hover:text-indigo-800 font-bold text-sm flex items-center gap-1">
          <Copy size={16}/> คัดลอก
        </button>
      </div>

      <div className="flex justify-center mb-4 p-4 bg-white border border-gray-100 rounded-xl inline-block shadow-sm">
         {/* ถ้าลง lib QR Code ให้ uncomment บรรทัดล่าง */}
         {/* <QRCode value={inviteLink} size={150} /> */}
         <div className="w-40 h-40 bg-gray-200 flex items-center justify-center text-gray-400 flex-col gap-2">
            <QrCode size={40}/>
            <span className="text-xs">QR Placeholder</span>
         </div>
      </div>
      <p className="text-xs text-gray-400">ผู้สมัครใหม่จะต้องรอการอนุมัติจาก Admin ก่อนเริ่มใช้งาน</p>
    </div>
  );
};
export default InviteGenerator;