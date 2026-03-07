import { supabase } from '@/lib/supabase';

/**
 * บันทึก audit log
 * ไม่ throw error เพื่อไม่ให้กระทบ main flow
 *
 * @param {Object} params
 * @param {string} params.resource_type  - 'product' | 'customer' | 'order' | 'service' | 'assembly' | 'marketing' | 'stock'
 * @param {string} [params.resource_id]  - UUID ของรายการ
 * @param {string} params.action         - 'create' | 'update' | 'delete' | 'stage_change' | 'item_change'
 * @param {string} [params.resource_label] - ชื่อที่อ่านได้ เช่น ชื่อสินค้า เลขออเดอร์
 * @param {Object} [params.old_data]     - ค่าก่อนเปลี่ยน
 * @param {Object} [params.new_data]     - ค่าหลังเปลี่ยน
 * @param {Object} [params.metadata]     - ข้อมูลเพิ่มเติม
 * @param {Object} [params.created_by]   - { id, name }
 */
export const logAction = async ({
  resource_type,
  resource_id,
  action,
  resource_label,
  old_data,
  new_data,
  metadata,
  created_by,
}) => {
  try {
    let changed_fields = null;

    if (old_data && new_data) {
      const allKeys = new Set([...Object.keys(old_data), ...Object.keys(new_data)]);
      changed_fields = [...allKeys].filter(
        (k) => JSON.stringify(old_data[k]) !== JSON.stringify(new_data[k])
      );
    }

    await supabase.from('audit_logs').insert([
      {
        resource_type,
        resource_id: resource_id || null,
        action,
        resource_label: resource_label || null,
        old_data: old_data || null,
        new_data: new_data || null,
        changed_fields: changed_fields ? changed_fields : null,
        metadata: metadata || null,
        created_by: created_by || null,
      },
    ]);
  } catch (err) {
    console.error('[AuditLog] Failed:', err);
  }
};
