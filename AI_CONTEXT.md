# AI_CONTEXT.md — MomenManagement (Admin / หลังบ้าน)

> **อ่านก่อนเสมอ** นี่คือแหล่งความจริงสำหรับ AI/นักพัฒนาที่มาทำงานต่อกับ admin
> อัปเดตทุกครั้งที่เปลี่ยน architecture / เพิ่มฟีเจอร์ / เรียนรู้เรื่อง DB ที่ใช้ร่วม
> เก็บ "Changelog" และ "TODO" ให้ทันสมัย เพื่อให้ AI รุ่นไหนก็อ่านแล้วทำงานต่อได้ทันที
> เรื่อง DB/security ที่ใช้ร่วมกับ storefront อยู่ที่ `../SHARED_CONTEXT.md`

Last updated: 2026-06-27

---

## 1. โปรเจ็คนี้คืออะไร

MomenManagement = **ระบบหลังบ้าน (admin/back-office)** สำหรับพนักงานแบรนด์ Momen (ต้อง login)
เป็นแอปคนละตัวกับ `../MomenStore` (หน้าร้านลูกค้า) แต่ **ใช้ Supabase project เดียวกัน**

แอปนี้ดูแล: สินค้า, สต๊อก/คลัง, สั่งของ/Supplier, ออเดอร์, ลูกค้า, งานประกอบ (assembly), การตลาด, บริการ,
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
    │   ├── procurement/             # รอบสั่งของ/Supplier/lot costing/price history
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
`marketing`, `stock` (มี action ย่อย `stock_in`, `stock_out`, `delete_tx` นอกเหนือ view/create/edit/delete),
`procurement` (มี `mark_paid`, `mark_arrived`, `receive_stock`, `show_cost`)

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
- Lot costing ใหม่: `stock_lots` เป็น source of truth ของต้นทุน FIFO; `stock_items` เป็น summary
  ให้ UI/หน้าร้านอ่านเหมือนเดิม; allocation อยู่ที่ `stock_lot_allocations`
- `src/lib/stockLots.js` เป็น helper กลางสำหรับ create lot, FIFO allocate, update price history,
  receive purchase order — ห้ามเขียน logic ตัดล็อตกระจายใน component ใหม่
- ต้นทุนสินค้าใช้ `null` = "ยังไม่ระบุต้นทุน", `0` = ต้นทุนศูนย์จริง; ProductForm ต้องไม่ normalize
  cost ว่างเป็น 0. เมื่อรับ purchase order/lot เข้าระบบค่อย update เป็น landed cost ล่าสุดตาม FIFO flow
- Procurement freight rule: ใช้ `freight_amount` เป็นค่าส่ง local ในสกุลของ PO เท่านั้น
  (ซ่อนเมื่อ currency=THB), ใช้ `thai_freight_thb` เป็นค่าส่งในไทย, และ `freight_thb`
  คือยอดรวมค่าส่ง THB สำหรับกระจายเข้า landed cost; ห้ามนำ UI "ค่าส่งคนละสกุล" กลับมา
- Procurement payment rule: ตอนอัปเดตสถานะ `paid` ต้องระบุยอดจ่ายจริงเป็น THB (`paid_amount_thb`)
  โดยแสดงยอดระบบให้เทียบก่อนบันทึก; ถ้า DB ยังไม่มี column ให้ UI fallback ได้แต่ migration ต้องตามให้ครบ
- Image UX rule: รูปที่แสดงจาก status/timeline/comment/upload ใน admin ต้องเปิดเป็น popup/lightbox
  ในหน้าเดิมเสมอ พร้อมปุ่มปิด/เลื่อนรูปถ้ามีหลายรูป; ห้ามใช้ลิงก์เปิด tab ใหม่
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

- **2026-06-28 (สีประจำคลัง)** — เพิ่มคอลัมน์ `stores.color` (hex, additive) + ตัวเลือกสีใน `StoreForm`
  (พาเลตสำเร็จ + เลือกสีเองอิสระผ่าน `<input type=color>`). การ์ดคลังใน `StockByWarehouse` (แถบซ้าย+ไอคอน)
  และ `StoreList` (แถบบน) ทาสีตามที่ตั้ง ไว้จดจำคลังได้ง่าย
- **2026-06-28 (จัดเตรียมของในงานบริการ)** — เพิ่ม `MaterialPrepPanel` (`components/common/`) — พอร์ต
  flow "เบิกวัสดุ/คืนคลัง" จาก AssemblyDetail มาเป็น component generic (ใช้ `stock_transactions`
  reference_type/id เป็นแหล่งบันทึก เหมือน assembly ไม่มีตารางใหม่). ฝังใน `ServiceDetail`
  (referenceType='service') ให้ **เพิ่มเอง**ว่าจะเตรียมอะไร แล้วเบิกตัดสต๊อก (FIFO ผ่าน lib atomic) +
  คืนคลังได้ ต่างจากงานประกอบรถที่ items มาจากระบบอัตโนมัติ. เป็น panel แยกจาก service billable items.
  **ยังเหลือ:** ลบใบงานบริการที่มีของเบิกค้างยังไม่ auto-return (assembly ทำ, service ยังไม่ทำ) — ควรเพิ่มภายหลัง
- **2026-06-28 (ลบคลังให้ถูกต้อง)** — เดิมลบคลัง/ชั้น set `location_id=NULL` ดิบ → ถ้าสินค้ามีของทั้ง
  ในคลังนั้น **และ** มีของ "ไม่ระบุคลัง" อยู่แล้ว จะชน unique index (`stock_items_base` ฯลฯ) ลบไม่ได้.
  เพิ่ม RPC `stock_unassign_locations(location_ids[])` ที่ **ย้าย+รวมยอด** เข้าแถว null แบบ atomic
  (`supabase/migrations/20260628_stock_unassign_locations_rpc.sql`). StoreList (ลบคลัง) + StoreDetail
  (ลบชั้นแบบย้ายของ) เรียก RPC นี้แทน. และ **ลบคลังต้องพิมพ์ชื่อคลังให้ตรงเพื่อยืนยัน** (typed confirm) แทน
  ช่องหมายเหตุเดิม. FK ที่ชี้ storage_locations เป็น ON DELETE SET NULL ทุกตัว → ของไม่หายอยู่แล้ว
- **2026-06-28 (เฟส 3)** — เติมหน้าสต๊อก: (1) **"จัดเข้าชั้น"** quick action จากการ์ดไม่ระบุคลัง
  (`AssignShelfModal`) — เลือกชั้นปลายทาง + จำนวน → ตัดล็อตฝั่งไม่ระบุคลัง (allocate scoped null) แล้วสร้าง
  ล็อตใหม่ที่ชั้นปลายทางคงต้นทุนต่อล็อต + ลง ledger out/in (ใช้ RPC atomic เฟส 1, summary คงตรง);
  (2) **มุมมองล็อต** (`LotView`) — ปุ่มสลับในหน้าคลัง โชว์ล็อต active: มาจาก PO ไหน/แหล่ง, เข้าคลัง/ชั้นไหน
  (หรือ "ไม่ระบุคลัง"), คงเหลือ/เริ่มต้น, ต้นทุน/ชิ้น, วันรับเข้า — ค้นด้วยสินค้า/SKU/ล็อต/PO ได้.
  **หมายเหตุ:** การ "จัดเข้าชั้น" ประกอบจาก allocate+createLot หลาย call (atomic ต่อ call, summary คงตรง)
  ยังไม่ atomic ทั้ง move — ถ้าต้องเป๊ะทำเป็น RPC `stock_move` เดียวภายหลัง
- **2026-06-28 (เฟส 2)** — รื้อ UX สต๊อกเป็น **warehouse-first**: แท็บ "สต๊อกสินค้า" ตอนนี้เป็น
  `StockByWarehouse` (การ์ดคลังแต่ละคลัง + การ์ด "ไม่ระบุคลัง" → กดเข้าไปเห็นชั้นวาง + รายการของในคลัง,
  ค้นในคลังได้) + ปุ่มสลับ "มุมมองรายสินค้า" (reuse `StockList` เดิมไว้ค้นข้ามคลัง). กดที่รายการเปิด
  `StockProductDetailModal` (มีปุ่มย้าย/รับเข้า/เบิก). ของไม่ระบุคลัง (location_id NULL, qty>0) เป็น
  พลเมืองชั้นหนึ่งแล้ว. ลดความซ้ำซ้อน StockList↔StoreDetail (StoreDetail เหลือไว้แท็บ "จัดการคลัง"
  สำหรับแก้โครงสร้างคลัง/ชั้น). ดู `../docs/STOCK_REVIEW.md` §4
- **2026-06-28 (เฟส 1)** — ตัด/เติมสต๊อก **atomic ระดับ DB**: เพิ่ม RPC `stock_issue_fifo`,
  `stock_add_lot`, `stock_adjust_summary` (migration `stock_atomic_movement_rpcs` + `_v2`,
  SECURITY INVOKER, grant authenticated เท่านั้น). `allocateFifoStockOut()`/`createStockLot()` ใน
  `lib/stockLots.js` กลายเป็น wrapper บาง ๆ เรียก RPC — callers ทั้งหมด (manual/order/service/assembly/
  procurement/transfer) ไม่ต้องแก้ (คง signature/return เดิม รวม `syncSummary` flag + `allocations`).
  ลด lot+summary ใน transaction เดียว → ไม่มีทางครึ่ง ๆ. **หมายเหตุ:** ledger (`stock_transactions`) ยัง
  insert ฝั่ง client → atomic แค่ lot+summary (full ledger-in-RPC = เฟสถัดไป). ROLLBACK-test prod ผ่าน
  (invariant คงอยู่). ดู `../GOTCHAS.md` #22-23
- **2026-06-28** — รีวิวระบบสต๊อกทั้งหมด (เอกสาร `../docs/STOCK_REVIEW.md`) + แก้ correctness เฟส 0:
  `allocateFifoStockOut()` เดิมตัด FIFO ข้ามคลังเมื่อ `locationId=null` แต่ลด summary เฉพาะแถว null →
  divergence (เด่นชัดในออเดอร์/บริการที่ "ไม่ส่ง locationId"). แก้เป็น: ส่ง locationId = ตัดเฉพาะคลังนั้น
  (รวม null=bin), ไม่ส่ง = ตัดข้ามคลัง, และ **ลด summary ตามคลังของล็อตที่ตัดจริง (per-location)** →
  stock_items ตรงกับ stock_lots ทุกคลังเสมอ. เพิ่มเตือน oversell (`missingQty>0`) ใน OrderForm/ServiceForm.
  ดู `../GOTCHAS.md` #22. (ตอนตรวจ prod ยังตรงกัน 100% — แก้ก่อนเกิดจริง)
- **2026-06-27 (later 2)** — แยก timeline ของ PO ออกเป็น 2 การ์ด: **"ประวัติสถานะ"** (read-only,
  `StatusHistoryCard`) กับ **"คอมเมนต์"** (`PurchaseOrderTimeline` เดิม โชว์เฉพาะคอมเมนต์มือ).
  เพิ่มคอลัมน์ `update_type` ('status'|'comment', default 'comment') + `status` ใน
  `purchase_order_updates` (migration `purchase_order_updates_type_status`, additive, backfill ของเก่า
  7 แถวเป็น 'status'); จุด insert: StatusUpdateModal + รับเข้าสต๊อก = `status`, ฟอร์มคอมเมนต์ = `comment`.
  รูปสลิป/ตอนเปลี่ยนสถานะไปอยู่ใน "ประวัติสถานะ" (มี badge สถานะ + lightbox) ไม่ปนกับคอมเมนต์อีก.
  แถวเก่าที่ยังไม่มี `update_type` มี `classifyUpdate()` เดาจากข้อความเป็น fallback
- **2026-06-27 (later)** — แก้ schema drift ของ `purchase_orders`: คอลัมน์ `thai_freight_thb` +
  `paid_amount_thb` ขาดบน prod (migration `20260627_procurement_lot_costing.sql` ไม่ถูก push ครบ) ทำให้
  "รับเข้าสต๊อก" พัง → apply migration `add_purchase_orders_freight_paid_columns` (additive, ROLLBACK-test
  ผ่าน, RLS/anon ไม่กระทบ); `receivePurchaseOrder` เพิ่ม guard คอลัมน์ thai_freight (write-side).
  เพิ่ม **modal เลือกคลังปลายทางตอนรับเข้าสต๊อก** (`ReceiveStockModal` ใน `ProcurementMain.js`) แทน
  `confirm()` เดิม — เลือก location ต่อรายการ, `receivePurchaseOrder` รับ `itemLocations` แล้วผูก
  FIFO lot + `stock_items` + เขียนกลับ `purchase_order_items.location_id` ตามคลังที่เลือก
  (เดิมของเข้า location จาก PO line ซึ่งมักเป็น null). บันทึกกับดักไว้ที่ `../GOTCHAS.md` #21
- **2026-06-27** — เพิ่มระบบ `procurement`: Sidebar tab "สั่งของ", Supplier management,
  purchase order lifecycle, price history, migration `20260627_procurement_lot_costing.sql`,
  lot costing/FIFO helper (`src/lib/stockLots.js`), manual stock-in สร้างล็อต, stock-out/order/service/
  assembly ใช้ FIFO allocation และ order/service item cost ใช้ weighted cost จากล็อตจริง; ปรับ status update
  ให้บังคับกรอกวันที่จริงตอนกดสถานะ, currency dropdown THB/USD/RMB, และเพิ่ม `purchase_order_updates`
  timeline พร้อมรูปแนบหลายรูปใน bucket `procurement`; Product/Supplier UI แยก cost `null`
  เป็น "ยังไม่ระบุต้นทุน" และให้ PO receipt update cost ล่าสุดเมื่อมีล็อตจริง; ปรับ freight เป็น
  local freight + Thai freight; ฟอร์ม PO แสดงสินค้าของ Supplier พร้อม variants, บังคับเลือก
  `variant_id` เมื่อสินค้าเปิด variants, เพิ่ม quick-add spec จากหน้า PO, และเปิด `ProductForm`
  เป็น modal เพื่อสร้างสินค้าใหม่แล้วผูกกับ Supplier อัตโนมัติ
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
- [ ] Apply migration `supabase/migrations/20260627_procurement_lot_costing.sql` ผ่าน sandbox flow
  แล้ว ROLLBACK-test บน prod ก่อน push; ยืนยัน opening lots รวมยอดตรงกับ `stock_items`
- [ ] เพิ่ม test/QA manual สำหรับ FIFO allocation ข้ามหลายล็อต และ receipt ที่กระจาย freight ตามมูลค่า
- [ ] เพิ่ม FK constraint ให้ stock location (จะได้เลิกใช้ manual JS join)
- [ ] รวม `.sql` กระจัดกระจาย (audit_log, stock_*, storage_locations) ให้เป็นชุด migration เดียว + บันทึกใน SHARED_CONTEXT §4
- [ ] ลบร่องรอย Firebase ที่ไม่ใช้ (`firebase-debug.log`, `GEMINI.md` ที่ล้าสมัย, `.idx/` ถ้าไม่ใช้แล้ว)
- [ ] เพิ่ม `loading.js` / `error.js` ในแต่ละ route segment
