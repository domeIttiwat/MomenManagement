---
name: deploy-preflight
description: |
  เช็คลิสต์ก่อน deploy/production หรือส่งมอบงานก้อนใหญ่ของ MomenManagement หรือ MomenStore: ตรวจ env,
  migration/RLS ที่ต้องรัน, build ผ่าน, ไม่มี secret/service-role รั่วไป client, payment/Drive credential
  ถูกตั้ง, และ smoke test. ใช้เมื่อจะ deploy, ขึ้น production, หรือ "ปล่อยของ".
---

# deploy-preflight (shared)

ด่านก่อน deploy/ส่งมอบ รายงาน checklist ✅/❌ พร้อม fix อย่า deploy ถ้ามี 🔴 ค้าง

## Checklist
1. **Env** (`.env.local` / hosting):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` ตั้งครบ
   - `SUPABASE_SERVICE_ROLE_KEY` ตั้งใน server env (**ห้าม** ขึ้นต้น `NEXT_PUBLIC_`)
   - storefront: `PAYMENT_PROVIDER` ถูก (🔴 อย่า ship `mock` ขึ้น prod), `NEXT_PUBLIC_SITE_URL` จริง
   - admin: `service-account-key.json` หรือ `GOOGLE_SERVICE_ACCOUNT_JSON` พร้อม (Drive)
2. **Secret leak scan** (🔴 สำคัญสุด): grep ว่า service-role client ไม่ถูก import ใน client component;
   ไม่มี secret ใน `NEXT_PUBLIC_*`; `.env*` + `service-account-key.json` gitignored และไม่ถูก track
3. **Database**: migration ที่ต้องรัน apply แล้ว; `get_advisors(security)` ไม่มี critical;
   spot-check anon อ่าน catalog ได้ แต่เขียน/อ่าน PII ไม่ได้
4. **Build/lint**: `npm run build` ผ่าน; `npm run lint` สะอาด (หรือเหลือเฉพาะที่รู้)
5. **Flow sensitive**: order/pricing คิดใหม่ฝั่ง server; RBAC guard ครบ (admin); payment webhook ถูก (storefront)
6. **UX**: responsive, loading/empty/error/404 ครบ, ไม่มี `console.log` หลุด
7. **Smoke test**: หน้า/flow หลักเรนเดอร์ได้ไม่มี console error

## Required Output Format (เสมอ)
1. ขอบเขต release (แอปไหน)
2. Preflight checklist (✅/❌/N-A ต่อข้อ)
3. คำสั่งที่รัน
4. Security checks
5. Supabase checks (migration/advisors)
6. UX checks
7. ปัญหาที่พบ (file:line + fix)
8. Rollback plan
9. **Go / No-Go**

เสนอให้ `docs-keeper` บันทึก release ลง Changelog
