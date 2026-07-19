import { supabase } from '@/lib/supabase';

// แจ้งเตือนในระบบ (ตาราง notifications) — ใช้กับระบบงานประกอบก่อน อนาคตใช้กับระบบอื่นได้
// userIds: profiles.id ผู้รับ | actorId: คนทำ (จะไม่แจ้งเตือนตัวเอง)
export async function notifyUsers({ userIds = [], title, body = null, linkType = 'work_card', linkId = null, actorId = null }) {
  const targets = [...new Set(userIds.filter(Boolean).map(String))].filter((id) => id !== String(actorId || ''));
  if (!targets.length || !title) return;
  try {
    await supabase.from('notifications').insert(targets.map((uid) => ({
      user_id: uid,
      title,
      body,
      link_type: linkType,
      link_id: linkId ? String(linkId) : null,
    })));
  } catch { /* แจ้งเตือนพลาดไม่ให้กระทบงานหลัก */ }
}

// ผู้เกี่ยวข้องของการ์ด: คนสร้าง + ผู้รับผิดชอบ
export const cardPeople = (card) => [
  card?.created_by?.id,
  ...(Array.isArray(card?.assignees) ? card.assignees.map((a) => a?.id) : []),
].filter(Boolean);
