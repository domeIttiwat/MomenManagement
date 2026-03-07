-- ============================================================
-- audit_logs: เก็บประวัติการเปลี่ยนแปลงทุกโมดูล
-- รัน script นี้ใน Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_type TEXT          NOT NULL,       -- 'product' | 'customer' | 'order' | 'service' | 'assembly' | 'marketing' | 'stock'
  resource_id   UUID,                         -- UUID ของรายการที่เปลี่ยนแปลง (NULL ได้)
  action        TEXT          NOT NULL,       -- 'create' | 'update' | 'delete' | 'stage_change' | 'item_change'
  resource_label TEXT,                        -- ชื่อที่อ่านได้ เช่น ชื่อสินค้า, เลขออเดอร์
  old_data      JSONB,                        -- ค่าก่อนเปลี่ยนแปลง
  new_data      JSONB,                        -- ค่าหลังเปลี่ยนแปลง
  changed_fields JSONB,                       -- Array ชื่อ field ที่เปลี่ยน
  metadata      JSONB,                        -- ข้อมูลเพิ่มเติม
  created_by    JSONB,                        -- { id, name } ของผู้กระทำ
  created_at    TIMESTAMPTZ   DEFAULT NOW()   NOT NULL
);

-- Index สำหรับ query หลัก
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type    ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id      ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at       ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action           ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_type_id          ON audit_logs(resource_type, resource_id);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users สามารถ insert ได้
CREATE POLICY "auth_insert_audit_logs" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated users สามารถ select ได้
CREATE POLICY "auth_select_audit_logs" ON audit_logs
  FOR SELECT TO authenticated USING (true);

-- ไม่อนุญาต update/delete (log ควร immutable)
