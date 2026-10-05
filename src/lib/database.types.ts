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
  /** Hopbag fee, paid by the requester on top of item price and fare. */
  fee_paise: number;
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

export type DisputeStatus = 'open' | 'resolved';
export type PayoutStatus = 'ready' | 'transferred';

type DeliveryRow = {
  request_id: string;
  traveler_id: string;
  pickup_photo_path: string;
  pickup_weight_grams: number;
  picked_up_at: string;
  delivered_at: string | null;
  delivery_method: 'code' | 'handover' | null;
  confirm_by: string | null;
  settled_at: string | null;
  settled_by: 'code' | 'requester' | 'auto' | 'admin' | null;
};

export type DisputeCategory = 'damaged' | 'not_as_described' | 'not_responding' | 'other';

type DisputeRow = {
  id: string;
  request_id: string;
  raised_by: string;
  reason: string;
  category: DisputeCategory;
  photo_paths: string[];
  status: DisputeStatus;
  resolution: 'released' | 'refunded' | null;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};

type PayoutRow = {
  id: string;
  payment_id: string;
  request_id: string;
  traveler_id: string;
  gross_paise: number;
  fee_paise: number;
  net_paise: number;
  status: PayoutStatus;
  created_at: string;
};

export type NotificationKind =
  | 'offer_received'
  | 'offer_accepted'
  | 'offer_not_chosen'
  | 'request_paid'
  | 'picked_up'
  | 'handed_over'
  | 'completed'
  | 'payout_unlocked'
  | 'disputed'
  | 'dispute_resolved'
  | 'refunded'
  | 'expired'
  | 'message'
  | 'rated'
  | 'id_approved'
  | 'id_rejected'
  | 'ticket_approved'
  | 'ticket_rejected'
  | 'route_request'
  | 'pickup_declined';

export type NotificationParams = {
  item?: string;
  name?: string;
  amount?: number;
  preview?: string;
  reason?: string;
  resolution?: 'released' | 'refunded';
  stars?: number;
  deadline?: string;
};

type MessageRow = {
  id: number;
  request_id: string;
  sender_id: string;
  body: string;
  photo_path: string | null;
  /** Set when the photo file was removed (7 days after the request finished). */
  photo_deleted_at: string | null;
  created_at: string;
};

type NotificationRow = {
  id: number;
  user_id: string;
  kind: NotificationKind;
  request_id: string | null;
  trip_id: string | null;
  params: NotificationParams;
  created_at: string;
  read_at: string | null;
  push_claimed_at: string | null;
};

type RatingRow = {
  id: string;
  request_id: string;
  rater_id: string;
  ratee_id: string;
  stars: number;
  comment: string;
  tags: RatingTag[];
  created_at: string;
};

export type RatingTag = 'on_time' | 'great_shape' | 'easy_to_talk' | 'clear_details' | 'friendly';
export type Intent = 'get' | 'carry' | 'both';

/** A row from upcoming_trips(): safe fields only (no PNR or ticket). */
export type UpcomingTrip = {
  trip_id: string;
  traveler_id: string;
  traveler_name: string;
  from_city_id: number;
  to_city_id: number;
  travel_date: string;
  mode: TravelMode;
  free_grams: number;
  free_items: number;
};

export type ProfileStats = {
  user_id: string;
  display_name: string;
  full_name: string;
  home_city_id: number | null;
  joined_at: string;
  verified: boolean;
  rating: number | null;
  ratings: number;
  deliveries: number;
  requests: number;
  disputes: number;
};

export type ReportCategory = 'fraud' | 'abuse' | 'no_show' | 'prohibited_item' | 'other';

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
          intent: Intent;
          push_enabled: boolean;
          offer_alerts: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          home_city_id: number;
          avatar_path?: string | null;
          intent?: Intent;
        };
        Update: {
          full_name?: string;
          home_city_id?: number;
          avatar_path?: string | null;
          intent?: Intent;
          push_enabled?: boolean;
          offer_alerts?: boolean;
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
      app_errors: {
        Row: {
          id: number;
          user_id: string | null;
          kind: 'crash' | 'error' | 'promise';
          message: string;
          stack: string | null;
          screen: string | null;
          fingerprint: string;
          app_version: string | null;
          platform: string | null;
          os_version: string | null;
          device_model: string | null;
          created_at: string;
        };
        Insert: {
          kind: 'crash' | 'error' | 'promise';
          message: string;
          stack?: string | null;
          screen?: string | null;
          fingerprint: string;
          app_version?: string | null;
          platform?: string | null;
          os_version?: string | null;
          device_model?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      app_events: {
        Row: {
          id: number;
          user_id: string | null;
          name: string;
          properties: Record<string, string | number | boolean>;
          app_version: string | null;
          platform: string | null;
          created_at: string;
        };
        Insert: {
          name: string;
          properties?: Record<string, string | number | boolean>;
          app_version?: string | null;
          platform?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      account_suspensions: {
        Row: {
          user_id: string;
          reason: string | null;
          suspended_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      user_blocks: {
        Row: { blocker_id: string; blocked_id: string; created_at: string };
        Insert: { blocked_id: string };
        Update: never;
        Relationships: [];
      };
      user_reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_user_id: string;
          request_id: string | null;
          category: ReportCategory;
          details: string;
          status: 'open' | 'reviewed';
          admin_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          reported_user_id: string;
          request_id?: string | null;
          category: ReportCategory;
          details?: string;
        };
        Update: never;
        Relationships: [];
      };
      messages: {
        Row: MessageRow;
        Insert: { request_id: string; body: string; photo_path?: string | null };
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: never;
        Update: { read_at?: string | null };
        Relationships: [];
      };
      ratings: {
        Row: RatingRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      push_tokens: {
        Row: { token: string; user_id: string; platform: 'ios' | 'android'; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      deliveries: {
        Row: DeliveryRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      disputes: {
        Row: DisputeRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      payouts: {
        Row: PayoutRow;
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
      pickup_declines: {
        Row: { request_id: string; traveler_id: string; reason: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      support_messages: {
        Row: {
          id: string;
          user_id: string;
          body: string;
          status: 'open' | 'answered';
          created_at: string;
        };
        Insert: { body: string };
        Update: never;
        Relationships: [];
      };
      account_deletion_requests: {
        Row: {
          user_id: string;
          status: 'pending' | 'done' | 'refused';
          admin_note: string | null;
          created_at: string;
        };
        Insert: { user_id?: string };
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
      mark_picked_up: {
        Args: { p_request_id: string; p_photo_path: string; p_weight_grams: number };
        Returns: DeliveryRow;
      };
      confirm_delivery_code: {
        Args: { p_request_id: string; p_code: string };
        Returns: 'settled' | 'wrong_code' | 'locked';
      };
      mark_handed_over: {
        Args: { p_request_id: string };
        Returns: DeliveryRow;
      };
      issue_handover_code: {
        Args: { p_request_id: string };
        Returns: string;
      };
      confirm_received: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
      raise_dispute: {
        Args: {
          p_request_id: string;
          p_reason: string;
          p_category?: DisputeCategory;
          p_photo_paths?: string[];
        };
        Returns: DisputeRow;
      };
      resolve_dispute_release: {
        Args: { p_request_id: string; p_note?: string };
        Returns: DisputeRow;
      };
      register_push_token: {
        Args: { p_token: string; p_platform: 'ios' | 'android' };
        Returns: undefined;
      };
      rate_counterpart: {
        Args: { p_request_id: string; p_stars: number; p_comment?: string; p_tags?: RatingTag[] };
        Returns: RatingRow;
      };
      rating_summary: {
        Args: { p_user_ids: string[] };
        Returns: { user_id: string; average: number; count: number }[];
      };
      review_report: {
        Args: { p_report_id: string; p_note: string; p_suspend?: boolean };
        Returns: unknown;
      };
      set_suspension: {
        Args: { p_user_id: string; p_suspended: boolean; p_reason?: string };
        Returns: undefined;
      };
      admin_dashboard: {
        Args: Record<string, never>;
        Returns: Record<string, number>;
      };
      admin_funnel: {
        Args: { p_days?: number };
        Returns: { step: string; count: number }[];
      };
      admin_error_groups: {
        Args: { p_hours?: number };
        Returns: {
          fingerprint: string;
          message: string;
          screen: string | null;
          occurrences: number;
          users: number;
          last_seen: string;
        }[];
      };
      upcoming_trips: {
        Args: { p_to_state?: string };
        Returns: UpcomingTrip[];
      };
      profile_stats: {
        Args: { p_user_id: string };
        Returns: ProfileStats[];
      };
      display_name: {
        Args: { p_user_id: string };
        Returns: string;
      };
      counterpart_phone: {
        Args: { p_request_id: string };
        Returns: string | null;
      };
      platform_fee: {
        Args: { p_fare_paise: number };
        Returns: number;
      };
      request_traveler: {
        Args: { p_request_id: string };
        Returns: string | null;
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
      dispute_status: DisputeStatus;
      payout_status: PayoutStatus;
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
export type Delivery = Tables['deliveries']['Row'];
export type Dispute = Tables['disputes']['Row'];
export type Payout = Tables['payouts']['Row'];
export type Message = Tables['messages']['Row'];
export type AppNotification = Tables['notifications']['Row'];
export type Rating = Tables['ratings']['Row'];
export type UserReport = Tables['user_reports']['Row'];
