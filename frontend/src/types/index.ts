export interface Post {
  id: string;
  caption: string;
  hashtags: string[];
  tone: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED' | 'PENDING_REVIEW' | 'REJECTED';
  scheduledAt?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaAssetIds?: string[];
  fbPostId?: string;
  orgId?: string | null;
}

export interface PostConflict {
  postId: string;
  caption: string;
  scheduledAt: string;
  status: string;
  mediaUrl?: string | null;
}

export interface MediaFolder {
  id: string;
  name: string;
  assetCount: number;
}

export interface MediaAsset {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
}

export type Tone = 'FORMAL' | 'ENERGETIC' | 'CELEBRATORY' | 'URGENT';

export type OrgType = 'UNIVERSITY' | 'DEPARTMENT' | 'PROGRAM';
export type OrgRole = 'ADMIN' | 'OFFICER' | 'CONTRIBUTOR' | 'MEMBER';
export type MembershipStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface MyMembership {
  orgId: string;
  orgName: string;
  orgType: OrgType;
  role: OrgRole;
  status: MembershipStatus;
}

export interface OrgSummary {
  id: string;
  name: string;
  type: OrgType;
  parentOrgId: string | null;
}

export interface OrgDetail {
  id: string;
  name: string;
  type: OrgType;
  parentOrgId: string | null;
  joinCode: string;
  openJoin: boolean;
}

export interface OrgMembership {
  membershipId: string;
  userId: string;
  email: string;
  role: OrgRole;
  status: MembershipStatus;
}

export interface OrgDirectory {
  id: string;
  title: string;
  uploadDeadline: string | null;
  allowedFileTypes: string[] | null;
  requiresApproval: boolean;
}

export interface OrgContributor {
  userId: string;
  email: string;
}

export interface MediaRecommendation {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  score: number;
  reason: string;
}