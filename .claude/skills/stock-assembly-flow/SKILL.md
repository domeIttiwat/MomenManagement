---
name: stock-assembly-flow
description: |
  ทำงานกับ flow สต๊อก/คลัง และการเบิก-คืนวัสดุในงานประกอบ (assembly) ของ MomenManagement ซึ่งเป็นส่วน
  ที่ซับซ้อนและเปราะที่สุด. ใช้เมื่อแตะ stock_items, stock_transactions, storage_locations,
  AssemblyDetail (เบิก/คืนคลัง), การปรับสต๊อก, หรือการเชื่อมออเดอร์→งานประกอบ.
---

# stock-assembly-flow

ส่วนนี้เกี่ยวกับ "จำนวนของจริง" และเงิน ผิดแล้วกระทบสต๊อก/บัญชี ต้องระวังเป็นพิเศษ

## อ่านก่อน
`AI_CONTEXT.md` §7 + §8, `../SHARED_CONTEXT.md` §4 (stock/assembly tables) + §6,
`src/app/components/stock/**`, `src/app/components/assembly/AssemblyDetail.js`

## โมเดลข้อมูล
- `stores` (สาขา) → `storage_locations` (ตำแหน่งในสาขา) → `stock_items` (จำนวนต่อ product/variant/location)
- ทุกการเคลื่อนไหวเขียน `stock_transactions` (`reference_type` รวม `'assembly'`) + `storage_location_logs`

## กฎสำคัญ (จากบั๊กที่เคยเจอ)
1. **Manual JS join เท่านั้นสำหรับ location/store/variant** — DB ไม่มี FK constraint ทำให้
   `location:location_id(...)` ของ Supabase คืน `null` เงียบ ๆ → fetch scalar columns แล้ว build
   lookup map ใน JS เอง (ทำ parallel)
2. **ทิศการปรับสต๊อก (+/−)** — adjustment เคยเป็นบวกเสมอ (บั๊ก) ต้องเคารพ sign จริง; มี live preview
   (ปัจจุบัน → หลังปรับ)
3. **เบิก/คืนในงานประกอบ (AssemblyDetail)**:
   - เบิก = หัก `stock_items` + log transaction (สีเขียว)
   - คืน = คืนเข้า `stock_items` + log (สีแดง); รายการที่คืนแล้วหายจากลิสต์ "เบิก"
   - **ลบใบงานประกอบ → auto-return วัสดุที่ยังไม่คืนทั้งหมด** กลับคลัง พร้อม note อัตโนมัติ
4. **Permission**: ใช้ `can('stock', 'stock_in'|'stock_out'|'delete_tx'|...)`; ดู skill `rbac-change`
   ถ้าจะเพิ่ม action
5. **Audit**: ทุกการเบิก/คืน/ปรับ/ลบ ควร `logAction()` (resource_type `'stock'`/`'assembly'`)

## ตรวจก่อนปิดงาน (edge cases)
- เบิกเกินจำนวนคงเหลือ? จำนวน 0/ติดลบ? เบิกแล้วคืนบางส่วน? คืนซ้ำ?
- ลบใบงานที่มีทั้งรายการคืนแล้วและยังไม่คืน → auto-return เฉพาะที่ยังไม่คืน
- สต๊อกข้ามสาขา/ข้าม location ถูกหักจากที่ถูกต้อง
- ยอดรวมหลังทำรายการตรงกับ transaction log

## Output
1. ไฟล์/ตารางที่แตะ
2. ผลต่อจำนวนสต๊อก + transaction ที่เกิด
3. join ที่ใช้ (ยืนยันว่า manual JS join)
4. permission + audit ที่ใส่
5. edge case ที่ทดสอบ + ส่ง qa-bug-hunter ไหม
