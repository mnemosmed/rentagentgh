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

export type ApiError = {
  detail?: string;
  [key: string]: unknown;
};
