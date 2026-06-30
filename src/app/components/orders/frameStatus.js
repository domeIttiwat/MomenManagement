export const FRAME_STATUS = {
  NOT_REQUIRED: 'not_required',
  NOT_STARTED: 'not_started',
  ORDERED: 'ordered',
  MAKING: 'making',
  COMPLETED: 'completed',
};

export const FRAME_STATUS_OPTIONS = [
  { value: FRAME_STATUS.NOT_STARTED, label: 'ยังไม่ทำโครง' },
  { value: FRAME_STATUS.ORDERED, label: 'สั่งทำโครงแล้ว' },
  { value: FRAME_STATUS.MAKING, label: 'ทำโครงแล้ว' },
  { value: FRAME_STATUS.COMPLETED, label: 'โครงเสร็จแล้ว' },
];

export const FRAME_STATUS_LABELS = {
  [FRAME_STATUS.NOT_REQUIRED]: 'ไม่ต้องทำโครง',
  [FRAME_STATUS.NOT_STARTED]: 'ยังไม่ทำโครง',
  [FRAME_STATUS.ORDERED]: 'สั่งทำโครงแล้ว',
  [FRAME_STATUS.MAKING]: 'ทำโครงแล้ว',
  [FRAME_STATUS.COMPLETED]: 'โครงเสร็จแล้ว',
};

export const FRAME_STATUS_STYLES = {
  [FRAME_STATUS.NOT_REQUIRED]: 'bg-gray-100 text-gray-500 border-gray-200',
  [FRAME_STATUS.NOT_STARTED]: 'bg-slate-50 text-slate-700 border-slate-200',
  [FRAME_STATUS.ORDERED]: 'bg-sky-50 text-sky-700 border-sky-200',
  [FRAME_STATUS.MAKING]: 'bg-amber-50 text-amber-700 border-amber-200',
  [FRAME_STATUS.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const hasFrameRequiredItems = (items = []) =>
  items.some((item) => item?.requires_frame === true);

export const normalizeFrameStatus = (status, requiresFrame) => {
  if (!requiresFrame) return FRAME_STATUS.NOT_REQUIRED;
  return FRAME_STATUS_OPTIONS.some((option) => option.value === status)
    ? status
    : FRAME_STATUS.NOT_STARTED;
};

export const getFrameStatusLabel = (status) =>
  FRAME_STATUS_LABELS[status] || FRAME_STATUS_LABELS[FRAME_STATUS.NOT_REQUIRED];

export const getFrameStatusStyle = (status) =>
  FRAME_STATUS_STYLES[status] || FRAME_STATUS_STYLES[FRAME_STATUS.NOT_REQUIRED];
