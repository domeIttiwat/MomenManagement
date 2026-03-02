'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Lock, CheckCircle } from 'lucide-react';

export default function ResetPassword() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('รหัสผ่านไม่ตรงกัน'); return; }
    if (password.length < 6) { setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => router.push('/'), 2000);
    }
    setLoading(false);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl text-center">
          <div className="w-16 h-16 bg-green-500 rounded-2xl mx-auto flex items-center justify-center text-white mb-4 shadow-lg shadow-green-200">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">ตั้งรหัสผ่านใหม่เรียบร้อย</h2>
          <p className="text-gray-500 text-sm">กำลังพาคุณไปยังหน้าหลัก...</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-200 animate-pulse">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">กำลังตรวจสอบ...</h2>
          <p className="text-gray-500 text-sm">กรุณารอสักครู่</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-200">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ตั้งรหัสผ่านใหม่</h1>
          <p className="text-gray-500 mt-2 text-sm">MOMENTECH Management System</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              รหัสผ่านใหม่
            </label>
            <input
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="อย่างน้อย 6 ตัวอักษร"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              ยืนยันรหัสผ่าน
            </label>
            <input
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="กรอกรหัสผ่านอีกครั้ง"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
          >
            {loading ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
          </button>
        </form>
      </div>
    </div>
  );
}
