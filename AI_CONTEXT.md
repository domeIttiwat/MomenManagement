# AI_CONTEXT.md — MomenManagement (Admin / หลังบ้าน)

> **อ่านก่อนเสมอ** นี่คือแหล่งความจริงสำหรับ AI/นักพัฒนาที่มาทำงานต่อกับ admin
> อัปเดตทุกครั้งที่เปลี่ยน architecture / เพิ่มฟีเจอร์ / เรียนรู้เรื่อง DB ที่ใช้ร่วม
> เก็บ "Changelog" และ "TODO" ให้ทันสมัย เพื่อให้ AI รุ่นไหนก็อ่านแล้วทำงานต่อได้ทันที
> เรื่อง DB/security ที่ใช้ร่วมกับ storefront อยู่ที่ `../SHARED_CONTEXT.md`

Last updated: 2026-06-20

---

## 1. โปรเจ็คนี้คืออะไร

MomenManagement = **ระบบหลังบ้าน (admin/back-office)** สำหรับพนักงานแบรนด์ Momen (ต้อง login)
เป็นแอปคนละตัวกับ `../MomenStore` (หน้าร้านลูกค้า) แต่ **ใช้ Supabase project เดียวกัน**

แอปนี้ดูแล: สินค้า, สต๊อก/คลัง, ออเดอร์, ลูกค้า, งานประกอบ (assembly), การตลาด, บริการ,
พนักงาน + ระบบสิทธิ์ (RBAC), และ audit log

> หมายเหตุประวัติ: โปรเจ็คเริ่มจาก Firebase Studio (ยังเหลือร่องรอย `GEMINI.md`, `firebase-debug.log`,
> `.idx/`) แต่ปัจจุบัน backend จริงคือ **Supabase** ไฟล์ `GEMINI.md` เป็น boilerplate ที่ไม่ตรงสภาพแล้ว

---

## 2. Tech stack

- **Next.js 16** (App Router) + **React 19**
- **Tailwind CSS v4** (`@tailwindcss/postcss`)
- **@supabase/supabase-js v2** — backend (auth + DB + storage)
- **recharts** — กราฟ dashboard
- **@dnd-kit/*** + **@hello-pangea/dnd** — drag & drop (จัดลำดับ/คิว)
- **@headlessui/react** — UI primitives
- **googleapis** — เชื่อม Google Drive (เก็บ/อ่านไฟล์)
- **html2canvas** — export ภาพ
- **lucide-react** icons, **sonner** toasts, **date-fns**, **uuid**
- TypeScript สำหรับ config/layout; โค้ดฟีเจอร์ส่วนใหญ่เป็น `.js`
- Path alias: `@/*` → `src/*`

---

## 3. วิธีรัน

```bash
cd MomenManagement
npm install
npm run dev      # http://localhost:3000
```

`.env.local` ต้องมี:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser client)
- `SUPABASE_SERVICE_ROLE_KEY` (server route: สร้าง user) — **ห้ามขึ้นต้น NEXT_PUBLIC_**
- Google Drive: วาง `service-account-key.json` ที่ root (gitignored) หรือ env `GOOGLE_SERVICE_ACCOUNT_JSON`

---

## 4. โครงสร้างโปรเจ็ค

```
src/
├── lib/
│   ├── supabase.js          # browser client (anon key) — RLS-governed
│   ├── supabaseAdmin.js     # SERVER-ONLY service-role client (สร้าง user)
│   └── auditLog.js          # logAction() → เขียน audit_logs
└── app/
    ├── layout.tsx           # root layout
    ├── page.tsx             # entry (dashboard/หลัง login)
    ├── globals.css
    ├── login/               # หน้า login
    ├── reset-password/      # ตั้ง/รีเซ็ตรหัสผ่าน
    ├── context/
    │   └── AuthContext.js   # session + RBAC can() + impersonation
    ├── hooks/
    │   └── usePermission.js
    ├── components/
    │   ├── sidebar.js               # เมนูหลัก
    │   ├── common/                  # component กลาง (เช่น AuditLogPanel)
    │   ├── dashboard/               # กราฟ/สรุป (recharts)
    │   ├── products/                # สินค้า + หมวดหมู่ + variants + accessory
    │   ├── stock/                   # สต๊อก/คลัง/ตำแหน่งเก็บ/transaction
    │   ├── orders/                  # ออเดอร์ + รายการ + ชำระเงิน
    │   ├── customers/               # ลูกค้า
    │   ├── assembly/                # งานประกอบ (assembly_jobs) + เบิก/คืนคลัง
    │   ├── services/                # งานบริการ
    │   ├── marketing/               # การตลาด
    │   └── users/                   # พนักงาน + RoleManager (RBAC)
    └── api/
        ├── admin/create-user/route.js   # สร้าง auth user + profile (service-role)
        └── drive/route.js               # Google Drive (googleapis + service account)
```

แต่ละ module ตามแบบแผน **`<Module>Main.js` (หน้าหลัก + filter/sort) →
`<Module>List.js` → `<Module>Form.js` (create/edit) → `<Module>Detail.js` (รายละเอียด/popup)**

---

## 5. ระบบสิทธิ์ (RBAC) — สำคัญ

- ตาราง `roles(id, name)` + `role_permissions(role_id, resource, actions jsonb)`
- `profiles(id = auth.uid, …, role_id)` โยงผู้ใช้กับ role
- `AuthContext.js` โหลด permission ของ role แล้วให้ฟังก์ชัน:
  - `can(resource, action)` — เช็คสิทธิ์
  - `canView(resource)` — = `can(resource, 'view')`
  - `impersonate(roleName)` / `stopImpersonating()` — supervisor สวมบทบาท (เฉพาะ UI ไม่แตะ DB)
  - `refreshPermissions()` — re-fetch หลังแก้ role (ให้ผลทันทีไม่ต้อง reload)

⚠️ **พฤติกรรม fail-safe ของ `can()` (ต้องเข้าใจก่อนแก้)**
```js
const can = (resource, action) => {
  if (!permissions || permissions.length === 0) return true;  // role ไม่มี record เลย → อนุญาต (backward compat)
  const perm = permissions.find(p => p.resource === resource);
  if (!perm) return false;                                     // มี record แต่ไม่พบ resource → ปฏิเสธ
  return perm.actions?.[action] === true;
};
```
ดังนั้น **เมื่อเพิ่ม resource ใหม่** (เช่น เคยเพิ่ม `stock`) role ที่ตั้งค่ามาก่อนหน้าจะ "ปฏิเสธ"
resource นั้น → ต้อง insert row ของ resource ใหม่ให้ทุก role (RoleManager ทำ auto-insert ตอนเลือก role)
ดูขั้นตอนปลอดภัยที่ skill `rbac-change`

resource ที่ใช้อยู่ (เห็นจากโค้ด): `product`, `customer`, `order`, `service`, `assembly`,
`marketing`, `stock` (มี action ย่อย `stock_in`, `stock_out`, `delete_tx` นอกเหนือ view/create/edit/delete)

---

## 6. Audit log

- `src/lib/auditLog.js` → `logAction({ resource_type, resource_id, action, resource_label,
  old_data, new_data, metadata, created_by })` เขียนตาราง `audit_logs`
- คำนวณ `changed_fields` อัตโนมัติจาก diff ของ old/new
- **ไม่ throw error** (กันกระทบ main flow) — ถ้า fail แค่ `console.error`
- ใช้ anon client → RLS ของ `audit_logs` อนุญาต `authenticated` insert/select เท่านั้น (log immutable: ไม่มี update/delete)
- เรียกใน module: products, customers, orders, services, assembly, marketing, stock
- ดูมาตรฐานการเรียกที่ skill `audit-logging`

---

## 7. Flow สต๊อก ↔ งานประกอบ (ซับซ้อนสุด — ดู skill `stock-assembly-flow`)

- `stores` (สาขา) → `storage_locations` (ตำแหน่งเก็บในสาขา) → `stock_items` (จำนวนคงเหลือต่อ product/variant/location)
- ทุกการเคลื่อนไหวเขียน `stock_transactions` (`reference_type` รวมค่า `'assembly'`)
- **AssemblyDetail**: เบิกวัสดุจากคลัง (หัก `stock_items` + log transaction) และ **คืนคลัง**
  - เบิก = สีเขียว, คืน = สีแดง; รายการที่คืนแล้วจะหายจากลิสต์ "เบิก"
  - ลบใบงานประกอบ → auto-return วัสดุที่ยังไม่คืนกลับคลังอัตโนมัติ
- การปรับสต๊อก (adjustment) มีทิศ +/− (เคยมีบั๊ก adjustment เป็นบวกเสมอ — แก้แล้ว)
- ⚠️ บาง join ใช้ **manual JS join** แทน FK auto-join ของ Supabase เพราะ DB ไม่มี FK constraint
  (`location:location_id(...)` คืน null เงียบ ๆ) — ถ้าเพิ่ม query สต๊อกใหม่ให้ใช้ pattern manual join

---

## 8. ออเดอร์ & การเชื่อมกับ storefront

- ออเดอร์มาได้ 2 ทาง: สร้างใน admin เอง หรือมาจาก storefront (`source`/`channel`)
- status `'ส่งประกอบ'` = trigger ให้เข้า Assembly queue; storefront สร้าง build order แล้ว set ทางนี้
  หรือ insert `assembly_jobs` (ref_type='order') — **ยืนยันกลไกที่ใช้จริงก่อนแก้ฝั่งใดฝั่งหนึ่ง**
- รายละเอียด schema ออเดอร์/ชำระเงินอยู่ใน `../SHARED_CONTEXT.md` §4

---

## 9. Google Drive integration

- `src/app/api/drive/route.js` ใช้ `googleapis` + service account
- credential: อ่าน `service-account-key.json` จาก `process.cwd()` ก่อน, fallback ไป env
  `GOOGLE_SERVICE_ACCOUNT_JSON` — deploy ต้องจัดให้มีอย่างใดอย่างหนึ่ง
- scope: `https://www.googleapis.com/auth/drive`

---

## 10. Security (เฉพาะ admin — ภาพรวม DB อยู่ที่ ../SHARED_CONTEXT.md §5)

- ✅ `supabaseAdmin.js` (service-role) import เฉพาะ `api/admin/create-user` — ไม่รั่วเข้า client (ตรวจแล้ว)
- ✅ `service-account-key.json`, `.env*` gitignored — ไม่ถูก track
- ⚠️ RBAC เป็น **frontend guard** (`can()`); RLS ฝั่ง DB ของ admin ใช้ `using(true)` สำหรับ
  authenticated → สิทธิ์จริงคุมที่แอป ถ้าต้องการ defense-in-depth ควรพิจารณา server-side enforcement
- ⚠️ ดู TODO ความปลอดภัยที่ใช้ร่วมใน `../SHARED_CONTEXT.md` §5/§7 (14 ตาราง RLS disabled ฯลฯ)

---

## 11. Changelog

- **2026-06-20** — สร้าง memory ฝั่ง admin ครั้งแรก (`CLAUDE.md` + ไฟล์นี้) แทน `GEMINI.md` ที่ล้าสมัย,
  เชื่อมกับชั้นกลาง `../SHARED_CONTEXT.md`, และเพิ่ม AI team (agents/skills) เฉพาะ admin
  (admin-feature-engineer, rbac-guardian + admin-module-scaffold, rbac-change, stock-assembly-flow,
  audit-logging) พร้อม shared team จาก `../ai-team-shared/`
- *(งานก่อนหน้าอยู่ใน git history — สรุปงานเด่นที่เห็น: ระบบ audit log + auditLog.js,
  ระบบสิทธิ์ stock (stock_in/stock_out/delete_tx), StockProductDetailModal, การเบิก/คืนคลังใน
  AssemblyDetail + auto-return ตอนลบใบงาน, CategoryManagerPage, fix can() fail-open,
  manual JS join สำหรับ stock location)*

---

## 12. TODO / Next steps

**ความปลอดภัย (ใช้ร่วม — ดู `../SHARED_CONTEXT.md` §5/§7):**
- [x] ✅ (verified 2026-06-20) RLS เปิดครบทุกตาราง, anon เขียนไม่ได้, anon อ่าน orders/customers/PII
  ไม่ได้, product_variants public-ALL ถูกลบแล้ว — ของด่วนวิกฤตทำเสร็จหมด
- [x] ✅ (2026-06-20) REVOKE สิทธิ์เขียนของ anon ทั้ง schema + storage 6 bucket เป็น authenticated-only
  (migration `harden_anon_writes_and_storage_objects`) — รูปยังแสดงได้, catalog ยังอ่านได้, ไม่มีข้อมูลหาย
- [ ] (residual) customers/orders bucket → private + signed URL ปิด URL ตรง (ต้องแก้โค้ด getPublicUrl หลายไฟล์)
- [ ] พิจารณา server-side enforcement ของ RBAC (ตอนนี้เป็น frontend guard)
- [ ] pin search_path + จำกัด EXECUTE ฟังก์ชัน SECURITY DEFINER; ตรวจตาราง `users` ที่ไม่มี policy

**โครงสร้าง/คุณภาพ:**
- [ ] เพิ่ม FK constraint ให้ stock location (จะได้เลิกใช้ manual JS join)
- [ ] รวม `.sql` กระจัดกระจาย (audit_log, stock_*, storage_locations) ให้เป็นชุด migration เดียว + บันทึกใน SHARED_CONTEXT §4
- [ ] ลบร่องรอย Firebase ที่ไม่ใช้ (`firebase-debug.log`, `GEMINI.md` ที่ล้าสมัย, `.idx/` ถ้าไม่ใช้แล้ว)
- [ ] เพิ่ม `loading.js` / `error.js` ในแต่ละ route segment
