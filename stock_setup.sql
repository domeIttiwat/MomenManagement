-- =====================================================
-- Stock Management System — Setup Script
-- รันใน Supabase SQL Editor
-- =====================================================

-- 1. stores — พื้นที่/คลังเก็บของ
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  location_detail TEXT,
  images JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. stock_items — ระดับสต๊อกปัจจุบัน
CREATE TABLE stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0,
  min_quantity INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique indexes (NULL != NULL ใน PostgreSQL)
CREATE UNIQUE INDEX stock_items_with_variant ON stock_items(product_id, variant_id) WHERE variant_id IS NOT NULL;
CREATE UNIQUE INDEX stock_items_no_variant   ON stock_items(product_id)             WHERE variant_id IS NULL;

-- 3. stock_transactions — ประวัติการเคลื่อนไหว
CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('stock_in', 'stock_out', 'adjustment')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  store_id UUID REFERENCES stores(id),
  note TEXT,
  reference_type TEXT CHECK (reference_type IN ('order', 'service', 'manual')),
  reference_id UUID,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_stores"     ON stores           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_stock_items" ON stock_items      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_stock_tx"   ON stock_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- Supabase Storage bucket สำหรับรูป Store
-- =====================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('stores', 'stores', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_stores_images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'stores')
  WITH CHECK (bucket_id = 'stores');

-- =====================================================
-- Permission resource
-- =====================================================
INSERT INTO role_permissions (role_id, resource, actions)
SELECT id, 'stock', '{"view":true,"create":true,"edit":true,"delete":true}'::jsonb
FROM roles
ON CONFLICT DO NOTHING;
