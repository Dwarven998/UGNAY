import axiosClient from '../../../api/axiosClient';
import type { ApiResponse } from '../../../api/axiosClient';
import type {
  MyMembership, OrgSummary, OrgDetail, OrgManageDetail, SubOrg, OrgMember, OrgMembership, OrgType, OrgRole,
} from '../../../types';

// Member-facing (/api/app/organizations/**)
export const organizationApi = {
  listMine: () =>
    axiosClient.get<MyMembership[]>('/api/app/organizations/mine').then((r: ApiResponse<MyMembership[]>) => r.data),

  joinByCode: (joinCode: string) =>
    axiosClient.post<MyMembership>('/api/app/organizations/join', { joinCode }).then((r: ApiResponse<MyMembership>) => r.data),

  getOrg: (orgId: string) =>
    axiosClient.get<OrgSummary>(`/api/app/organizations/${orgId}`).then((r: ApiResponse<OrgSummary>) => r.data),

  listMembers: (orgId: string) =>
    axiosClient.get<OrgMember[]>(`/api/app/organizations/${orgId}/members`).then((r: ApiResponse<OrgMember[]>) => r.data),

  leave: (orgId: string) =>
    axiosClient.delete(`/api/app/organizations/${orgId}/membership`),
};

// Officer/Admin-only (/api/admin/organizations/**)
export const organizationAdminApi = {
  /** `parentJoinId` (optional, departments/programs only) links the new org under that university. */
  create: (name: string, type: OrgType, parentJoinId: string | null, openJoin: boolean) =>
    axiosClient.post<OrgDetail>('/api/admin/organizations', { name, type, parentJoinId, openJoin })
      .then((r: ApiResponse<OrgDetail>) => r.data),

  getDetails: (orgId: string) =>
    axiosClient.get<OrgManageDetail>(`/api/admin/organizations/${orgId}`)
      .then((r: ApiResponse<OrgManageDetail>) => r.data),

  regenerateJoinCode: (orgId: string) =>
    axiosClient.post<{ joinCode: string }>(`/api/admin/organizations/${orgId}/join-code/regenerate`)
      .then((r: ApiResponse<{ joinCode: string }>) => r.data),

  regenerateJoinId: (orgId: string) =>
    axiosClient.post<{ joinId: string }>(`/api/admin/organizations/${orgId}/join-id/regenerate`)
      .then((r: ApiResponse<{ joinId: string }>) => r.data),

  listSubOrgs: (orgId: string) =>
    axiosClient.get<SubOrg[]>(`/api/admin/organizations/${orgId}/sub-orgs`)
      .then((r: ApiResponse<SubOrg[]>) => r.data),

  unlinkSubOrg: (orgId: string, subOrgId: string) =>
    axiosClient.delete(`/api/admin/organizations/${orgId}/sub-orgs/${subOrgId}`),

  listMembers: (orgId: string) =>
    axiosClient.get<OrgMembership[]>(`/api/admin/organizations/${orgId}/members`)
      .then((r: ApiResponse<OrgMembership[]>) => r.data),

  approveMember: (orgId: string, membershipId: string) =>
    axiosClient.post<OrgMembership>(`/api/admin/organizations/${orgId}/members/${membershipId}/approve`)
      .then((r: ApiResponse<OrgMembership>) => r.data),

  rejectMember: (orgId: string, membershipId: string) =>
    axiosClient.post<OrgMembership>(`/api/admin/organizations/${orgId}/members/${membershipId}/reject`)
      .then((r: ApiResponse<OrgMembership>) => r.data),

  changeRole: (orgId: string, membershipId: string, role: OrgRole) =>
    axiosClient.patch<OrgMembership>(`/api/admin/organizations/${orgId}/members/${membershipId}/role`, { role })
      .then((r: ApiResponse<OrgMembership>) => r.data),
};
