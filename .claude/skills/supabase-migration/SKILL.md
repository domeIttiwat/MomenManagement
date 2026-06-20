---
name: supabase-migration
description: |
  เขียน migration SQL สำหรับ Supabase ที่ใช้ร่วมกันระหว่าง MomenManagement (admin) กับ MomenStore
  (storefront) ให้ปลอดภัย: idempotent, additive, ไม่พัง schema ของอีกแอป, ตั้ง RLS ให้ถูก และ
  ทดสอบด้วย BEGIN…ROLLBACK ก่อน apply. ใช้เมื่อต้องเพิ่ม/แก้ตาราง คอลัมน์ index หรือ policy.
---

# supabase-migration (shared)

ผลิต SQL ที่ปลอดภัยสำหรับ Supabase project ที่ **สองแอปใช้ร่วมกัน** ผิดพลาดทีเดียวพังทั้งคู่บน production

## อ่านก่อน
`../SHARED_CONTEXT.md` §4 (schema) + §5 (security/RLS) + §6 (cross-app map), `MomenManagement/*.sql`
(DDL ของ admin-owned tables), และไฟล์/route ที่เกี่ยว

## กฎ
- **Idempotent**: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
  `DROP POLICY IF EXISTS` ก่อน `CREATE POLICY`, `CREATE INDEX IF NOT EXISTS`
- **Additive only** กับ shared tables: คอลัมน์ใหม่ nullable/มี default; ห้าม drop/rename คอลัมน์ที่อีกแอปใช้;
  ห้ามเปลี่ยน type ในที่
- **RLS**: เปิด RLS บนตารางใหม่; storefront read ใส่ `FOR SELECT TO anon USING (...)` แบบ gate
  (`is_published`/`is_active`/token); **ห้าม** anon INSERT/UPDATE/DELETE; **เปิด RLS ต้องมาพร้อม
  policy ของ `authenticated` ใน migration เดียวกัน** (ไม่งั้น admin พัง)
- ห้ามอ่อน/ลบ policy ของ admin เพื่อแก้ anon exposure
- ตั้งชื่อ migration สื่อความหมาย; หัวไฟล์เขียนว่าทำอะไร/ทำไม

## Production Safety (บังคับ)
- ห้ามแก้ production แบบ ad-hoc — ผ่านไฟล์ migration และ/หรือ `apply_migration`
- **ทดสอบก่อนเสมอด้วย `BEGIN; <SQL> … <verify queries> ROLLBACK;` บนข้อมูลจริง** ดูผลแล้วค่อย apply ถาวร
  (branching ใช้ไม่ได้ — schema ไม่อยู่ใน migration history)
- ห้าม `DROP TABLE`/`DROP COLUMN` โดยไม่ระบุความเสี่ยง + ขออนุมัติชัดเจน
- ห้าม leak service_role/JWT/DB password/key
- หลัง apply: รัน `get_advisors(security)` + query ยืนยัน
- งานแตะ user/order/admin/pricing/auth → **ต้อง `security-reviewer`**

## Required Output Format (เสมอ)
1. สรุปการเปลี่ยน
2. ตารางที่กระทบ
3. flow/แอปที่กระทบ (admin / storefront)
4. Migration SQL (idempotent)
5. ผล RLS
6. ต้อง security review: Yes/No
7. กลยุทธ์ rollback
8. ผลทดสอบ BEGIN…ROLLBACK + verification queries
9. agent ที่ต้องตามต่อ (security-reviewer/tester/docs-keeper)
10. สถานะทดสอบ: Pass/Fail/Not run
