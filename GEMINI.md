# GEMINI.md — MomenManagement (admin)

> ⚠️ เนื้อหา Firebase Studio เดิมถูกแทนที่แล้ว (แอปนี้ใช้ **Supabase** ไม่ใช่ Firebase)
> นี่คือ **pointer** ไปยังความจริงของโปรเจ็ค สำหรับ Gemini และเครื่องมือที่อ่านไฟล์นี้
> โปรดอ่านและทำตามไฟล์เหล่านี้ (เหมือนที่ระบุใน `AGENTS.md`):
>
> 1. `CLAUDE.md` — convention + วิธีทำงานเป็นทีม
> 2. `AI_CONTEXT.md` — architecture, modules, RBAC, audit, stock/assembly, changelog, TODO
> 3. `../SHARED_CONTEXT.md` — DB/security ที่ใช้ร่วมกับ storefront (อ่านเมื่อแตะ DB)
> 4. `../SANDBOX.md` — พัฒนา/ทดสอบบน DB จำลองก่อนขึ้น prod
>
> กฎเหล็กสรุป: DB Supabase แชร์กับ storefront → แก้ schema แบบ additive ผ่าน sandbox flow เท่านั้น,
> ห้ามแก้ prod ด้วยมือ; ทุก action guard `can()`; create/update/delete เรียก `logAction()`;
> service-role = server เท่านั้น; เงิน THB (สตางค์ ×100)
>
> รายละเอียดทั้งหมดอยู่ใน `AGENTS.md`
