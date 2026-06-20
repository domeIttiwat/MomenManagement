---
name: cross-app-impact
description: |
  เช็คผลกระทบข้ามแอปก่อนแก้สิ่งที่ MomenManagement (admin) และ MomenStore (storefront) ใช้ร่วมกัน —
  ตาราง/คอลัมน์/RLS, สถานะออเดอร์, assembly trigger, storage bucket, payment. ใช้ก่อนทุกการแก้ที่
  แตะ shared DB หรือ contract ที่อีกแอปพึ่งพา เพื่อกันไม่ให้แก้ฝั่งหนึ่งแล้วอีกฝั่งพัง/ข้อมูลเพี้ยน.
---

# cross-app-impact (shared)

จุดเสี่ยงที่สุดของสถาปัตยกรรม **2 แอป 1 DB** คือแก้ฝั่งหนึ่งแล้วอีกฝั่งพังเงียบ ๆ skill นี้บังคับให้
ตรวจก่อนลงมือ

## อ่านก่อน
`../SHARED_CONTEXT.md` §4 (schema) + §5 (security) + §6 (cross-app impact map)

## ขั้นตอนเช็ค (ทำก่อนแก้)
1. **ระบุของที่จะแตะ**: ตาราง/คอลัมน์/policy/สถานะ/bucket/route อะไรบ้าง
2. **ใครใช้บ้าง** — เปิด §6 map แล้วยืนยันด้วยการ grep โค้ดจริงทั้งสองแอป:
   - admin: `MomenManagement/src/**` (module ที่ query ตารางนั้น)
   - storefront: `MomenStore/src/lib/queries.js` + `MomenStore/src/app/**`
3. **ตรวจ contract ที่พึ่งพากัน** (ระวังเป็นพิเศษ):
   - สถานะออเดอร์ `'ส่งประกอบ'` = trigger Assembly queue ของ admin
   - `assembly_jobs` (ref_type='order', ref_id) = สะพานเชื่อมออเดอร์ → งานประกอบ
   - คอลัมน์ที่ storefront เพิ่ม (`model_url`, `model_config`, `public_token`, `store_id`,
     `build_spec`, `*_i18n`) — admin อาจไม่รู้จัก
   - `cost_price` ต้องไม่หลุดถึง anon
   - storage buckets (public) ที่ทั้งคู่อ่าน
4. **ประเมินทิศทาง**: การเปลี่ยนนี้ additive ไหม? ทำให้ query เดิมของอีกแอป return ต่างไปไหม?
   RLS ที่เปลี่ยนตัดสิทธิ์ที่อีกแอปต้องใช้ไหม?

## Output
1. ของที่แตะ
2. ผู้ใช้ทั้งสองฝั่ง (พร้อม file ที่ยืนยัน)
3. contract ที่พึ่งพากันที่เกี่ยว
4. ผลกระทบต่ออีกแอป: ไม่มี / additive ปลอดภัย / **breaking (หยุด)**
5. เงื่อนไขที่ต้องทำให้ปลอดภัย (เช่น เพิ่ม policy authenticated คู่กัน, แจ้งอีกแอปให้รองรับคอลัมน์ใหม่)
6. ต้องผ่าน `security-reviewer` / `supabase-engineer` ไหม

## Rules
- ถ้าพบว่า breaking → **หยุด** เสนอทางเลือก additive แทน
- ยืนยันด้วยโค้ดจริง ไม่เชื่อ map อย่างเดียว (map อาจล้าสมัย → แจ้ง docs-keeper)
