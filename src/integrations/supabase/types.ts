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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      business_events: {
        Row: {
          actor_id: string | null
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: Database["public"]["Enums"]["business_event_type"]
          id: string
          payload: Json
        }
        Insert: {
          actor_id?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: Database["public"]["Enums"]["business_event_type"]
          id?: string
          payload?: Json
        }
        Update: {
          actor_id?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: Database["public"]["Enums"]["business_event_type"]
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "business_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cocktail_specs: {
        Row: {
          amount: number
          amount_unit: string
          cocktail_id: string
          cost: number
          created_at: string
          id: string
          ingredient_name: string
          prep_recipe_id: string | null
          product_id: string | null
          sort_order: number
        }
        Insert: {
          amount?: number
          amount_unit?: string
          cocktail_id: string
          cost?: number
          created_at?: string
          id?: string
          ingredient_name: string
          prep_recipe_id?: string | null
          product_id?: string | null
          sort_order?: number
        }
        Update: {
          amount?: number
          amount_unit?: string
          cocktail_id?: string
          cost?: number
          created_at?: string
          id?: string
          ingredient_name?: string
          prep_recipe_id?: string | null
          product_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "cocktail_specs_cocktail_id_fkey"
            columns: ["cocktail_id"]
            isOneToOne: false
            referencedRelation: "cocktails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cocktail_specs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cocktails: {
        Row: {
          abv_percent: number
          category: string | null
          company_id: string | null
          created_at: string
          est_cost: number
          id: string
          kind: string
          margin_percent: number
          name: string
          price: number | null
          specs: string | null
          total_volume_ml: number
          updated_at: string
        }
        Insert: {
          abv_percent?: number
          category?: string | null
          company_id?: string | null
          created_at?: string
          est_cost?: number
          id?: string
          kind?: string
          margin_percent?: number
          name: string
          price?: number | null
          specs?: string | null
          total_volume_ml?: number
          updated_at?: string
        }
        Update: {
          abv_percent?: number
          category?: string | null
          company_id?: string | null
          created_at?: string
          est_cost?: number
          id?: string
          kind?: string
          margin_percent?: number
          name?: string
          price?: number | null
          specs?: string | null
          total_volume_ml?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cocktails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean
          address: string | null
          brand_color: string
          commercial_name: string
          created_at: string
          id: string
          legal_name: string
          logo_url: string | null
          monthly_revenue_target: number
          nif: string
          parent_company_id: string | null
          type: Database["public"]["Enums"]["company_type"]
        }
        Insert: {
          active?: boolean
          address?: string | null
          brand_color?: string
          commercial_name: string
          created_at?: string
          id?: string
          legal_name: string
          logo_url?: string | null
          monthly_revenue_target?: number
          nif: string
          parent_company_id?: string | null
          type: Database["public"]["Enums"]["company_type"]
        }
        Update: {
          active?: boolean
          address?: string | null
          brand_color?: string
          commercial_name?: string
          created_at?: string
          id?: string
          legal_name?: string
          logo_url?: string | null
          monthly_revenue_target?: number
          nif?: string
          parent_company_id?: string | null
          type?: Database["public"]["Enums"]["company_type"]
        }
        Relationships: [
          {
            foreignKeyName: "companies_parent_company_id_fkey"
            columns: ["parent_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_inventory: {
        Row: {
          company_id: string
          created_at: string
          current_stock: number
          expiry_date: string | null
          id: string
          kind: string
          name: string
          par_level: number
          prep_recipe_id: string | null
          product_id: string | null
          status: string
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_stock?: number
          expiry_date?: string | null
          id?: string
          kind: string
          name: string
          par_level?: number
          prep_recipe_id?: string | null
          product_id?: string | null
          status?: string
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_stock?: number
          expiry_date?: string | null
          id?: string
          kind?: string
          name?: string
          par_level?: number
          prep_recipe_id?: string | null
          product_id?: string | null
          status?: string
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_inventory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_inventory_prep_recipe_id_fkey"
            columns: ["prep_recipe_id"]
            isOneToOne: false
            referencedRelation: "prep_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      company_relationships: {
        Row: {
          created_at: string
          from_company_id: string
          id: string
          markup_percent: number
          to_company_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_company_id: string
          id?: string
          markup_percent?: number
          to_company_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_company_id?: string
          id?: string
          markup_percent?: number
          to_company_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_relationships_from_company_id_fkey"
            columns: ["from_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_relationships_to_company_id_fkey"
            columns: ["to_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_allocations: {
        Row: {
          applied: boolean
          created_at: string
          created_by: string | null
          from_company_id: string
          id: string
          label: string
          period_month: number | null
          period_year: number | null
          service_cost_id: string | null
          splits: Json
          total_amount: number
        }
        Insert: {
          applied?: boolean
          created_at?: string
          created_by?: string | null
          from_company_id: string
          id?: string
          label: string
          period_month?: number | null
          period_year?: number | null
          service_cost_id?: string | null
          splits?: Json
          total_amount?: number
        }
        Update: {
          applied?: boolean
          created_at?: string
          created_by?: string | null
          from_company_id?: string
          id?: string
          label?: string
          period_month?: number | null
          period_year?: number | null
          service_cost_id?: string | null
          splits?: Json
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "cost_allocations_from_company_id_fkey"
            columns: ["from_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_allocations_service_cost_id_fkey"
            columns: ["service_cost_id"]
            isOneToOne: false
            referencedRelation: "service_costs"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_targets: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          metric: string
          target_percent: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          metric: string
          target_percent: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          metric?: string
          target_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "cost_targets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales: {
        Row: {
          cocktail_id: string | null
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
          {
            foreignKeyName: "daily_sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inter_company_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          from_company_id: string
          id: string
          note: string | null
          payment_date: string
          to_company_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          from_company_id: string
          id?: string
          note?: string | null
          payment_date?: string
          to_company_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          from_company_id?: string
          id?: string
          note?: string | null
          payment_date?: string
          to_company_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inter_company_payments_from_company_id_fkey"
            columns: ["from_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_company_payments_to_company_id_fkey"
            columns: ["to_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inter_company_transfers: {
        Row: {
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_date: string | null
          from_company_id: string
          id: string
          item_name: string
          kind: string
          markup_percent: number
          prep_recipe_id: string | null
          product_id: string | null
          production_cost: number
          status: string
          transfer_price: number
          updated_at: string
          yield_amount: number
          yield_unit: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_date?: string | null
          from_company_id: string
          id?: string
          item_name: string
          kind?: string
          markup_percent?: number
          prep_recipe_id?: string | null
          product_id?: string | null
          production_cost?: number
          status?: string
          transfer_price?: number
          updated_at?: string
          yield_amount?: number
          yield_unit?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_date?: string | null
          from_company_id?: string
          id?: string
          item_name?: string
          kind?: string
          markup_percent?: number
          prep_recipe_id?: string | null
          product_id?: string | null
          production_cost?: number
          status?: string
          transfer_price?: number
          updated_at?: string
          yield_amount?: number
          yield_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "inter_company_transfers_from_company_id_fkey"
            columns: ["from_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_company_transfers_prep_recipe_id_fkey"
            columns: ["prep_recipe_id"]
            isOneToOne: false
            referencedRelation: "prep_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_company_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_allocations: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          id: string
          invoice_id: string
          percentage: number
        }
        Insert: {
          amount?: number
          company_id: string
          created_at?: string
          id?: string
          invoice_id: string
          percentage?: number
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          delivery_address: string | null
          id: string
          invoice_date: string | null
          is_inter_company: boolean
          is_split: boolean
          items: Json
          receipt_url: string | null
          routing_confidence: number
          routing_reason: string | null
          status: string
          supplier: string | null
          total: number
          updated_at: string
          vendor: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string | null
          id?: string
          invoice_date?: string | null
          is_inter_company?: boolean
          is_split?: boolean
          items?: Json
          receipt_url?: string | null
          routing_confidence?: number
          routing_reason?: string | null
          status?: string
          supplier?: string | null
          total?: number
          updated_at?: string
          vendor: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string | null
          id?: string
          invoice_date?: string | null
          is_inter_company?: boolean
          is_split?: boolean
          items?: Json
          receipt_url?: string | null
          routing_confidence?: number
          routing_reason?: string | null
          status?: string
          supplier?: string | null
          total?: number
          updated_at?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          company_id: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          severity: string
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          severity?: string
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          severity?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_records: {
        Row: {
          base_pay: number
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "payroll_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      prep_ingredients: {
        Row: {
          amount: number
          amount_unit: string
          cost: number
          created_at: string
          id: string
          ingredient_name: string
          prep_recipe_id: string
          product_id: string | null
        }
        Insert: {
          amount?: number
          amount_unit?: string
          cost?: number
          created_at?: string
          id?: string
          ingredient_name: string
          prep_recipe_id: string
          product_id?: string | null
        }
        Update: {
          amount?: number
          amount_unit?: string
          cost?: number
          created_at?: string
          id?: string
          ingredient_name?: string
          prep_recipe_id?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prep_ingredients_prep_recipe_id_fkey"
            columns: ["prep_recipe_id"]
            isOneToOne: false
            referencedRelation: "prep_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      prep_recipes: {
        Row: {
          category: string
          company_id: string | null
          cost_per_ml: number
          created_at: string
          id: string
          instructions: string | null
          name: string
          shelf_life_days: number | null
          total_cost: number
          updated_at: string
          yield_amount: number
          yield_unit: string
        }
        Insert: {
          category?: string
          company_id?: string | null
          cost_per_ml?: number
          created_at?: string
          id?: string
          instructions?: string | null
          name: string
          shelf_life_days?: number | null
          total_cost?: number
          updated_at?: string
          yield_amount?: number
          yield_unit?: string
        }
        Update: {
          category?: string
          company_id?: string | null
          cost_per_ml?: number
          created_at?: string
          id?: string
          instructions?: string | null
          name?: string
          shelf_life_days?: number | null
          total_cost?: number
          updated_at?: string
          yield_amount?: number
          yield_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "prep_recipes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          company_id: string | null
          id: string
          product_id: string | null
          recorded_at: string
          supplier: string | null
          unit_cost: number
        }
        Insert: {
          company_id?: string | null
          id?: string
          product_id?: string | null
          recorded_at?: string
          supplier?: string | null
          unit_cost: number
        }
        Update: {
          company_id?: string | null
          id?: string
          product_id?: string | null
          recorded_at?: string
          supplier?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          created_at: string
          default_cost: number
          id: string
          name: string
          subcategory: string | null
          unit_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          default_cost?: number
          id?: string
          name: string
          subcategory?: string | null
          unit_type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          default_cost?: number
          id?: string
          name?: string
          subcategory?: string | null
          unit_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_login: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_login?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_login?: string | null
          updated_at?: string
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
          created_at?: string
          due_day?: number
          frequency?: string
          id?: string
          name?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          base_salary: number
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
          created_at?: string
          hourly_rate?: number
          id?: string
          name?: string
          nif?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          quantity: number
          to_company_id: string
          transfer_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          quantity?: number
          to_company_id: string
          transfer_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          quantity?: number
          to_company_id?: string
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_allocations_to_company_id_fkey"
            columns: ["to_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_allocations_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "inter_company_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company_assignments: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      variance_reports: {
        Row: {
          actual: number
          company_id: string | null
          created_at: string
          expected: number
          id: string
          metric: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          variance: number
        }
        Insert: {
          actual?: number
          company_id?: string | null
          created_at?: string
          expected?: number
          id?: string
          metric: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          variance?: number
        }
        Update: {
          actual?: number
          company_id?: string | null
          created_at?: string
          expected?: number
          id?: string
          metric?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          variance?: number
        }
        Relationships: [
          {
            foreignKeyName: "variance_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      is_owner: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "bar_manager" | "lab_manager" | "staff"
      business_event_type:
        | "PRICE_CHANGE"
        | "STOCK_ADJUSTED"
        | "INVOICE_UPLOADED"
        | "COCKTAIL_SOLD"
        | "WASTE_RECORDED"
        | "SUPPLIER_CHANGED"
        | "NEW_PRODUCT_CREATED"
        | "MARGIN_DROP"
        | "TARGET_BREACH"
        | "STOCK_OUT"
        | "EXPIRY_WARNING"
        | "PAYMENT_RECORDED"
        | "PREP_BATCH_STARTED"
        | "PREP_BATCH_COMPLETED"
        | "PREP_BATCH_DISCARDED"
        | "VARIANCE_DETECTED"
        | "AI_INSIGHT_GENERATED"
        | "MEMORY_CREATED"
        | "INTER_COMPANY_SALE"
        | "INTER_COMPANY_DELIVERY"
        | "COST_ALLOCATED"
      company_type: "holding" | "lab" | "bar" | "shared_service"
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
      app_role: ["owner", "bar_manager", "lab_manager", "staff"],
      business_event_type: [
        "PRICE_CHANGE",
        "STOCK_ADJUSTED",
        "INVOICE_UPLOADED",
        "COCKTAIL_SOLD",
        "WASTE_RECORDED",
        "SUPPLIER_CHANGED",
        "NEW_PRODUCT_CREATED",
        "MARGIN_DROP",
        "TARGET_BREACH",
        "STOCK_OUT",
        "EXPIRY_WARNING",
        "PAYMENT_RECORDED",
        "PREP_BATCH_STARTED",
        "PREP_BATCH_COMPLETED",
        "PREP_BATCH_DISCARDED",
        "VARIANCE_DETECTED",
        "AI_INSIGHT_GENERATED",
        "MEMORY_CREATED",
        "INTER_COMPANY_SALE",
        "INTER_COMPANY_DELIVERY",
        "COST_ALLOCATED",
      ],
      company_type: ["holding", "lab", "bar", "shared_service"],
    },
  },
} as const
