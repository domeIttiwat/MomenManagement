// ไฟล์นี้ชื่อ supabase.js วางไว้ในโฟลเดอร์ lib/supabase.js
// ทำหน้าที่เป็นตัวกลางเชื่อมต่อระหว่าง Next.js กับฐานข้อมูล Supabase

import { createClient } from '@supabase/supabase-js';

// ดึงค่า URL และ Key จากไฟล์ .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// สร้าง Instance สำหรับเรียกใช้งาน
export const supabase = createClient(supabaseUrl, supabaseKey);