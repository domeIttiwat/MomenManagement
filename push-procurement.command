#!/bin/bash
# push-procurement.command — commit เฉพาะงาน procurement รอบนี้ แล้ว push ขึ้น GitHub
# (ดับเบิลคลิกรันบนเครื่อง Mac — ใช้ GitHub credential ที่ login ไว้แล้ว)
# *ไม่ยุ่ง* กับไฟล์อื่นที่คุณแก้ค้างไว้เอง — เพิ่มเฉพาะไฟล์ด้านล่าง
cd "$(dirname "$0")" || exit 1

echo "==> ปลด index.lock ที่ค้าง (ถ้ามี)"
rm -f .git/index.lock

echo "==> branch ปัจจุบัน: $(git branch --show-current)"

echo "==> stage เฉพาะไฟล์งาน procurement รอบนี้"
git add \
  src/app/components/procurement \
  src/lib/stockLots.js \
  AI_CONTEXT.md

echo "==> ไฟล์ที่จะ commit:"
git status --short -- src/app/components/procurement src/lib/stockLots.js AI_CONTEXT.md

git commit -m "feat(procurement): receive-to-stock location picker + FIFO drift fix + timeline/list UI

- fix schema drift: เพิ่ม thai_freight_thb/paid_amount_thb (prod) + guard ใน receivePurchaseOrder
- ReceiveStockModal: เลือกคลังปลายทางต่อรายการตอนรับเข้าสต๊อก, ผูก FIFO lot ตามคลังที่เลือก
- แยก timeline เป็น 'ประวัติสถานะ' (update_type/status) กับ 'คอมเมนต์'
- OrderList: เปลี่ยนจาก Kanban เป็น list rows + mini stage stepper; OrderStageTracker สะอาดขึ้น"

echo
echo "==> push ขึ้น origin"
git push origin "$(git branch --show-current)"

echo
echo "เสร็จแล้ว — กด Enter เพื่อปิด"
read -r _
