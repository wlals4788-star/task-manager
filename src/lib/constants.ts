export const DEPARTMENTS = ['인사관리', '총무', '세무회계', '정산', '교육'] as const;
export type Department = typeof DEPARTMENTS[number];

export const KIND_LABEL = {
  regular: '정기',
  ad_hoc: '수시',
  standing: '상시',
} as const;
export type Kind = keyof typeof KIND_LABEL;

export const FREQUENCY_LABEL = {
  daily: '일',
  weekly: '주',
  monthly: '월',
  quarterly: '분기',
  semiannual: '반기',
  annual: '연',
} as const;
export type Frequency = keyof typeof FREQUENCY_LABEL;

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const EMAIL_DOMAIN = 'company.local';
export const toEmail = (loginId: string) => `${loginId}@${EMAIL_DOMAIN}`;
