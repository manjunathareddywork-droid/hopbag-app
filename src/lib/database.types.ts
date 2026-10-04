/**
 * Database types for supabase-js. Hand-written to match supabase/migrations until a
 * project is linked; then replace with the generated file:
 *   supabase gen types typescript --linked > src/lib/database.types.ts
 */
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
          home_state: string;
          home_city: string;
          avatar_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          home_state: string;
          home_city: string;
          avatar_path?: string | null;
        };
        Update: {
          full_name?: string;
          home_state?: string;
          home_city?: string;
          avatar_path?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type State = Database['public']['Tables']['states']['Row'];
