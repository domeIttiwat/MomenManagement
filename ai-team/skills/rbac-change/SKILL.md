---
name: rbac-change
description: |
  เพิ่ม/แก้ resource หรือ action ในระบบสิทธิ์ (RBAC) ของ MomenManagement อย่างปลอดภัย โดยไม่ทำให้ role
  เดิมถูกล็อกออก หรือเกิดช่อง fail-open. ใช้เมื่อจะเพิ่ม resource ใหม่ (เช่น 'stock'), เพิ่ม sub-action
  (เช่น stock_in/delete_tx), หรือแก้ตรรกะ can()/RoleManager/role_permissions.
---

# rbac-change

ระบบสิทธิ์บอบบางและเคยมีบั๊ก fail-open มาแล้ว skill นี้บังคับขั้นตอนปลอดภัย

## อ่านก่อน
`AI_CONTEXT.md` §5, `src/app/context/AuthContext.js`, `src/app/components/users/RoleManager.js`,
`src/app/hooks/usePermission.js`

## เข้าใจ `can()` ก่อน
```js
if (!permissions || permissions.length === 0) return true;  // role ว่าง → อนุญาต (backward compat)
const perm = permissions.find(p => p.resource === resource);
if (!perm) return false;                                     // มี record แต่ไม่พบ resource → ปฏิเสธ
return perm.actions?.[action] === true;
```
**กับดัก:** เพิ่ม resource ใหม่ → role ที่ตั้งค่ามาก่อน (มี record แต่ไม่มี resource นี้) จะถูก **ปฏิเสธ**
→ ผู้ใช้เดิมเข้าฟีเจอร์ใหม่ไม่ได้จนกว่าจะเติม row

## ขั้นตอนเพิ่ม resource/action ใหม่ (ทำครบทุกข้อ)
1. ตั้งชื่อ resource/action ให้ตรง pattern เดิม (resource: เอกพจน์ เช่น `stock`; action: `view/create/
   edit/delete` + sub-action เฉพาะ เช่น `stock_in`, `stock_out`, `delete_tx`)
2. อัปเดต **RoleManager** ให้แสดง resource/action ใหม่ + **auto-insert row ที่ขาดให้ทุก role** ตอนเลือก role
3. **เติม row ใน `role_permissions` ให้ทุก role ที่มีอยู่** (ผ่าน RoleManager หรือ migration) —
   ตัดสินใจ default ของแต่ละ role ว่าควรเปิด/ปิด (ปลอดภัยไว้ก่อน: ปิด แล้วเปิดเฉพาะ role ที่ควรมี)
4. ใส่ guard `can('<res>','<action>')` ที่ทุกปุ่ม/หน้า/route ที่เกี่ยว
5. ถ้าแตะตาราง `role_permissions` แบบ migration → additive + ผ่าน `supabase-migration` + `cross-app-impact`
   (storefront ไม่ใช้ตารางนี้ แต่ยังต้องยืนยัน)

## ต้องทดสอบครบทุกชนิด role
- role ที่ **ให้สิทธิ์** → เข้าได้/ปุ่มโผล่
- role ที่ **ไม่ให้สิทธิ์** → เข้าไม่ได้/ปุ่มซ่อน (ไม่ใช่แค่ disabled ฝั่ง UI)
- role **ว่าง (ไม่มี record เลย)** → ยัง backward-compat (อนุญาต) ตามตั้งใจ
- role **เดิมที่มี record แต่ยังไม่ถูกเติม resource ใหม่** → ยืนยันว่า RoleManager เติมให้แล้ว ไม่ถูกล็อกออกโดยพลาด

## Output
1. resource/action ที่เพิ่ม/แก้
2. ไฟล์ที่แก้ (AuthContext/RoleManager/guard ในแต่ละหน้า)
3. ผลต่อ role เดิม + วิธีเติม row
4. ผลทดสอบทุกชนิด role
5. ความเสี่ยง fail-open ที่เหลือ + ต้องผ่าน security-reviewer ไหม

## Rules
- ปลอดภัยมาก่อนสะดวก — default ปิด เปิดเฉพาะที่ตั้งใจ
- ไม่ปล่อยให้มีปุ่ม/route ไหนไม่มี guard
