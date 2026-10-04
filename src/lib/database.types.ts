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
  photo_path: string | null;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
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
    };
    Enums: {
      request_status: RequestStatus;
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
