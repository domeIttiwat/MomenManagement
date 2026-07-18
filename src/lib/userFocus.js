import { supabase } from '@/lib/supabase';

// Focus ส่วนตัวต่อ user — ปักหมุดงานที่กำลังตั้งใจจัดการ (ตาราง user_focus)
// resourceType: 'order' | 'service'

export async function fetchFocusIds(profileId, resourceType) {
  if (!profileId) return new Set();
  const { data, error } = await supabase
    .from('user_focus')
    .select('resource_id')
    .eq('user_id', profileId)
    .eq('resource_type', resourceType);
  if (error) return new Set(); // ตารางยังไม่มี/โหลดพลาด → ถือว่าไม่มี focus ไม่ให้พังหน้า
  return new Set((data || []).map((r) => String(r.resource_id)));
}

// toggle แล้วคืนค่าสถานะใหม่ (true = โฟกัสอยู่)
export async function toggleFocus(profileId, resourceType, resourceId) {
  if (!profileId) throw new Error('ยังไม่ได้ล็อกอิน');
  const rid = String(resourceId);
  const { data: existing, error: findError } = await supabase
    .from('user_focus')
    .select('id')
    .eq('user_id', profileId)
    .eq('resource_type', resourceType)
    .eq('resource_id', rid)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) {
    const { error } = await supabase.from('user_focus').delete().eq('id', existing.id);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase
    .from('user_focus')
    .insert([{ user_id: profileId, resource_type: resourceType, resource_id: rid }]);
  if (error) {
    if (error.code === '23505') return true; // กดซ้ำเร็ว ๆ ชน unique — ถือว่าโฟกัสแล้ว
    throw error;
  }
  return true;
}
