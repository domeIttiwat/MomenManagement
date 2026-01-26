"use client";
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Login with Email
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else router.push('/'); // ไปหน้าหลัก
    setLoading(false);
  };

  // Login with Google
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  // Sign Up
  const handleSignUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert('กรุณาเช็คอีเมลเพื่อยืนยันตัวตน');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl">
        <div className="text-center mb-8">
           <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-200">
             <Lock size={32} />
           </div>
           <h1 className="text-2xl font-bold text-gray-900">เข้าสู่ระบบ</h1>
           <p className="text-gray-500 mt-2">MOMENTECH Management System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email</label>
            <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Password</label>
            <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
            {loading ? 'Processing...' : 'Login'}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
            <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or continue with</span></div>
          </div>
          <div className="mt-6 flex gap-3">
             <button onClick={handleGoogleLogin} className="flex-1 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium text-gray-700 flex items-center justify-center gap-2">
               Google
             </button>
             <button onClick={handleSignUp} className="flex-1 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium text-gray-700">
               Sign Up
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}