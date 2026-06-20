# AGENTS.md — MomenManagement (admin)

> ไฟล์นี้สำหรับ AI/เครื่องมือช่วยเขียนโค้ดทุกตัว (Codex, Cursor, Copilot, Gemini, ฯลฯ)
> **อ่านไฟล์ความจริงเหล่านี้ก่อนเริ่มงานเสมอ** แล้วทำตามกติกาในนั้น:

1. `CLAUDE.md` — convention + วิธีทำงานเป็นทีมของแอปนี้
2. `AI_CONTEXT.md` — architecture, modules, RBAC, audit, stock/assembly, changelog, TODO
3. `../SHARED_CONTEXT.md` — DB schema + security model ที่ใช้ร่วมกับ storefront (อ่านเมื่อแตะ DB)
4. `../SANDBOX.md` — วิธีพัฒนา/ทดสอบบน DB จำลองก่อนขึ้น prod

## กฎเหล็ก (ห้ามฝ่าฝืน ไม่ว่า AI ตัวไหน)
- **DB เป็น Supabase (PostgreSQL) ตัวเดียวที่แชร์กับ storefront** — แก้ schema ต้อง **additive** และ
  ไม่ทำให้อีกแอปพัง
- **งานที่แตะ schema/DB ต้องทำผ่าน sandbox**: พัฒนาบน Supabase local → migration → ROLLBACK-test บน prod
  → review → push **ห้ามแก้ schema prod ด้วยมือผ่าน Dashboard** (ดู `../SANDBOX.md`)
- **RBAC**: ทุก action สำคัญ guard ด้วย `can(resource, action)` (ระวัง fail-open — ดู AI_CONTEXT §5)
- **Audit**: create/update/delete สำคัญต้องเรียก `logAction()`
- **service-role** (`supabaseAdmin.js`) ใช้ใน server route เท่านั้น ห้าม import เข้า client / ห้ามขึ้นต้น `NEXT_PUBLIC_`
- **เงิน** = THB, charge เป็นสตางค์ (×100)
- งานแตะ auth/order/pricing/RLS/migration/payment/upload → ต้องผ่านการ review ความปลอดภัย
- หลังแก้สำคัญ → อัปเดต `AI_CONTEXT.md` (Changelog + TODO) และ `../SHARED_CONTEXT.md` ถ้าแตะ schema/security

## โครงทีม (ถ้าเครื่องมือรองรับ subagent/role)
playbook + บทบาทอยู่ใน `.claude/agents/` และ `.claude/skills/` (และ source ที่ `ai-team/` + `../ai-team-shared/`)
ถ้าเครื่องมือไม่มีระบบ subagent ให้ AI อ่านไฟล์เหล่านั้นเป็น "บทบาท/ขั้นตอน" แล้วทำตามลำดับเอง

## ธีม/ดีไซน์
แอปนี้ใช้ Tailwind v4 + lucide + pattern module `Main/List/Form/Detail` ให้ดูของเดิมเป็นแบบก่อนเขียนใหม่
(ธีมหน้าร้าน "Momen Vision" อยู่ที่ `../MomenStore/AI_CONTEXT.md §9`)
