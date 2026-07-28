import { supabase } from '@/lib/supabase';

// Tag กลางของทีม — ทุกคนเห็นและใช้ร่วมกัน (ต่างจาก userTags ที่เป็นส่วนตัวต่อคน)
// scope: กลุ่มการใช้งาน เช่น 'finance' | resourceType: 'finance_txn' ฯลฯ

export async function fetchSharedTags(scope = 'finance') {
  const { data, error } = await supabase
    .from('shared_tags')
    .select('id, name, color, created_by')
    .eq('scope', scope)
    .order('created_at');
  if (error) return [];
  return data || [];
}

export async function createSharedTag(scope, name, color, createdBy = null) {
  const { data, error } = await supabase
    .from('shared_tags')
    .insert([{ scope, name: name.trim(), color, created_by: createdBy }])
    .select('id, name, color, created_by')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSharedTag(tagId) {
  const { error } = await supabase.from('shared_tags').delete().eq('id', tagId); // links ลบตาม (cascade)
  if (error) throw error;
}

// คืน map: { [resourceId string]: [tagId, ...] }
export async function fetchSharedTagLinks(scope, resourceType) {
  const { data: tags, error: tagError } = await supabase
    .from('shared_tags').select('id').eq('scope', scope);
  if (tagError || !tags?.length) return {};
  const { data, error } = await supabase
    .from('shared_tag_links')
    .select('tag_id, resource_id')
    .eq('resource_type', resourceType)
    .in('tag_id', tags.map((t) => t.id));
  if (error) return {};
  const map = {};
  (data || []).forEach((r) => { (map[r.resource_id] = map[r.resource_id] || []).push(r.tag_id); });
  return map;
}

export async function toggleSharedTagLink(tagId, resourceType, resourceId) {
  const rid = String(resourceId);
  const { data } = await supabase
    .from('shared_tag_links').select('id')
    .eq('tag_id', tagId).eq('resource_type', resourceType).eq('resource_id', rid)
    .maybeSingle();
  if (data) {
    const { error } = await supabase.from('shared_tag_links').delete().eq('id', data.id);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from('shared_tag_links').insert([{ tag_id: tagId, resource_type: resourceType, resource_id: rid }]);
  if (error) throw error;
  return true;
}
