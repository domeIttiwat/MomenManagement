-- =====================================================
-- Stock Migration V3
-- รันใน Supabase SQL Editor
-- รองรับ reference_type = 'assembly' สำหรับการเบิกวัสดุในงานประกอบ
-- =====================================================

-- ลบ constraint เดิมและสร้างใหม่ให้รองรับ 'assembly'
ALTER TABLE stock_transactions
  DROP CONSTRAINT IF EXISTS stock_transactions_reference_type_check;

ALTER TABLE stock_transactions
  ADD CONSTRAINT stock_transactions_reference_type_check
  CHECK (reference_type IN ('order', 'service', 'manual', 'assembly'));
