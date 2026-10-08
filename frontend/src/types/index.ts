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
  ownerId?: string;
  /** Non-null while a member's request to edit/cancel this SCHEDULED post awaits officer/admin review. */
  appealType?: 'EDIT' | 'CANCEL' | null;
  /** True once an officer/admin approved an EDIT appeal — the owner gets one edit before this resets. */
  editUnlocked?: boolean;
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
  /** Bytes; null for assets uploaded before sizes were recorded. */
  fileSize?: number | null;
  /** ISO timestamp of the upload. */
  createdAt?: string | null;
  /** Display name (or email) of whoever uploaded it. */
  uploadedBy?: string | null;
}

export interface MediaBulkDeleteResult {
  deleted: string[];
  skipped: { id: string; fileName: string; reason: string }[];
}

export type Tone = 'FORMAL' | 'ENERGETIC' | 'CELEBRATORY' | 'URGENT';

export type OrgType = 'UNIVERSITY' | 'DEPARTMENT' | 'PROGRAM';
export type OrgRole = 'ADMIN' | 'OFFICER' | 'CONTRIBUTOR' | 'MEMBER';
export type MembershipStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface OrgProfileFields {
  description?: string | null;
  fullName?: string | null;
  audience?: string | null;
  focusAreas?: string | null;
  languagePref?: string | null;
  officialHashtags?: string | null;
  captionAvoid?: string | null;
}

export type OrgProfileUpdatePayload = Partial<OrgProfileFields>;

export interface MyMembership extends OrgProfileFields {
  orgId: string;
  orgName: string;
  orgType: OrgType;
  role: OrgRole;
  status: MembershipStatus;
}

export interface OrgSummary extends OrgProfileFields {
  id: string;
  name: string;
  type: OrgType;
  parentOrgId: string | null;
}

export interface OrgDetail extends OrgProfileFields {
  id: string;
  name: string;
  type: OrgType;
  parentOrgId: string | null;
  parentOrgName: string | null;
  joinCode: string;
  /** University-only code that departments/programs enter to be linked under it. */
  joinId: string | null;
  openJoin: boolean;
}

/** Officer/admin view of an org on its Manage screen. */
export interface OrgManageDetail extends OrgDetail {
  /** May change roles and regenerate codes (org admin, or admin of its parent university). */
  canAdminister: boolean;
  /** Viewer can manage the parent university, so the page links back to it. */
  canManageParent: boolean;
}

export interface SubOrg {
  id: string;
  name: string;
  type: OrgType;
  memberCount: number;
  pendingCount: number;
  createdAt: string;
}

/** Member-facing view of an approved org member (no admin-only fields). */
export interface OrgMember {
  userId: string;
  email: string;
  role: OrgRole;
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