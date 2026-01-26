import { useAuth } from '../context/AuthContext';

export const usePermission = (resource) => {
  const { role, permissions, isImpersonating } = useAuth();

  // Supervisor เห็นทุกอย่างเสมอ (ยกเว้นตอนกำลังสวมบทบาทคนอื่น)
  if (role?.name === 'Supervisor' && !isImpersonating) {
    return {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canViewCost: true,
      canViewProfit: true,
      // ...อื่นๆ เป็น true หมด
    };
  }

  // หา Permission ของ resource ที่ต้องการ (เช่น 'products')
  const permission = permissions.find(p => p.resource === resource);
  const actions = permission?.actions || {};

  return {
    canView: actions.view || false,
    canCreate: actions.create || false,
    canEdit: actions.edit || false,
    canDelete: actions.delete || false,
    canViewCost: actions.show_cost || false,
    canViewProfit: actions.show_profit || false,
    ...actions // คืนค่าอื่นๆ เผื่อมี custom action
  };
};