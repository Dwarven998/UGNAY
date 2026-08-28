import axiosClient from '../../../api/axiosClient';
import type { ApiResponse } from '../../../api/axiosClient';
import type {
  MyMembership, OrgSummary, OrgDetail, OrgMembership, OrgDirectory, OrgContributor, OrgType, OrgRole,
} from '../../../types';

// Member-facing (/api/app/organizations/**)
export const organizationApi = {
  listMine: () =>
    axiosClient.get<MyMembership[]>('/api/app/organizations/mine').then((r: ApiResponse<MyMembership[]>) => r.data),

  joinByCode: (joinCode: string) =>
    axiosClient.post<MyMembership>('/api/app/organizations/join', { joinCode }).then((r: ApiResponse<MyMembership>) => r.data),

  getOrg: (orgId: string) =>
    axiosClient.get<OrgSummary>(`/api/app/organizations/${orgId}`).then((r: ApiResponse<OrgSummary>) => r.data),
};

// Officer/Admin-only (/api/admin/organizations/**)
export const organizationAdminApi = {
  create: (name: string, type: OrgType, parentOrgId: string | null, openJoin: boolean) =>
    axiosClient.post<OrgDetail>('/api/admin/organizations', { name, type, parentOrgId, openJoin })
      .then((r: ApiResponse<OrgDetail>) => r.data),

  regenerateJoinCode: (orgId: string) =>
    axiosClient.post<{ joinCode: string }>(`/api/admin/organizations/${orgId}/join-code/regenerate`)
      .then((r: ApiResponse<{ joinCode: string }>) => r.data),

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

  listDirectories: (orgId: string) =>
    axiosClient.get<OrgDirectory[]>(`/api/admin/organizations/${orgId}/directories`)
      .then((r: ApiResponse<OrgDirectory[]>) => r.data),

  createDirectory: (orgId: string, title: string, requiresApproval: boolean) =>
    axiosClient.post<OrgDirectory>(`/api/admin/organizations/${orgId}/directories`, { title, requiresApproval })
      .then((r: ApiResponse<OrgDirectory>) => r.data),

  listContributors: (orgId: string, directoryId: string) =>
    axiosClient.get<OrgContributor[]>(`/api/admin/organizations/${orgId}/directories/${directoryId}/contributors`)
      .then((r: ApiResponse<OrgContributor[]>) => r.data),

  grantContributor: (orgId: string, directoryId: string, email: string) =>
    axiosClient.post<OrgContributor>(`/api/admin/organizations/${orgId}/directories/${directoryId}/contributors`, { email })
      .then((r: ApiResponse<OrgContributor>) => r.data),

  revokeContributor: (orgId: string, directoryId: string, userId: string) =>
    axiosClient.delete(`/api/admin/organizations/${orgId}/directories/${directoryId}/contributors/${userId}`),
};
