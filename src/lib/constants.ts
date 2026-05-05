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

function toHex(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// 아이디(한글 포함 모든 문자 허용)를 UTF-8 hex로 인코딩하여
// auth.users용 결정적 이메일을 생성. 'u' 접두사는 숫자/특수문자 시작 회피.
export const toEmail = (loginId: string) => `u${toHex(loginId.trim())}@${EMAIL_DOMAIN}`;
