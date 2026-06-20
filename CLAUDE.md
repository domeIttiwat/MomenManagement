# CLAUDE.md — MomenManagement (Admin / หลังบ้าน)

> Claude อ่านไฟล์นี้อัตโนมัติเมื่อทำงานในโฟลเดอร์นี้ เก็บให้ **สั้นและตรงปัจจุบัน**
> รายละเอียดลึกอยู่ที่ [`AI_CONTEXT.md`](./AI_CONTEXT.md) — อ่านก่อนทำงานที่ไม่ใช่งานเล็ก
> เรื่อง **DB/security ที่ใช้ร่วมกับ storefront** อยู่ที่ [`../SHARED_CONTEXT.md`](../SHARED_CONTEXT.md)

## นี่คืออะไร
MomenManagement = **ระบบหลังบ้าน (admin) ของแบรนด์ Momen** สำหรับพนักงาน (ต้อง login)
Next.js 16 (App Router) + React 19 + Tailwind v4 + **Supabase** ใช้ **DB เดียวกับ storefront**
(`../MomenStore`) — โปรเจ็ค `gukhmlstrixhkygojqbf`

โดเมน: ขายรถ + ชุดแต่ง แอปนี้จัดการ สินค้า/สต๊อก/ออเดอร์/ลูกค้า/งานประกอบ/การตลาด/บริการ/พนักงาน+สิทธิ์

> ⚠️ `GEMINI.md` เดิมเป็น boilerplate ของ Firebase Studio (ตอนนี้ไม่ตรงสภาพจริงแล้ว — แอปย้ายมาใช้
> Supabase ไม่ใช่ Firebase) อย่าใช้เป็นแหล่งความจริง ใช้ `AI_CONTEXT.md` แทน

## เริ่มทุกงานด้วยการอ่าน
1. ไฟล์นี้ (convention + วิธีทำงานเป็นทีม)
2. `AI_CONTEXT.md` (architecture, modules, RBAC, audit, changelog, TODO)
3. `../SHARED_CONTEXT.md` ถ้างานแตะ DB/security/payment ที่ใช้ร่วมกับ storefront
4. ไฟล์จริงที่จะแก้

## กฎเหล็ก (ห้ามฝ่าฝืน)
- **DB ใช้ร่วมกับ storefront** — การแก้ schema/RLS ต้อง additive และไม่ทำให้ storefront พัง
  (เช็ค `../SHARED_CONTEXT.md` §6 cross-app map + ทดสอบ `BEGIN…ROLLBACK` ก่อน apply)
- **RBAC** — ทุก action สำคัญต้อง guard ด้วย `can(resource, action)` จาก `AuthContext`
  ⚠️ `can()` คืน `true` เมื่อ role ยังไม่มี permission record เลย (backward-compat) แต่คืน `false`
  เมื่อมี record แต่ไม่พบ resource → เพิ่ม resource ใหม่ต้องไป update role ทุกตัว (ดู skill `rbac-change`)
- **Audit log** — ทุก create/update/delete สำคัญต้องเรียก `logAction()` (`src/lib/auditLog.js`)
- **service-role** — `src/lib/supabaseAdmin.js` ใช้ใน **server route เท่านั้น** ห้าม import เข้า client
- **เงิน** — THB; charge เป็นสตางค์ (×100)
- **Memory** — หลังเปลี่ยนสำคัญทุกครั้ง อัปเดต `AI_CONTEXT.md` (Changelog + TODO) — `docs-keeper` ดูแล

## โครงสร้างโดยย่อ
- `src/lib/supabase.js` — browser client (anon, RLS-governed)
- `src/lib/supabaseAdmin.js` — **server-only** service-role client
- `src/lib/auditLog.js` — `logAction()` เขียน `audit_logs`
- `src/app/context/AuthContext.js` — session + RBAC `can()` + impersonation
- `src/app/components/<module>/` — แต่ละ module เป็น pattern `Main / List / Form / Detail`
  modules: assembly, customers, dashboard, marketing, orders, products, services, stock, users
- `src/app/api/admin/create-user/` — สร้าง user (service-role) | `src/app/api/drive/` — Google Drive

## วิธีทำงานเป็นทีม (role-based)
งานใหญ่: เริ่มที่ `tech-lead` → แตกงานให้ specialist → `tester`/`qa-bug-hunter` ตรวจ →
`security-reviewer` (ถ้าแตะ data/สิทธิ์/เงิน) → `docs-keeper` อัปเดต memory

| งาน | ส่งให้ |
|---|---|
| architecture/plan งานใหญ่ | `tech-lead` |
| สร้าง/แก้ module admin (Main/List/Form/Detail + audit + permission) | `admin-feature-engineer` |
| RBAC, role_permissions, can() | `rbac-guardian` |
| DB/query/RLS/migration/server route | `supabase-engineer` |
| security: RLS/auth/secret/pricing | `security-reviewer` (read-only) |
| edge case/regression | `qa-bug-hunter` (read-only) |
| ตรวจ spec/acceptance | `tester` |
| อัปเดต memory/docs | `docs-keeper` |

routing บังคับ: งานแตะ auth/orders/pricing/RLS/migration/env/payment/upload **ต้องผ่าน `security-reviewer`**

## skills (ดู `ai-team/skills/`, ใช้ร่วมที่ `../ai-team-shared/skills/`)
- `admin-module-scaffold` — สร้าง module admin ใหม่ตาม pattern เดิม
- `rbac-change` — เพิ่ม resource/action ใน RBAC อย่างปลอดภัย (กัน fail-open)
- `stock-assembly-flow` — flow สต๊อก ↔ งานประกอบ ↔ ออเดอร์ (เบิก/คืนคลัง)
- `audit-logging` — มาตรฐานการเรียก `logAction()`
- `cross-app-impact` (shared) — เช็คผลกระทบก่อนแก้ shared table
- `supabase-migration` (shared) — migration SQL ปลอดภัย idempotent
- `deploy-preflight` (shared) — checklist ก่อน deploy

## Run / setup
`npm install` แล้ว `npm run dev` (http://localhost:3000) — ต้องมี `.env.local`
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
และ `service-account-key.json` (หรือ env `GOOGLE_SERVICE_ACCOUNT_JSON`) สำหรับ Drive

## Sandbox (งานที่แตะ DB)
งานที่แก้ schema/DB ต้องพัฒนาบน Supabase local stack ก่อน แล้ว push migration ขึ้น prod —
ห้ามแก้ schema prod ด้วยมือ ดู `../SANDBOX.md` + skill `sandbox-workflow` + agent `sandbox-engineer`
(งานแตะแค่ UI/โค้ดไม่ต้องยก sandbox — git branch + `npm run dev` พอ)

## Memory ที่เกี่ยวข้อง
- `AI_CONTEXT.md` — สมองของ admin (สำคัญสุด)
- `../SHARED_CONTEXT.md` — ความรู้กลาง (DB/security ที่ใช้ร่วม)
- `../SANDBOX.md` — คู่มือ local-first development
- `../MomenStore/AI_CONTEXT.md` — ของ storefront (คนละแอป DB เดียวกัน)
