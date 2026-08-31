import { Role } from './types';

const ROLE_TABLE: Record<number, Role[]> = {
  4: ['SHERIFF', 'RENEGADE', 'OUTLAW', 'OUTLAW'],
  5: ['SHERIFF', 'RENEGADE', 'OUTLAW', 'OUTLAW', 'DEPUTY'],
  6: ['SHERIFF', 'RENEGADE', 'OUTLAW', 'OUTLAW', 'OUTLAW', 'DEPUTY'],
  7: ['SHERIFF', 'RENEGADE', 'OUTLAW', 'OUTLAW', 'OUTLAW', 'DEPUTY', 'DEPUTY'],
};

export function getRolesForCount(count: number): Role[] {
  const roles = ROLE_TABLE[count];
  if (!roles) throw new Error(`지원하지 않는 인원수: ${count}명`);
  return [...roles].sort(() => Math.random() - 0.5);
}