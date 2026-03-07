import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Impersonation State (สำหรับ Supervisor สวมบทบาท)
  const [impersonatedRole, setImpersonatedRole] = useState(null);

  useEffect(() => {
    // 1. Check Session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    };

    getSession();

    // 2. Listen to Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
        setPermissions([]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    try {
      // ดึง Profile + Role
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*, roles(*)')
        .eq('id', userId)
        .single();
      
      if (profileData) {
        setProfile(profileData);
        setRole(profileData.roles); // Role จริง
        
        // ดึง Permission ของ Role นั้น
        if (profileData.role_id) {
          const { data: perms } = await supabase
            .from('role_permissions')
            .select('*')
            .eq('role_id', profileData.role_id);
          setPermissions(perms || []);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  // ฟังก์ชันสวมบทบาท (เฉพาะ UI ไม่ได้เปลี่ยน Database)
  const impersonate = async (roleName) => {
    // หา Role ID จากชื่อ
    const { data: roleData } = await supabase.from('roles').select('*').eq('name', roleName).single();
    if (roleData) {
        setImpersonatedRole(roleData);
        // ดึง Permission ของ Role ที่สวมรอย
        const { data: perms } = await supabase.from('role_permissions').select('*').eq('role_id', roleData.id);
        setPermissions(perms || []);
    }
  };

  // ออกจากโหมดจำลอง → กลับ permission จริงของตัวเอง
  const stopImpersonating = async () => {
    setImpersonatedRole(null);
    if (profile?.role_id) {
        const { data: perms } = await supabase.from('role_permissions').select('*').eq('role_id', profile.role_id);
        setPermissions(perms || []);
    }
  };

  // ตรวจสอบว่า role ปัจจุบันมีสิทธิ์ action นี้สำหรับ resource นี้หรือเปล่า
  // ถ้าไม่มี record เลย (role ใหม่ยังไม่ได้ตั้ง) → อนุญาตไว้ก่อน (true)
  // ถ้ามี record แต่ไม่พบ resource นี้ → ปฏิเสธ (false) เพื่อความปลอดภัย
  const can = (resource, action) => {
    if (!permissions || permissions.length === 0) return true;
    const perm = permissions.find(p => p.resource === resource);
    if (!perm) return false;
    return perm.actions?.[action] === true;
  };
  const canView = (resource) => can(resource, 'view');

  const value = {
    user,
    profile,
    role: impersonatedRole || role,
    realRole: role,
    permissions,
    can,
    canView,
    loading,
    isImpersonating: !!impersonatedRole,
    impersonate,
    stopImpersonating,
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);