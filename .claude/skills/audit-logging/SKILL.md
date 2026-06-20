---
name: audit-logging
description: |
  มาตรฐานการบันทึก audit log ใน MomenManagement ให้ครบและสม่ำเสมอทุก module. ใช้เมื่อเพิ่ม/แก้ action
  ที่ create/update/delete ข้อมูล หรือเปลี่ยนสถานะ เพื่อให้มีร่องรอยตรวจสอบได้ว่าใครทำอะไรเมื่อไหร่.
---

# audit-logging

ทุกการกระทำสำคัญต้องมีร่องรอย เพื่อความรับผิดชอบและการตรวจสอบย้อนหลัง

## อ่านก่อน
`AI_CONTEXT.md` §6, `src/lib/auditLog.js`, ตัวอย่างการเรียกใน module เดิม (orders/products/stock)

## วิธีเรียก
```js
import { logAction } from '@/lib/auditLog';

await logAction({
  resource_type: 'order',          // 'product'|'customer'|'order'|'service'|'assembly'|'marketing'|'stock'
  resource_id: order.id,           // UUID (null ได้)
  action: 'update',                // 'create'|'update'|'delete'|'stage_change'|'item_change'
  resource_label: order.order_number, // ชื่อที่คนอ่านเข้าใจ
  old_data: prev,                  // ค่าก่อน (ให้ diff คำนวณ changed_fields เอง)
  new_data: next,                  // ค่าหลัง
  created_by: { id: user.id, name: profileName },
});
```

## กฎ
- **เรียกหลังทำสำเร็จ** (หลัง insert/update/delete สำเร็จ) ไม่ใช่ก่อน
- ใส่ `old_data` + `new_data` คู่กันเมื่อเป็น update → ได้ `changed_fields` อัตโนมัติ
- `resource_label` ใส่ค่าที่อ่านรู้เรื่อง (เลขออเดอร์/ชื่อสินค้า) ไม่ใช่แค่ UUID
- `created_by` = ผู้ใช้ปัจจุบันจาก `AuthContext` ({id, name})
- **ห้ามใส่ secret/PII เกินจำเป็น** ลง old_data/new_data/metadata
- `logAction` ไม่ throw (กันกระทบ main flow) — แต่อย่าพึ่งให้มันเงียบ; เช็คว่ามันถูกเรียกจริง
- audit_logs เป็น **immutable** (ไม่มี update/delete policy) — ออกแบบให้เขียนครั้งเดียวถูกต้อง

## ครอบคลุมที่ไหน
ทุก create/update/delete + stage_change ใน: products, customers, orders, services, assembly,
marketing, stock เมื่อเพิ่ม module/action ใหม่ → เพิ่ม logAction ให้ครบ

## Output
1. จุดที่เพิ่ม logAction (file:line)
2. resource_type/action/label ที่ใช้
3. ยืนยันเรียกหลังสำเร็จ + ไม่ leak PII เกินจำเป็น
4. action ไหนที่ยังขาด audit (ถ้าพบ)
