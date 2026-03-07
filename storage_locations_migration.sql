-- =====================================================
-- Storage Locations Migration
-- รันใน Supabase SQL Editor
-- =====================================================

-- 1. ตาราง storage_locations (ชั้นวาง / พื้นที่จัดเก็บ)
--    แต่ละ store มีได้หลายชั้นวาง
CREATE TABLE IF NOT EXISTS storage_locations (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID     NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code         TEXT     NOT NULL,          -- รหัส เช่น A-01, ชั้น1, B-03
  name         TEXT,                       -- ชื่อเพิ่มเติม (ไม่บังคับ)
  description  TEXT,                       -- คำอธิบาย
  is_active    BOOLEAN  DEFAULT true,
  sort_order   INTEGER  DEFAULT 0,
  created_by   UUID     REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, code)
);

ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_storage_locations" ON storage_locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 2. เพิ่ม location_id ใน stock_items
-- =====================================================
ALTER TABLE stock_items
  ADD COLUMN IF NOT EXISTS location_id UUID
  REFERENCES storage_locations(id) ON DELETE SET NULL;

-- ลบ unique indexes เดิม
DROP INDEX IF EXISTS stock_items_with_variant;
DROP INDEX IF EXISTS stock_items_no_variant;

-- Unique indexes ใหม่ ครอบคลุมทุก combination ของ NULL/NOT NULL
-- PostgreSQL: NULL != NULL ใน unique indexes → ต้องใช้ partial indexes

-- กรณี 1: มี variant + มี location
CREATE UNIQUE INDEX IF NOT EXISTS stock_items_full
  ON stock_items(product_id, variant_id, location_id)
  WHERE variant_id IS NOT NULL AND location_id IS NOT NULL;

-- กรณี 2: ไม่มี variant + มี location
CREATE UNIQUE INDEX IF NOT EXISTS stock_items_no_variant_has_loc
  ON stock_items(product_id, location_id)
  WHERE variant_id IS NULL AND location_id IS NOT NULL;

-- กรณี 3: มี variant + ไม่มี location (backward compat)
CREATE UNIQUE INDEX IF NOT EXISTS stock_items_has_variant_no_loc
  ON stock_items(product_id, variant_id)
  WHERE variant_id IS NOT NULL AND location_id IS NULL;

-- กรณี 4: ไม่มี variant + ไม่มี location (backward compat)
CREATE UNIQUE INDEX IF NOT EXISTS stock_items_base
  ON stock_items(product_id)
  WHERE variant_id IS NULL AND location_id IS NULL;

-- =====================================================
-- 3. เพิ่ม location_id ใน stock_transactions
-- =====================================================
ALTER TABLE stock_transactions
  ADD COLUMN IF NOT EXISTS location_id UUID
  REFERENCES storage_locations(id) ON DELETE SET NULL;
