export interface Post {
  id: string;
  caption: string;
  hashtags: string[];
  tone: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
  scheduledAt?: string;
  mediaUrl?: string;
  fbPostId?: string;
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