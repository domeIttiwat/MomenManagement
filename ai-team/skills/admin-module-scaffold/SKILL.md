---
name: admin-module-scaffold
description: |
  สร้าง/ขยาย module หลังบ้านของ MomenManagement ตาม pattern เดิม (Main/List/Form/Detail) พร้อม
  permission guard can() และ audit log logAction() ครบ. ใช้เมื่อจะเพิ่มหน้าจัดการใหม่ หรือทำ CRUD
  ของ entity ใหม่ในแอดมิน เช่น เพิ่มโมดูล/แท็บ/รายการจัดการ.
---

# admin-module-scaffold

ทำให้ module ใหม่หน้าตา/โครงสร้าง/ความปลอดภัยสอดคล้องของเดิม

## อ่านก่อน
`AI_CONTEXT.md` §4 (โครงสร้าง) + §5 (RBAC) + §6 (audit), และ module ที่ใกล้เคียงที่สุดเป็นตัวอย่าง
(เช่น `src/app/components/customers/` หรือ `products/`)

## โครงไฟล์ (ทำตาม)
```
src/app/components/<module>/
├── <Module>Main.js     # หน้าหลัก: title, search, filter, sort, ปุ่มสร้าง (guard can('<res>','create'))
├── <Module>List.js     # ตาราง/การ์ดรายการ, แถวคลิกเปิด Detail
├── <Module>Form.js     # create/edit, validation, ปุ่มบันทึก (guard create/edit)
└── <Module>Detail.js   # รายละเอียด/popup, ปุ่มลบ (guard delete)
```
+ route ที่ `src/app/<module>/page.js` render `<Module>Main`
+ เพิ่มเมนูใน `src/app/components/sidebar.js` (guard `canView('<res>')`)

## กฎบังคับ
1. **RBAC**: กำหนด resource ของ module (`product`/`customer`/...) — ทุก action guard ด้วย `can()`
   ถ้าเป็น **resource ใหม่** → ใช้ skill `rbac-change` (เติม row ทุก role + RoleManager) ก่อน
2. **Audit**: create/update/delete เรียก `logAction({ resource_type, resource_id, action,
   resource_label, old_data, new_data, created_by })` (ดู skill `audit-logging`)
3. **Data**: อ่าน/เขียนผ่าน `@/lib/supabase`; ถ้าเพิ่มตาราง/คอลัมน์ → `supabase-migration` (additive) +
   `cross-app-impact` (เช็คว่ากระทบ storefront ไหม)
4. **UI**: Tailwind v4 + `lucide-react` + `sonner` toast ให้เข้ากับ module เดิม; รองรับ loading/empty/error
5. หลังเสร็จ: `npm run build` / `npm run lint`

## Output
1. ไฟล์ที่สร้าง + route + sidebar
2. resource/action ที่ใช้ + guard ที่ใส่
3. audit log ที่ใส่
4. DB ที่แตะ (ถ้ามี) + ผ่าน security-reviewer ไหม
5. ผล build/lint + สิ่งที่ docs-keeper ต้องบันทึก

## Verify
อ่านซ้ำ: ทุก action มี guard? มี audit ครบ? loading/empty/error ครบ? resource ใหม่เติม row ทุก role แล้ว?
