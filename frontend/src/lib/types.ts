export type User = {
  id: number;
  username: string;
  display_name: string;
  phone: string;
  roles: string[];
  is_agent: boolean;
  has_active_access: boolean;
  access_expires_at: string | null;
};

export type AccessPlan = {
  id: "weekly" | "monthly";
  label: string;
  amount_ghs: number;
  days: number;
};

export type RatingStats = {
  overall_rating: number | null;
  total_ratings: number;
  avg_helpfulness: number | null;
  avg_responsiveness: number | null;
  avg_trustworthiness: number | null;
};

export type Agent = {
  id: string;
  display_name: string;
  primary_area: string;
  covered_areas: string[];
  short_bio: string;
  tiktok_handle: string;
  is_verified: boolean;
  rating_stats: RatingStats;
  contact_unlocked: boolean;
  phone: string | null;
  whatsapp: string | null;
  contacted?: boolean;
  access_plans?: AccessPlan[];
  reviews?: Review[];
};

export type Review = {
  id: string;
  overall: number;
  helpfulness: number;
  responsiveness: number;
  trustworthiness: number;
  comment: string;
  created_at: string;
};

export type ConversationThread = {
  id: string;
  peer_name: string;
  peer_subtitle: string;
  preview: string;
  unread_count: number;
  updated_at: string;
  last_message_at: string;
  mode: "renter" | "agent";
  agent_id?: string;
  renter_id?: number;
};

export type ChatMessage = {
  id: string;
  sender_id: number;
  content: string;
  is_read: boolean;
  media_type: string;
  media_url: string | null;
  created_at: string;
};

export type ConversationDetail = {
  id: string;
  mode: "renter" | "agent";
  peer_name: string;
  peer_subtitle: string;
  peer_profile_url: string;
  agent_id: string;
  can_send: boolean;
  messages: ChatMessage[];
};

export type ApiError = {
  detail?: string;
  [key: string]: unknown;
};
