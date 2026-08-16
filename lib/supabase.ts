/**
 * Supabase client initialization
 */

import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type VenueWithDetails = {
  id: string;
  name: string;
  type: string;
  address: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  floor_level?: string;
  has_lock?: boolean;
  has_changing_table?: boolean;
  has_sink?: boolean;
  has_power_outlet?: boolean;
  stroller_friendly?: boolean;
  dad_friendly?: boolean;
  has_diaper_mat?: boolean;
  can_buy_diaper?: boolean;
  distance_meters: number;
  last_confirmed_at?: string;
  negative_reports?: number;
  avg_rating?: number | null;
  review_count?: number;
  source?: string;
};

export type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type VenueDetail = {
  id: string;
  name: string;
  type: string;
  address: string;
  postal_code: string;
  location: { latitude: number; longitude: number };
  building_match_confidence: string;
  room_details?: {
    floor_level: string;
    has_changing_table: boolean;
    has_lock: boolean;
    has_sink: boolean;
    has_power_outlet: boolean;
    stroller_friendly: boolean;
    dad_friendly: boolean;
    has_diaper_mat: boolean;
    can_buy_diaper: boolean;
    notes: string;
  };
  confirmations_count?: number;
  last_confirmed_at?: string;
  photos?: { id: string; storage_path: string }[];
};
