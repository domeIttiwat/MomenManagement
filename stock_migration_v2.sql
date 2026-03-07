-- =====================================================
-- Stock Migration V2
-- รันใน Supabase SQL Editor
-- =====================================================

-- 1. เพิ่ม images column ใน stock_transactions
ALTER TABLE stock_transactions
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- =====================================================
-- 2. ตาราง storage_location_logs
--    บันทึก log การสร้าง / ลบ storage_location
-- =====================================================
CREATE TABLE IF NOT EXISTS storage_location_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID        REFERENCES storage_locations(id) ON DELETE SET NULL,
  store_id      UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  location_code TEXT        NOT NULL,
  action        TEXT        NOT NULL CHECK (action IN ('create', 'edit', 'delete')),
  note          TEXT,
  created_by    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE storage_location_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_location_logs" ON storage_location_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 3. Supabase Storage bucket สำหรับรูป stock transactions
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('stock', 'stock', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_stock_images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'stock')
  WITH CHECK (bucket_id = 'stock');
