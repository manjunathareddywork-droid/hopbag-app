/**
 * Database types for supabase-js. Hand-written to match supabase/migrations until a
 * project is linked; then replace with the generated file:
 *   supabase gen types typescript --linked > src/lib/database.types.ts
 */

export type RequestStatus =
  | 'draft'
  | 'open'
  | 'offered'
  | 'accepted'
  | 'paid'
  | 'picked_up'
  | 'delivered'
  | 'settled'
  | 'cancelled'
  | 'expired'
  | 'disputed'
  | 'refunded';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type IdDocumentType = 'aadhaar' | 'pan' | 'driving_licence' | 'passport' | 'voter_id';
export type TravelMode = 'train' | 'bus' | 'flight' | 'car' | 'other';
export type TripStatus = 'active' | 'cancelled' | 'completed';

type VerificationRow = {
  id: string;
  user_id: string;
  id_type: IdDocumentType;
  id_photo_path: string;
  status: ReviewStatus;
  reject_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type TripRow = {
  id: string;
  traveler_id: string;
  from_city_id: number;
  to_city_id: number;
  travel_date: string;
  mode: TravelMode;
  capacity_grams: number;
  max_items: number;
  pnr: string;
  ticket_photo_path: string;
  ticket_status: ReviewStatus;
  ticket_reject_reason: string | null;
  ticket_reviewed_by: string | null;
  ticket_reviewed_at: string | null;
  status: TripStatus;
  created_at: string;
  updated_at: string;
};

type TripWrite = {
  from_city_id: number;
  to_city_id: number;
  travel_date: string;
  mode: TravelMode;
  capacity_grams: number;
  max_items: number;
  pnr: string;
  ticket_photo_path: string;
};

export type PaymentStatus = 'created' | 'captured' | 'failed' | 'refund_pending' | 'refunded';

type PaymentRow = {
  id: string;
  request_id: string;
  offer_id: string;
  requester_id: string;
  traveler_id: string;
  item_price_paise: number;
  fare_paise: number;
  amount_paise: number;
  currency: 'INR';
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  razorpay_refund_id: string | null;
  status: PaymentStatus;
  captured_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'closed';

type OfferRow = {
  id: string;
  request_id: string;
  trip_id: string;
  traveler_id: string;
  fare_paise: number;
  message: string;
  travel_date: string;
  mode: TravelMode;
  status: OfferStatus;
  created_at: string;
  updated_at: string;
};

type ItemRequestRow = {
  id: string;
  requester_id: string;
  category_id: string;
  item_name: string;
  details: string;
  weight_grams: number;
  from_city_id: number;
  to_city_id: number;
  deadline: string;
  budget_paise: number;
  /** Shop price stated by the requester; null only on requests from before Phase 5. */
  item_price_paise: number | null;
  photo_path: string | null;
  status: RequestStatus;
  accepted_offer_id: string | null;
  created_at: string;
  updated_at: string;
};

/** A row from request_feed(trip_id). */
export type FeedRequest = Omit<ItemRequestRow, 'accepted_offer_id' | 'updated_at'> & {
  exact_match: boolean;
  fare_min_paise: number;
  fare_max_paise: number;
  my_offer_status: OfferStatus | null;
};

type ItemRequestWrite = {
  category_id: string;
  item_name: string;
  details?: string;
  weight_grams: number;
  from_city_id: number;
  to_city_id: number;
  deadline: string;
  budget_paise: number;
  item_price_paise: number;
  photo_path?: string | null;
};

export type Database = {
  public: {
    Tables: {
      states: {
        Row: { code: string; name: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          /** Derived from home_city_id by the database. */
          home_state: string;
          /** Null only for profiles created before cities existed; the app asks for it. */
          home_city_id: number | null;
          avatar_path: string | null;
          /** Set by an admin approving the traveler's ID; shown as the verified badge. */
          traveler_verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          home_city_id: number;
          avatar_path?: string | null;
        };
        Update: {
          full_name?: string;
          home_city_id?: number;
          avatar_path?: string | null;
        };
        Relationships: [];
      };
      cities: {
        Row: {
          id: number;
          state_code: string;
          name: string;
          aliases: string[];
          is_active: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      allowed_categories: {
        Row: {
          id: string;
          name: string;
          description: string;
          max_weight_grams: number;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      blocked_terms: {
        Row: { id: number; pattern: string; reason_code: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      item_requests: {
        Row: ItemRequestRow;
        Insert: ItemRequestWrite;
        Update: Partial<ItemRequestWrite>;
        Relationships: [];
      };
      app_settings: {
        Row: { key: string; int_value: number; description: string };
        Insert: never;
        Update: { int_value?: number };
        Relationships: [];
      };
      traveler_verifications: {
        Row: VerificationRow;
        Insert: { id_type: IdDocumentType; id_photo_path: string };
        Update: never;
        Relationships: [];
      };
      trips: {
        Row: TripRow;
        Insert: TripWrite;
        Update: Partial<TripWrite>;
        Relationships: [];
      };
      payments: {
        Row: PaymentRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      offers: {
        Row: OfferRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      cancel_request: {
        Args: { request_id: string };
        Returns: ItemRequestRow;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      cancel_trip: {
        Args: { trip_id: string };
        Returns: TripRow;
      };
      review_verification: {
        Args: { verification_id: string; approve: boolean; reason?: string };
        Returns: VerificationRow;
      };
      review_trip_ticket: {
        Args: { trip_id: string; approve: boolean; reason?: string };
        Returns: TripRow;
      };
      trip_can_carry: {
        Args: { trip_id: string };
        Returns: boolean;
      };
      request_feed: {
        Args: { p_trip_id: string };
        Returns: FeedRequest[];
      };
      make_offer: {
        Args: { p_request_id: string; p_trip_id: string; p_fare_paise: number; p_message?: string };
        Returns: OfferRow;
      };
      withdraw_offer: {
        Args: { p_offer_id: string };
        Returns: OfferRow;
      };
      accept_offer: {
        Args: { p_offer_id: string };
        Returns: OfferRow;
      };
      decline_offer: {
        Args: { p_offer_id: string };
        Returns: OfferRow;
      };
    };
    Enums: {
      request_status: RequestStatus;
      review_status: ReviewStatus;
      id_document_type: IdDocumentType;
      travel_mode: TravelMode;
      trip_status: TripStatus;
      offer_status: OfferStatus;
      payment_status: PaymentStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type Tables = Database['public']['Tables'];

export type Profile = Tables['profiles']['Row'];
export type State = Tables['states']['Row'];
export type City = Tables['cities']['Row'];
export type Category = Tables['allowed_categories']['Row'];
export type BlockedTerm = Tables['blocked_terms']['Row'];
export type ItemRequest = Tables['item_requests']['Row'];
export type ItemRequestInsert = Tables['item_requests']['Insert'];
export type Verification = Tables['traveler_verifications']['Row'];
export type Trip = Tables['trips']['Row'];
export type TripInsert = Tables['trips']['Insert'];
export type AppSetting = Tables['app_settings']['Row'];
export type Offer = Tables['offers']['Row'];
export type Payment = Tables['payments']['Row'];
