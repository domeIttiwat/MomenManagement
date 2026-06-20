---
name: sandbox-workflow
description: |
  Playbook สำหรับพัฒนา/ทดสอบระบบใหม่ที่แตะฐานข้อมูลแบบ local-first บน Supabase local stack ก่อน
  แล้วดันเฉพาะ migration ขึ้น prod อย่างปลอดภัย. ใช้เมื่อจะเพิ่ม/แก้ schema, ตาราง, RLS, function,
  storage หรือ "ลองระบบใหม่ก่อนใช้จริง" / "ทำ sandbox" / "เทสก่อน deploy DB".
---

# sandbox-workflow

ทำให้การเพิ่มระบบใหม่ที่แตะ DB ปลอดภัย: ลองในเครื่องจนครบ loop แล้วค่อยส่ง schema ขึ้น prod
(ข้อมูลจริงไม่หาย อีกแอปไม่พัง) — รายละเอียดเต็มใน `../SANDBOX.md`

## เมื่อไหร่ใช้ / ไม่ใช้
- **ใช้**: งานแตะ schema/ตาราง/คอลัมน์/RLS/policy/function/trigger/storage
- **ไม่ใช้**: งานแตะแค่ UI/โค้ด (ไม่แตะ DB) → git branch + `npm run dev` พอ

## เครื่องมือ (ผู้ใช้ติดตั้งบนเครื่องเอง)
Docker Desktop + Supabase CLI · ตรวจ: `./scripts/sandbox.sh check`
> AI รัน Docker/`supabase start` บนเครื่องผู้ใช้ไม่ได้ → ออกคำสั่งให้ผู้ใช้รัน แล้วทำต่อจากผลลัพธ์

## Loop มาตรฐาน
1. `./scripts/sandbox.sh pull` — ดึง schema prod ล่าสุด (กัน drift) **(ครั้งแรกใช้ `init` = login+link+pull)**
2. `./scripts/sandbox.sh up` — ยก local stack → ก๊อป `.env.sandbox.example` เป็น `.env.local` เติม key จาก `supabase status`
3. แก้ schema บน local (Studio/SQL) + เขียนโค้ดแอป + **เทสครบ loop ทั้งสองแอป** (anon + authenticated)
4. `./scripts/sandbox.sh diff <ชื่อ>` — แปลงการแก้เป็นไฟล์ migration (additive + idempotent)
5. `./scripts/sandbox.sh reset` — ล้าง+สร้างใหม่จาก migration+seed → ยืนยัน migration รันสะอาดจากศูนย์
6. `cross-app-impact` — เช็คกระทบอีกแอปไหม · `security-reviewer` — ถ้าแตะ auth/order/pricing/RLS/permission
7. **ROLLBACK-test บน prod** ผ่าน Supabase MCP: `BEGIN; <migration SQL>; <verify queries>; ROLLBACK;`
   (พิสูจน์ว่าเข้ากับข้อมูลจริงที่ local ไม่มี)
8. `./scripts/sandbox.sh push` — ดัน migration ขึ้น prod (มีถามยืนยัน)
9. `get_advisors(security)` บน prod + `docs-keeper` อัปเดต `SHARED_CONTEXT.md` §4–§6

## กฎเหล็ก
- ไหลขึ้น prod **เฉพาะ schema (migration) ไม่ใช่ data**; local ใช้ seed/ข้อมูลปลอม — **ห้าม PII จริง**
- **ยัง ROLLBACK-test บน prod ก่อน push เสมอ** (local ว่าง/seed ≠ prod มีข้อมูล)
- migration ต้อง **additive + idempotent** (ดู skill `supabase-migration`) ไม่ทำให้อีกแอปพัง
- **ห้ามแก้ schema prod ด้วยมือผ่าน Dashboard** — ทุกอย่างผ่าน migration (กัน drift)
- `.env.local` ของ sandbox ต้องชี้ local (127.0.0.1) เท่านั้น

## Required Output Format
1. ขอบเขต: แตะ DB หรือไม่ (ถ้าไม่ → แจ้งว่าไม่ต้อง sandbox)
2. ขั้น local ที่ทำ + ผลเทส loop
3. migration ที่ได้ (additive/idempotent?) + cross-app impact
4. security review + ผล ROLLBACK-test บน prod
5. แผน push + rollback + verification
6. Test status: Pass / Fail / Not run (ตามจริง)
