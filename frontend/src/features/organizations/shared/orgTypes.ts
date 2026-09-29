import type { OrgType } from '../../../types';

export const ORG_TYPE_LABEL: Record<OrgType, string> = {
  UNIVERSITY: 'University',
  DEPARTMENT: 'Department',
  PROGRAM: 'Program',
};

export const ORG_TYPE_ICON: Record<OrgType, string> = {
  UNIVERSITY: 'fi-rr-school',
  DEPARTMENT: 'fi-rr-building',
  PROGRAM: 'fi-rr-graduation-cap',
};
