"use client";
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Lock, UserPlus, Mail } from 'lucide-react';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Login with Email
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else router.push('/');
    setLoading(false);
  };

  // Login with Google
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  // Forgot Password
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setError(error.message);
    else setMessage('ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว กรุณาเช็คอีเมล');
    setLoading(false);
  };

  // Sign Up
  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!firstName.trim()) { setError('กรุณากรอกชื่อ'); return; }
    setError('');
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // สร้าง profile ทันทีหลัง signUp สำเร็จ
    if (data?.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        status: 'pending',
      });
    }

    setMessage('กรุณาเช็คอีเมลเพื่อยืนยันตัวตน จากนั้นรอ Admin อนุมัติการใช้งาน');
    setLoading(false);
  };

  if (message) {
    const isForgotMsg = isForgotPassword;
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl text-center">
          <div className={`w-16 h-16 ${isForgotMsg ? 'bg-indigo-500 shadow-indigo-200' : 'bg-amber-500 shadow-amber-200'} rounded-2xl mx-auto flex items-center justify-center text-white mb-4 shadow-lg`}>
            {isForgotMsg ? <Mail size={32} /> : <UserPlus size={32} />}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isForgotMsg ? 'เช็คอีเมลของคุณ' : 'สมัครเรียบร้อยแล้ว'}
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">{message}</p>
          <button
            onClick={() => { setMessage(''); setIsSignUp(false); setIsForgotPassword(false); }}
            className="mt-6 text-sm text-indigo-600 font-semibold hover:underline"
          >
            ← กลับหน้าเข้าสู่ระบบ
          </button>
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
          <h1 className="text-2xl font-bold text-gray-900">
            {isForgotPassword ? 'ลืมรหัสผ่าน' : isSignUp ? 'สมัครใช้งาน' : 'เข้าสู่ระบบ'}
          </h1>
          <p className="text-gray-500 mt-2">MOMENTECH Management System</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <form
          onSubmit={isForgotPassword ? handleForgotPassword : isSignUp ? handleSignUp : handleLogin}
          className="space-y-4"
        >
          {isSignUp && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">ชื่อ *</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 placeholder-gray-400"
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="ชื่อจริง"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">นามสกุล</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 placeholder-gray-400"
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="นามสกุล"
                />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email</label>
            <input
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 placeholder-gray-400"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          {!isForgotPassword && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Password</label>
              <input
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 placeholder-gray-400"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              {!isSignUp && (
                <div className="text-right mt-1">
                  <button
                    type="button"
                    onClick={() => { setIsForgotPassword(true); setError(''); }}
                    className="text-xs text-indigo-500 hover:underline"
                  >
                    ลืมรหัสผ่าน?
                  </button>
                </div>
              )}
            </div>
          )}
          {isForgotPassword && (
            <p className="text-sm text-gray-500">
              กรอกอีเมลของคุณ เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
          >
            {loading ? 'Processing...' : isForgotPassword ? 'ส่งลิงก์รีเซ็ต' : isSignUp ? 'สมัครใช้งาน' : 'Login'}
          </button>
          {isForgotPassword && (
            <button
              type="button"
              onClick={() => { setIsForgotPassword(false); setError(''); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              ← กลับหน้าเข้าสู่ระบบ
            </button>
          )}
        </form>

        {!isSignUp && !isForgotPassword && (
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or continue with</span></div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={handleGoogleLogin} className="flex-1 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium text-gray-700 flex items-center justify-center gap-2">
                Google
              </button>
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setError(''); }}
                className="flex-1 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium text-gray-700"
              >
                สมัคร
              </button>
            </div>
          </div>
        )}

        {isSignUp && (
          <p className="mt-4 text-center text-sm text-gray-500">
            มีบัญชีแล้ว?{' '}
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setError(''); }}
              className="text-indigo-600 font-semibold hover:underline"
            >
              เข้าสู่ระบบ
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
