import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request) {
  const {
    email, first_name, last_name, nickname, phone, line_id,
    role_id, status, avatar_url, social_channels, redirectTo,
  } = await request.json();

  // 1. สร้าง auth user (email confirmed, random temp password)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomUUID(),
  });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  const userId = authData.user.id;

  // 2. insert profile ด้วย user.id จริง
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: userId, email, first_name, last_name, nickname,
    phone, line_id, role_id, status, avatar_url, social_channels,
  });
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId); // rollback
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  // 3. ส่ง "ตั้งรหัสผ่าน" email (recovery link)
  await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });

  return NextResponse.json({ success: true });
}
