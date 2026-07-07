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
      batch_ingredients: {
        Row: {
          amount_ml: number
          batch_id: string
          checked: boolean
          created_at: string
          id: string
          inventory_id: string | null
        }
        Insert: {
          amount_ml?: number
          batch_id: string
          checked?: boolean
          created_at?: string
          id?: string
          inventory_id?: string | null
        }
        Update: {
          amount_ml?: number
          batch_id?: string
          checked?: boolean
          created_at?: string
          id?: string
          inventory_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_ingredients_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_ingredients_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_recipes: {
        Row: {
          cost_per_serving: number
          created_at: string
          created_by: string | null
          id: string
          instructions: string | null
          name: string
          total_cost: number
          total_servings: number
        }
        Insert: {
          cost_per_serving?: number
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          name: string
          total_cost?: number
          total_servings?: number
        }
        Update: {
          cost_per_serving?: number
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          name?: string
          total_cost?: number
          total_servings?: number
        }
        Relationships: []
      }
      cocktail_ingredients: {
        Row: {
          amount_ml: number
          cocktail_id: string
          cost_per_ingredient: number
          created_at: string
          id: string
          inventory_id: string | null
          is_prep: boolean
        }
        Insert: {
          amount_ml?: number
          cocktail_id: string
          cost_per_ingredient?: number
          created_at?: string
          id?: string
          inventory_id?: string | null
          is_prep?: boolean
        }
        Update: {
          amount_ml?: number
          cocktail_id?: string
          cost_per_ingredient?: number
          created_at?: string
          id?: string
          inventory_id?: string | null
          is_prep?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cocktail_ingredients_cocktail_id_fkey"
            columns: ["cocktail_id"]
            isOneToOne: false
            referencedRelation: "cocktails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cocktail_ingredients_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      cocktails: {
        Row: {
          abv_percent: number
          category: string | null
          created_at: string
          est_cost: number
          id: string
          margin_percent: number
          name: string
          price: number
          specs: string | null
          total_volume_ml: number
        }
        Insert: {
          abv_percent?: number
          category?: string | null
          created_at?: string
          est_cost?: number
          id?: string
          margin_percent?: number
          name: string
          price?: number
          specs?: string | null
          total_volume_ml?: number
        }
        Update: {
          abv_percent?: number
          category?: string | null
          created_at?: string
          est_cost?: number
          id?: string
          margin_percent?: number
          name?: string
          price?: number
          specs?: string | null
          total_volume_ml?: number
        }
        Relationships: []
      }
      daily_sales: {
        Row: {
          cocktail_id: string | null
          cost: number
          created_at: string
          date: string
          id: string
          profit: number
          quantity_sold: number
          revenue: number
        }
        Insert: {
          cocktail_id?: string | null
          cost?: number
          created_at?: string
          date?: string
          id?: string
          profit?: number
          quantity_sold?: number
          revenue?: number
        }
        Update: {
          cocktail_id?: string | null
          cost?: number
          created_at?: string
          date?: string
          id?: string
          profit?: number
          quantity_sold?: number
          revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_cocktail_id_fkey"
            columns: ["cocktail_id"]
            isOneToOne: false
            referencedRelation: "cocktails"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          abv: number
          bottle_size_ml: number
          category: string
          cost_per_ml: number
          created_at: string
          current_stock: number
          id: string
          name: string
          par_level: number
          pours_per_bottle: number
          status: string
          unit_cost: number
        }
        Insert: {
          abv?: number
          bottle_size_ml?: number
          category: string
          cost_per_ml?: number
          created_at?: string
          current_stock?: number
          id?: string
          name: string
          par_level?: number
          pours_per_bottle?: number
          status?: string
          unit_cost?: number
        }
        Update: {
          abv?: number
          bottle_size_ml?: number
          category?: string
          cost_per_ml?: number
          created_at?: string
          current_stock?: number
          id?: string
          name?: string
          par_level?: number
          pours_per_bottle?: number
          status?: string
          unit_cost?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          created_at: string
          created_by: string | null
          date: string | null
          id: string
          items: string | null
          receipt_url: string | null
          total: number
          vendor: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string | null
          id?: string
          items?: string | null
          receipt_url?: string | null
          total?: number
          vendor: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string | null
          id?: string
          items?: string | null
          receipt_url?: string | null
          total?: number
          vendor?: string
        }
        Relationships: []
      }
      payroll_records: {
        Row: {
          base_pay: number
          created_at: string
          days_worked: number
          gross_pay: number
          hours_worked: number
          id: string
          irs: number
          meal_subsidy: number
          month: number
          net_pay: number
          social_security: number
          staff_id: string | null
          tips: number
          year: number
        }
        Insert: {
          base_pay?: number
          created_at?: string
          days_worked?: number
          gross_pay?: number
          hours_worked?: number
          id?: string
          irs?: number
          meal_subsidy?: number
          month: number
          net_pay?: number
          social_security?: number
          staff_id?: string | null
          tips?: number
          year: number
        }
        Update: {
          base_pay?: number
          created_at?: string
          days_worked?: number
          gross_pay?: number
          hours_worked?: number
          id?: string
          irs?: number
          meal_subsidy?: number
          month?: number
          net_pay?: number
          social_security?: number
          staff_id?: string | null
          tips?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      sales_uploads: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          parsed_data: Json | null
          status: string
          upload_date: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          parsed_data?: Json | null
          status?: string
          upload_date?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          parsed_data?: Json | null
          status?: string
          upload_date?: string | null
        }
        Relationships: []
      }
      service_cost_payments: {
        Row: {
          amount_paid: number
          created_at: string
          id: string
          month: number
          payment_date: string | null
          receipt_url: string | null
          service_cost_id: string | null
          status: string
          year: number
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          id?: string
          month: number
          payment_date?: string | null
          receipt_url?: string | null
          service_cost_id?: string | null
          status?: string
          year: number
        }
        Update: {
          amount_paid?: number
          created_at?: string
          id?: string
          month?: number
          payment_date?: string | null
          receipt_url?: string | null
          service_cost_id?: string | null
          status?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_cost_payments_service_cost_id_fkey"
            columns: ["service_cost_id"]
            isOneToOne: false
            referencedRelation: "service_costs"
            referencedColumns: ["id"]
          },
        ]
      }
      service_costs: {
        Row: {
          active: boolean
          amount: number
          auto_renew: boolean
          category: string
          created_at: string
          due_day: number
          frequency: string
          id: string
          name: string
          vendor: string | null
        }
        Insert: {
          active?: boolean
          amount?: number
          auto_renew?: boolean
          category?: string
          created_at?: string
          due_day?: number
          frequency?: string
          id?: string
          name: string
          vendor?: string | null
        }
        Update: {
          active?: boolean
          amount?: number
          auto_renew?: boolean
          category?: string
          created_at?: string
          due_day?: number
          frequency?: string
          id?: string
          name?: string
          vendor?: string | null
        }
        Relationships: []
      }
      staff: {
        Row: {
          active: boolean
          base_salary: number
          created_at: string
          hourly_rate: number
          id: string
          name: string
          nif: string | null
          role: string
        }
        Insert: {
          active?: boolean
          base_salary?: number
          created_at?: string
          hourly_rate?: number
          id?: string
          name: string
          nif?: string | null
          role?: string
        }
        Update: {
          active?: boolean
          base_salary?: number
          created_at?: string
          hourly_rate?: number
          id?: string
          name?: string
          nif?: string | null
          role?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      is_owner: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "staff"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["owner", "staff"],
    },
  },
} as const
