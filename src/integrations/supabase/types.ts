export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      businesses: {
        Row: {
          created_at: string
          currency: string
          id: string
          name: string
          opening_hours: Json
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          name: string
          opening_hours?: Json
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          name?: string
          opening_hours?: Json
        }
        Relationships: []
      }
      daily_tasks: {
        Row: {
          assigned_to: string | null
          business_id: string
          completed: boolean
          id: string
          location_id: string
          section: string
          task_date: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          business_id: string
          completed?: boolean
          id?: string
          location_id: string
          section?: string
          task_date?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          business_id?: string
          completed?: boolean
          id?: string
          location_id?: string
          section?: string
          task_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_tasks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          avg_daily_usage: number
          business_id: string
          created_at: string
          current_stock: number
          id: string
          last_purchase: string | null
          location_id: string | null
          min_stock: number
          name: string
          supplier_id: string | null
          unit: string
          unit_cost: number
        }
        Insert: {
          avg_daily_usage?: number
          business_id: string
          created_at?: string
          current_stock?: number
          id?: string
          last_purchase?: string | null
          location_id?: string | null
          min_stock?: number
          name: string
          supplier_id?: string | null
          unit?: string
          unit_cost?: number
        }
        Update: {
          avg_daily_usage?: number
          business_id?: string
          created_at?: string
          current_stock?: number
          id?: string
          last_purchase?: string | null
          location_id?: string | null
          min_stock?: number
          name?: string
          supplier_id?: string | null
          unit?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_records: {
        Row: {
          counted_at: string
          counted_stock: number
          id: string
          ingredient_id: string
          note: string | null
          order_status: string | null
        }
        Insert: {
          counted_at?: string
          counted_stock?: number
          id?: string
          ingredient_id: string
          note?: string | null
          order_status?: string | null
        }
        Update: {
          counted_at?: string
          counted_stock?: number
          id?: string
          ingredient_id?: string
          note?: string | null
          order_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_records_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          business_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          business_id: string
          created_at: string
          id: string
          profile_id: string | null
          read: boolean
          title: string
        }
        Insert: {
          body?: string | null
          business_id: string
          created_at?: string
          id?: string
          profile_id?: string | null
          read?: boolean
          title: string
        }
        Update: {
          body?: string | null
          business_id?: string
          created_at?: string
          id?: string
          profile_id?: string | null
          read?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      production_items: {
        Row: {
          actual_qty: number
          expected_demand: number
          id: string
          note: string | null
          plan_id: string
          planned_qty: number
          product_id: string
          reason: string | null
          recommended_qty: number
          remaining_qty: number
          safety_buffer: number
          sold_qty: number
          source: string
          status: string
          updated_at: string
          wasted_qty: number
        }
        Insert: {
          actual_qty?: number
          expected_demand?: number
          id?: string
          note?: string | null
          plan_id: string
          planned_qty?: number
          product_id: string
          reason?: string | null
          recommended_qty?: number
          remaining_qty?: number
          safety_buffer?: number
          sold_qty?: number
          source?: string
          status?: string
          updated_at?: string
          wasted_qty?: number
        }
        Update: {
          actual_qty?: number
          expected_demand?: number
          id?: string
          note?: string | null
          plan_id?: string
          planned_qty?: number
          product_id?: string
          reason?: string | null
          recommended_qty?: number
          remaining_qty?: number
          safety_buffer?: number
          sold_qty?: number
          source?: string
          status?: string
          updated_at?: string
          wasted_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "production_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          business_id: string
          created_at: string
          id: string
          location_id: string
          plan_date: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          business_id: string
          created_at?: string
          id?: string
          location_id: string
          plan_date: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          business_id?: string
          created_at?: string
          id?: string
          location_id?: string
          plan_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_plans_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_plans_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          base_daily_demand: number
          business_id: string
          category: string
          created_at: string
          id: string
          name: string
          price: number
          unit_cost: number
        }
        Insert: {
          active?: boolean
          base_daily_demand?: number
          business_id: string
          category?: string
          created_at?: string
          id?: string
          name: string
          price?: number
          unit_cost?: number
        }
        Update: {
          active?: boolean
          base_daily_demand?: number
          business_id?: string
          category?: string
          created_at?: string
          id?: string
          name?: string
          price?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          business_id: string | null
          created_at: string
          email: string | null
          full_name: string
          hourly_cost: number
          id: string
          location_id: string | null
          staff_role: Database["public"]["Enums"]["staff_role"]
          user_id: string | null
        }
        Insert: {
          active?: boolean
          business_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          hourly_cost?: number
          id?: string
          location_id?: string | null
          staff_role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string | null
        }
        Update: {
          active?: boolean
          business_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          hourly_cost?: number
          id?: string
          location_id?: string | null
          staff_role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          business_id: string
          category: string
          created_at: string
          detail: string | null
          id: string
          location_id: string
          reason: string | null
          rec_date: string
          status: string
          title: string
        }
        Insert: {
          business_id: string
          category?: string
          created_at?: string
          detail?: string | null
          id?: string
          location_id: string
          reason?: string | null
          rec_date?: string
          status?: string
          title: string
        }
        Update: {
          business_id?: string
          category?: string
          created_at?: string
          detail?: string | null
          id?: string
          location_id?: string
          reason?: string | null
          rec_date?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_records: {
        Row: {
          business_id: string
          id: string
          location_id: string
          product_id: string
          quantity: number
          revenue: number
          sold_on: string
        }
        Insert: {
          business_id: string
          id?: string
          location_id: string
          product_id: string
          quantity?: number
          revenue?: number
          sold_on: string
        }
        Update: {
          business_id?: string
          id?: string
          location_id?: string
          product_id?: string
          quantity?: number
          revenue?: number
          sold_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_records_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swap_requests: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          requested_by: string | null
          shift_id: string
          status: string
          target_profile_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          requested_by?: string | null
          shift_id: string
          status?: string
          target_profile_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          requested_by?: string | null
          shift_id?: string
          status?: string
          target_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_swap_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          business_id: string
          confirmed: boolean
          created_at: string
          ends_at: string
          id: string
          is_open: boolean
          location_id: string
          note: string | null
          profile_id: string | null
          role: Database["public"]["Enums"]["staff_role"]
          starts_at: string
        }
        Insert: {
          business_id: string
          confirmed?: boolean
          created_at?: string
          ends_at: string
          id?: string
          is_open?: boolean
          location_id: string
          note?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          starts_at: string
        }
        Update: {
          business_id?: string
          confirmed?: boolean
          created_at?: string
          ends_at?: string
          id?: string
          is_open?: boolean
          location_id?: string
          note?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_availability: {
        Row: {
          available: boolean
          day_of_week: number
          id: string
          note: string | null
          profile_id: string
        }
        Insert: {
          available?: boolean
          day_of_week: number
          id?: string
          note?: string | null
          profile_id: string
        }
        Update: {
          available?: boolean
          day_of_week?: number
          id?: string
          note?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_availability_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stockout_reports: {
        Row: {
          business_id: string
          id: string
          ingredient_id: string | null
          location_id: string
          note: string | null
          product_id: string | null
          reported_at: string
          reported_by: string | null
          resolved: boolean
        }
        Insert: {
          business_id: string
          id?: string
          ingredient_id?: string | null
          location_id: string
          note?: string | null
          product_id?: string | null
          reported_at?: string
          reported_by?: string | null
          resolved?: boolean
        }
        Update: {
          business_id?: string
          id?: string
          ingredient_id?: string | null
          location_id?: string
          note?: string | null
          product_id?: string | null
          reported_at?: string
          reported_by?: string | null
          resolved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "stockout_reports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stockout_reports_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stockout_reports_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stockout_reports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stockout_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          business_id: string
          contact_email: string | null
          created_at: string
          id: string
          lead_time_days: number
          name: string
        }
        Insert: {
          business_id: string
          contact_email?: string | null
          created_at?: string
          id?: string
          lead_time_days?: number
          name: string
        }
        Update: {
          business_id?: string
          contact_email?: string | null
          created_at?: string
          id?: string
          lead_time_days?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waste_records: {
        Row: {
          business_id: string
          cost: number
          id: string
          location_id: string
          note: string | null
          occurred_at: string
          product_id: string | null
          quantity: number
          reason: string
          recorded_by: string | null
        }
        Insert: {
          business_id: string
          cost?: number
          id?: string
          location_id: string
          note?: string | null
          occurred_at?: string
          product_id?: string | null
          quantity?: number
          reason?: string
          recorded_by?: string | null
        }
        Update: {
          business_id?: string
          cost?: number
          id?: string
          location_id?: string
          note?: string | null
          occurred_at?: string
          product_id?: string | null
          quantity?: number
          reason?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waste_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_records_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "staff"
      staff_role: "barista" | "kitchen" | "shift_leader" | "manager"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "manager", "staff"],
      staff_role: ["barista", "kitchen", "shift_leader", "manager"],
    },
  },
} as const
