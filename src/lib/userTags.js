import { supabase } from '@/lib/supabase';

// Tag ส่วนตัวต่อ user (แทนระบบ Focus เดิม) — ตาราง user_tags + user_tag_links
// resourceType: 'order' | 'service' — คนอื่นไม่เห็น Tag ของกันและกัน

export async function fetchUserTags(profileId) {
  if (!profileId) return [];
  const { data, error } = await supabase
    .from('user_tags')
    .select('id, name, color')
    .eq('user_id', profileId)
    .order('created_at');
  if (error) return [];
  return data || [];
}

export async function createTag(profileId, name, color) {
  if (!profileId) throw new Error('ยังไม่ได้ล็อกอิน');
  const { data, error } = await supabase
    .from('user_tags')
    .insert([{ user_id: profileId, name: name.trim(), color }])
    .select('id, name, color')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTag(tagId) {
  const { error } = await supabase.from('user_tags').delete().eq('id', tagId); // links ลบตาม (cascade)
  if (error) throw error;
}

// คืน map: { [resourceId string]: [tagId, ...] } เฉพาะ tag ของ user นี้
export async function fetchTagLinks(profileId, resourceType) {
  if (!profileId) return {};
  const { data: tags, error: tagError } = await supabase
    .from('user_tags').select('id').eq('user_id', profileId);
  if (tagError || !tags?.length) return {};
  const { data, error } = await supabase
    .from('user_tag_links')
    .select('tag_id, resource_id')
    .eq('resource_type', resourceType)
    .in('tag_id', tags.map((t) => t.id));
  if (error) return {};
  const map = {};
  (data || []).forEach((l) => {
    const rid = String(l.resource_id);
    (map[rid] = map[rid] || []).push(l.tag_id);
  });
  return map;
}

// toggle แล้วคืนสถานะใหม่ (true = ติด tag อยู่)
export async function toggleTagLink(tagId, resourceType, resourceId) {
  const rid = String(resourceId);
  const { data: existing, error: findError } = await supabase
    .from('user_tag_links')
    .select('id')
    .eq('tag_id', tagId)
    .eq('resource_type', resourceType)
    .eq('resource_id', rid)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) {
    const { error } = await supabase.from('user_tag_links').delete().eq('id', existing.id);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase
    .from('user_tag_links')
    .insert([{ tag_id: tagId, resource_type: resourceType, resource_id: rid }]);
  if (error) {
    if (error.code === '23505') return true; // กดซ้ำเร็ว ๆ
    throw error;
  }
  return true;
}
