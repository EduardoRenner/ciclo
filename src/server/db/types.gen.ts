export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointment_series: {
        Row: {
          address: string | null
          canceled_at: string | null
          client_id: string
          created_at: string
          created_by: string | null
          ends_on: string | null
          horario: string
          id: string
          intervalo_dias: number | null
          intervalo_semanas: number | null
          max_ocorrencias: number | null
          note: string | null
          ocorrencias_geradas: number
          ordinal_no_mes: number | null
          professional_id: string
          service_id: string
          starts_on: string
          status: string
          tenant_id: string
          tipo: string
          weekday: number | null
        }
        Insert: {
          address?: string | null
          canceled_at?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          horario: string
          id?: string
          intervalo_dias?: number | null
          intervalo_semanas?: number | null
          max_ocorrencias?: number | null
          note?: string | null
          ocorrencias_geradas?: number
          ordinal_no_mes?: number | null
          professional_id: string
          service_id: string
          starts_on: string
          status?: string
          tenant_id: string
          tipo: string
          weekday?: number | null
        }
        Update: {
          address?: string | null
          canceled_at?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          horario?: string
          id?: string
          intervalo_dias?: number | null
          intervalo_semanas?: number | null
          max_ocorrencias?: number | null
          note?: string | null
          ocorrencias_geradas?: number
          ordinal_no_mes?: number | null
          professional_id?: string
          service_id?: string
          starts_on?: string
          status?: string
          tenant_id?: string
          tipo?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_series_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_series_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_series_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_series_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_series_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_series_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          address: string | null
          arrived_at: string | null
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          client_id: string | null
          client_note: string | null
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          deposit_cents: number
          ends_at: string
          hold_expires_at: string | null
          id: string
          internal_note: string | null
          no_show_score: number | null
          origin: Database["public"]["Enums"]["appointment_origin"]
          period: unknown
          price_cents: number
          professional_id: string
          recurrence_id: string | null
          risk_features: Json | null
          service_id: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          arrived_at?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          client_id?: string | null
          client_note?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          deposit_cents?: number
          ends_at: string
          hold_expires_at?: string | null
          id?: string
          internal_note?: string | null
          no_show_score?: number | null
          origin?: Database["public"]["Enums"]["appointment_origin"]
          period?: unknown
          price_cents?: number
          professional_id: string
          recurrence_id?: string | null
          risk_features?: Json | null
          service_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          arrived_at?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          client_id?: string | null
          client_note?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          deposit_cents?: number
          ends_at?: string
          hold_expires_at?: string | null
          id?: string
          internal_note?: string | null
          no_show_score?: number | null
          origin?: Database["public"]["Enums"]["appointment_origin"]
          period?: unknown
          price_cents?: number
          professional_id?: string
          recurrence_id?: string | null
          risk_features?: Json | null
          service_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "appointment_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: number
          ip: unknown
          orphaned_at: string | null
          request_id: string | null
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: number
          ip?: unknown
          orphaned_at?: string | null
          request_id?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: number
          ip?: unknown
          orphaned_at?: string | null
          request_id?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          closes_at: string
          id: string
          opens_at: string
          professional_id: string | null
          tenant_id: string
          weekday: number
        }
        Insert: {
          closes_at: string
          id?: string
          opens_at: string
          professional_id?: string | null
          tenant_id: string
          weekday: number
        }
        Update: {
          closes_at?: string
          id?: string
          opens_at?: string
          professional_id?: string | null
          tenant_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          booked_count: number
          created_at: string
          id: string
          name: string
          revenue_cents: number
          segment: Json
          sent_count: number
          status: string
          template: string
          tenant_id: string
        }
        Insert: {
          booked_count?: number
          created_at?: string
          id?: string
          name: string
          revenue_cents?: number
          segment: Json
          sent_count?: number
          status?: string
          template: string
          tenant_id: string
        }
        Update: {
          booked_count?: number
          created_at?: string
          id?: string
          name?: string
          revenue_cents?: number
          segment?: Json
          sent_count?: number
          status?: string
          template?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_cycles: {
        Row: {
          client_id: string
          computed_at: string
          last_campaign_at: string | null
          last_visit_on: string | null
          late_days: number
          personal_cycle_days: number
          predicted_on: string | null
          profit_at_risk_cents: number
          sample_size: number
          service_id: string
          state: Database["public"]["Enums"]["cycle_state"]
          tenant_id: string
          value_at_risk_cents: number
        }
        Insert: {
          client_id: string
          computed_at?: string
          last_campaign_at?: string | null
          last_visit_on?: string | null
          late_days?: number
          personal_cycle_days: number
          predicted_on?: string | null
          profit_at_risk_cents?: number
          sample_size?: number
          service_id: string
          state?: Database["public"]["Enums"]["cycle_state"]
          tenant_id: string
          value_at_risk_cents?: number
        }
        Update: {
          client_id?: string
          computed_at?: string
          last_campaign_at?: string | null
          last_visit_on?: string | null
          late_days?: number
          personal_cycle_days?: number
          predicted_on?: string | null
          profit_at_risk_cents?: number
          sample_size?: number
          service_id?: string
          state?: Database["public"]["Enums"]["cycle_state"]
          tenant_id?: string
          value_at_risk_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cycles_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cycles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          appointment_id: string | null
          author_id: string | null
          body: string
          client_id: string
          created_at: string
          id: string
          tenant_id: string
        }
        Insert: {
          appointment_id?: string | null
          author_id?: string | null
          body: string
          client_id: string
          created_at?: string
          id?: string
          tenant_id: string
        }
        Update: {
          appointment_id?: string | null
          author_id?: string | null
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reviews: {
        Row: {
          appointment_id: string
          client_id: string | null
          comment: string | null
          created_at: string
          id: string
          rating: number
          tenant_id: string
        }
        Insert: {
          appointment_id: string
          client_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          tenant_id: string
        }
        Update: {
          appointment_id?: string
          client_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_scores: {
        Row: {
          algo_version: number
          client_id: string
          computed_at: string
          parts: Json
          profile: string
          score: number
          tenant_id: string
          tier: string
        }
        Insert: {
          algo_version: number
          client_id: string
          computed_at?: string
          parts?: Json
          profile: string
          score: number
          tenant_id: string
          tier: string
        }
        Update: {
          algo_version?: number
          client_id?: string
          computed_at?: string
          parts?: Json
          profile?: string
          score?: number
          tenant_id?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_subscriptions: {
        Row: {
          billing_day: number
          canceled_on: string | null
          client_id: string
          created_at: string
          id: string
          plan_id: string
          started_on: string
          status: string
          tenant_id: string
        }
        Insert: {
          billing_day: number
          canceled_on?: string | null
          client_id: string
          created_at?: string
          id?: string
          plan_id: string
          started_on?: string
          status?: string
          tenant_id: string
        }
        Update: {
          billing_day?: number
          canceled_on?: string | null
          client_id?: string
          created_at?: string
          id?: string
          plan_id?: string
          started_on?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          anonymized_at: string | null
          birth_date: string | null
          created_at: string
          deleted_at: string | null
          document: string | null
          email: string | null
          emergency_contact: string | null
          gender: string | null
          id: string
          last_visit_at: string | null
          ltv_cents: number
          marketing_opt_in: boolean
          name: string
          name_busca: string | null
          no_show_count: number
          notes: string | null
          online_booking_blocked: boolean
          phone_e164: string | null
          phone_hash: string | null
          preferences: Json
          preferred_professional_id: string | null
          referred_by: string | null
          source: string | null
          tags: string[]
          tenant_id: string
          user_id: string | null
          visits_count: number
          whatsapp_opt_out: boolean
        }
        Insert: {
          address?: string | null
          anonymized_at?: string | null
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          document?: string | null
          email?: string | null
          emergency_contact?: string | null
          gender?: string | null
          id?: string
          last_visit_at?: string | null
          ltv_cents?: number
          marketing_opt_in?: boolean
          name: string
          name_busca?: string | null
          no_show_count?: number
          notes?: string | null
          online_booking_blocked?: boolean
          phone_e164?: string | null
          phone_hash?: string | null
          preferences?: Json
          preferred_professional_id?: string | null
          referred_by?: string | null
          source?: string | null
          tags?: string[]
          tenant_id: string
          user_id?: string | null
          visits_count?: number
          whatsapp_opt_out?: boolean
        }
        Update: {
          address?: string | null
          anonymized_at?: string | null
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          document?: string | null
          email?: string | null
          emergency_contact?: string | null
          gender?: string | null
          id?: string
          last_visit_at?: string | null
          ltv_cents?: number
          marketing_opt_in?: boolean
          name?: string
          name_busca?: string | null
          no_show_count?: number
          notes?: string | null
          online_booking_blocked?: boolean
          phone_e164?: string | null
          phone_hash?: string | null
          preferences?: Json
          preferred_professional_id?: string | null
          referred_by?: string | null
          source?: string | null
          tags?: string[]
          tenant_id?: string
          user_id?: string | null
          visits_count?: number
          whatsapp_opt_out?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clients_preferred_professional_id_fkey"
            columns: ["preferred_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount_cents: number
          base_cents: number
          bps: number
          created_at: string
          id: string
          period_end: string
          period_start: string
          professional_id: string
          settled_at: string | null
          tenant_id: string
          ticket_item_id: string | null
        }
        Insert: {
          amount_cents: number
          base_cents: number
          bps: number
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          professional_id: string
          settled_at?: string | null
          tenant_id: string
          ticket_item_id?: string | null
        }
        Update: {
          amount_cents?: number
          base_cents?: number
          bps?: number
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          professional_id?: string
          settled_at?: string | null
          tenant_id?: string
          ticket_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_ticket_item_id_fkey"
            columns: ["ticket_item_id"]
            isOneToOne: false
            referencedRelation: "ticket_items"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          client_id: string
          granted: boolean
          granted_at: string
          id: string
          ip: unknown
          kind: Database["public"]["Enums"]["consent_type"]
          revoked_at: string | null
          signature_key: string | null
          tenant_id: string
          text_hash: string
          user_agent: string | null
          version: string
        }
        Insert: {
          client_id: string
          granted: boolean
          granted_at?: string
          id?: string
          ip?: unknown
          kind: Database["public"]["Enums"]["consent_type"]
          revoked_at?: string | null
          signature_key?: string | null
          tenant_id: string
          text_hash: string
          user_agent?: string | null
          version: string
        }
        Update: {
          client_id?: string
          granted?: boolean
          granted_at?: string
          id?: string
          ip?: unknown
          kind?: Database["public"]["Enums"]["consent_type"]
          revoked_at?: string | null
          signature_key?: string | null
          tenant_id?: string
          text_hash?: string
          user_agent?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_heartbeats: {
        Row: {
          kind: string
          last_run_at: string
        }
        Insert: {
          kind: string
          last_run_at?: string
        }
        Update: {
          kind?: string
          last_run_at?: string
        }
        Relationships: []
      }
      cycle_predictions: {
        Row: {
          actual_return_on: string | null
          algo_version: number
          client_id: string
          default_cycle_days: number
          id: string
          last_visit_on: string
          personal_cycle_days: number
          predicted_at: string
          predicted_on: string
          resolved_at: string | null
          service_id: string
          tenant_id: string
        }
        Insert: {
          actual_return_on?: string | null
          algo_version: number
          client_id: string
          default_cycle_days: number
          id?: string
          last_visit_on: string
          personal_cycle_days: number
          predicted_at?: string
          predicted_on: string
          resolved_at?: string | null
          service_id: string
          tenant_id: string
        }
        Update: {
          actual_return_on?: string | null
          algo_version?: number
          client_id?: string
          default_cycle_days?: number
          id?: string
          last_visit_on?: string
          personal_cycle_days?: number
          predicted_at?: string
          predicted_on?: string
          resolved_at?: string | null
          service_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_predictions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_predictions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_predictions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_predictions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          baseline: Json
          canceled_at: string | null
          created_at: string
          created_by: string | null
          dias: number
          id: string
          metrica: string
          starts_on: string
          tenant_id: string
          titulo: string
          weekday: number | null
        }
        Insert: {
          baseline: Json
          canceled_at?: string | null
          created_at?: string
          created_by?: string | null
          dias: number
          id?: string
          metrica: string
          starts_on: string
          tenant_id: string
          titulo: string
          weekday?: number | null
        }
        Update: {
          baseline?: Json
          canceled_at?: string | null
          created_at?: string
          created_by?: string | null
          dias?: number
          id?: string
          metrica?: string
          starts_on?: string
          tenant_id?: string
          titulo?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "experiments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      health_records: {
        Row: {
          alert_label: string | null
          auth_tag: string
          ciphertext: string
          client_id: string
          created_at: string
          filled_by: string
          form_key: string
          has_alert: boolean
          id: string
          iv: string
          key_version: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          alert_label?: string | null
          auth_tag: string
          ciphertext: string
          client_id: string
          created_at?: string
          filled_by?: string
          form_key: string
          has_alert?: boolean
          id?: string
          iv: string
          key_version?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          alert_label?: string | null
          auth_tag?: string
          ciphertext?: string
          client_id?: string
          created_at?: string
          filled_by?: string
          form_key?: string
          has_alert?: boolean
          id?: string
          iv?: string
          key_version?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string
          endpoint: string
          key: string
          request_hash: string
          response_body: Json | null
          response_status: number | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          key: string
          request_hash: string
          response_body?: Json | null
          response_status?: number | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          key?: string
          request_hash?: string
          response_body?: Json | null
          response_status?: number | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          display_name: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_queue: {
        Row: {
          attempts: number
          created_at: string
          id: number
          kind: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          payload: Json
          run_after: string
          status: Database["public"]["Enums"]["job_status"]
          tenant_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: number
          kind: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          run_after?: string
          status?: Database["public"]["Enums"]["job_status"]
          tenant_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: number
          kind?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          run_after?: string
          status?: Database["public"]["Enums"]["job_status"]
          tenant_id?: string | null
        }
        Relationships: []
      }
      legal_access_log: {
        Row: {
          at: string
          case_id: string | null
          client_id: string | null
          document_id: string | null
          id: number
          ip_hash: string | null
          kind: string
          tenant_id: string
          user_id: string | null
          version_id: string | null
        }
        Insert: {
          at?: string
          case_id?: string | null
          client_id?: string | null
          document_id?: string | null
          id?: never
          ip_hash?: string | null
          kind: string
          tenant_id: string
          user_id?: string | null
          version_id?: string | null
        }
        Update: {
          at?: string
          case_id?: string | null
          client_id?: string | null
          document_id?: string | null
          id?: never
          ip_hash?: string | null
          kind?: string
          tenant_id?: string
          user_id?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_access_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_case_meetings: {
        Row: {
          appointment_id: string
          case_id: string
          created_at: string
          tenant_id: string
        }
        Insert: {
          appointment_id: string
          case_id: string
          created_at?: string
          tenant_id: string
        }
        Update: {
          appointment_id?: string
          case_id?: string
          created_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_case_meetings_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_case_meetings_case_id_tenant_id_fkey"
            columns: ["case_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_cases"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_case_meetings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_case_members: {
        Row: {
          case_id: string
          created_at: string
          professional_id: string
          role: string
          tenant_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          professional_id: string
          role?: string
          tenant_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          professional_id?: string
          role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_case_members_case_id_tenant_id_fkey"
            columns: ["case_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_cases"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_case_members_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_case_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_cases: {
        Row: {
          archived_at: string | null
          area: string
          checklist_template_version: number | null
          client_id: string
          client_status_note: string | null
          client_title: string
          closed_on: string | null
          cnj_number: string | null
          comarca: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          opened_on: string
          prazo_em_dobro: boolean
          responsible_professional_id: string | null
          rito: string | null
          row_version: number
          sensitivity: string
          sensitivity_reason: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          area?: string
          checklist_template_version?: number | null
          client_id: string
          client_status_note?: string | null
          client_title: string
          closed_on?: string | null
          cnj_number?: string | null
          comarca?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          opened_on?: string
          prazo_em_dobro?: boolean
          responsible_professional_id?: string | null
          rito?: string | null
          row_version?: number
          sensitivity?: string
          sensitivity_reason?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          area?: string
          checklist_template_version?: number | null
          client_id?: string
          client_status_note?: string | null
          client_title?: string
          closed_on?: string | null
          cnj_number?: string | null
          comarca?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          opened_on?: string
          prazo_em_dobro?: boolean
          responsible_professional_id?: string | null
          rito?: string | null
          row_version?: number
          sensitivity?: string
          sensitivity_reason?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_cases_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_cases_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_cases_responsible_professional_id_fkey"
            columns: ["responsible_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_cases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_checklist_items: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          call_task_created: boolean
          cancel_reason: string | null
          case_id: string
          created_at: string
          created_by: string | null
          document_id: string | null
          due_on: string | null
          expected_category: string | null
          id: string
          instructions: string | null
          kind: string
          owed_by: string
          owed_by_person_id: string | null
          position: number
          reminders_sent: number[]
          returned_reason: string | null
          rodada: number
          rodada_desde: string
          row_version: number
          status: string
          template_item_id: string | null
          tenant_id: string
          title: string
          updated_at: string
          urgency: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          call_task_created?: boolean
          cancel_reason?: string | null
          case_id: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          due_on?: string | null
          expected_category?: string | null
          id?: string
          instructions?: string | null
          kind: string
          owed_by: string
          owed_by_person_id?: string | null
          position?: number
          reminders_sent?: number[]
          returned_reason?: string | null
          rodada?: number
          rodada_desde?: string
          row_version?: number
          status?: string
          template_item_id?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          call_task_created?: boolean
          cancel_reason?: string | null
          case_id?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          due_on?: string | null
          expected_category?: string | null
          id?: string
          instructions?: string | null
          kind?: string
          owed_by?: string
          owed_by_person_id?: string | null
          position?: number
          reminders_sent?: number[]
          returned_reason?: string | null
          rodada?: number
          rodada_desde?: string
          row_version?: number
          status?: string
          template_item_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_checklist_items_case_id_tenant_id_fkey"
            columns: ["case_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_cases"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_checklist_items_owed_by_person_id_tenant_id_fkey"
            columns: ["owed_by_person_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_persons"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_checklist_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "legal_checklist_template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_checklist_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_checklist_template_items: {
        Row: {
          expected_category: string | null
          id: string
          kind: string
          offset_business_days: number
          owed_by: string
          position: number
          template_id: string
          title: string
          urgency: string
        }
        Insert: {
          expected_category?: string | null
          id?: string
          kind: string
          offset_business_days: number
          owed_by: string
          position: number
          template_id: string
          title: string
          urgency?: string
        }
        Update: {
          expected_category?: string | null
          id?: string
          kind?: string
          offset_business_days?: number
          owed_by?: string
          position?: number
          template_id?: string
          title?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "legal_checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_checklist_templates: {
        Row: {
          active: boolean
          case_kind: string
          created_at: string
          id: string
          name: string
          needs_review: boolean
          tenant_id: string | null
          version: number
        }
        Insert: {
          active?: boolean
          case_kind: string
          created_at?: string
          id?: string
          name: string
          needs_review?: boolean
          tenant_id?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          case_kind?: string
          created_at?: string
          id?: string
          name?: string
          needs_review?: boolean
          tenant_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_checklist_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_corporate_changes: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          effective_on: string
          entity_id: string
          id: string
          kind: string
          registered_on: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_on: string
          entity_id: string
          id?: string
          kind: string
          registered_on?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_on?: string
          entity_id?: string
          id?: string
          kind?: string
          registered_on?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_corporate_changes_entity_id_tenant_id_fkey"
            columns: ["entity_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_corporate_changes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_deadline_alerts: {
        Row: {
          deadline_id: string
          emitted_at: string
          id: number
          marco: number
          notified_user_id: string | null
          tenant_id: string
        }
        Insert: {
          deadline_id: string
          emitted_at?: string
          id?: never
          marco: number
          notified_user_id?: string | null
          tenant_id: string
        }
        Update: {
          deadline_id?: string
          emitted_at?: string
          id?: never
          marco?: number
          notified_user_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_deadline_alerts_deadline_id_tenant_id_fkey"
            columns: ["deadline_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_deadlines"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_deadline_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_deadline_changes: {
        Row: {
          changed_at: string
          changed_by: string | null
          deadline_id: string
          field: string
          id: number
          new_value: string | null
          old_value: string | null
          reason: string | null
          tenant_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          deadline_id: string
          field: string
          id?: never
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          tenant_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          deadline_id?: string
          field?: string
          id?: never
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_deadline_changes_deadline_id_tenant_id_fkey"
            columns: ["deadline_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_deadlines"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_deadline_changes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_deadlines: {
        Row: {
          alert_days: number[]
          calc_divergence: boolean | null
          calc_memo: Json | null
          calc_rule_version: string | null
          case_id: string | null
          change_reason: string | null
          client_id: string
          close_document_id: string | null
          close_note: string | null
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          due_on: string
          id: string
          internal_due_on: string | null
          intimation_id: string | null
          kind: string
          responsible_professional_id: string | null
          source: string
          source_note: string | null
          status: string
          suggested_due_on: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          alert_days?: number[]
          calc_divergence?: boolean | null
          calc_memo?: Json | null
          calc_rule_version?: string | null
          case_id?: string | null
          change_reason?: string | null
          client_id: string
          close_document_id?: string | null
          close_note?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          due_on: string
          id?: string
          internal_due_on?: string | null
          intimation_id?: string | null
          kind: string
          responsible_professional_id?: string | null
          source?: string
          source_note?: string | null
          status?: string
          suggested_due_on?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          alert_days?: number[]
          calc_divergence?: boolean | null
          calc_memo?: Json | null
          calc_rule_version?: string | null
          case_id?: string | null
          change_reason?: string | null
          client_id?: string
          close_document_id?: string | null
          close_note?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          due_on?: string
          id?: string
          internal_due_on?: string | null
          intimation_id?: string | null
          kind?: string
          responsible_professional_id?: string | null
          source?: string
          source_note?: string | null
          status?: string
          suggested_due_on?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_deadlines_case_id_tenant_id_fkey"
            columns: ["case_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_cases"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_deadlines_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_deadlines_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_deadlines_close_document_id_tenant_id_fkey"
            columns: ["close_document_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_deadlines_intimation_id_tenant_id_fkey"
            columns: ["intimation_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_intimations"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_deadlines_responsible_professional_id_fkey"
            columns: ["responsible_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_deadlines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_document_links: {
        Row: {
          created_at: string
          document_id: string
          id: string
          target_id: string
          target_type: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          target_id: string
          target_type: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          target_id?: string
          target_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_document_links_document_id_tenant_id_fkey"
            columns: ["document_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_document_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_document_versions: {
        Row: {
          created_at: string
          document_id: string
          id: string
          mime: string
          note: string | null
          removed_at: string | null
          sha256: string
          size_bytes: number
          storage_path: string
          tenant_id: string
          uploaded_by: string | null
          version_no: number
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          mime: string
          note?: string | null
          removed_at?: string | null
          sha256: string
          size_bytes: number
          storage_path: string
          tenant_id: string
          uploaded_by?: string | null
          version_no: number
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          mime?: string
          note?: string | null
          removed_at?: string | null
          sha256?: string
          size_bytes?: number
          storage_path?: string
          tenant_id?: string
          uploaded_by?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_document_versions_document_id_tenant_id_fkey"
            columns: ["document_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_document_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          archived_at: string | null
          case_id: string | null
          category: string
          client_id: string
          created_at: string
          created_by: string | null
          current_version_id: string | null
          id: string
          issued_on: string | null
          origin: string
          refused_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          row_version: number
          sensitivity: string
          status: string
          tags: string[]
          tenant_id: string
          title: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          archived_at?: string | null
          case_id?: string | null
          category?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          id?: string
          issued_on?: string | null
          origin?: string
          refused_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_version?: number
          sensitivity?: string
          status?: string
          tags?: string[]
          tenant_id: string
          title: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          archived_at?: string | null
          case_id?: string | null
          category?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          id?: string
          issued_on?: string | null
          origin?: string
          refused_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_version?: number
          sensitivity?: string
          status?: string
          tags?: string[]
          tenant_id?: string
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_case_id_tenant_id_fkey"
            columns: ["case_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_cases"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_documents_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_documents_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_documents_current_version_fkey"
            columns: ["current_version_id", "id"]
            isOneToOne: false
            referencedRelation: "legal_document_versions"
            referencedColumns: ["id", "document_id"]
          },
          {
            foreignKeyName: "legal_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_entities: {
        Row: {
          archived_at: string | null
          city: string | null
          client_id: string
          cnpj_hash: string | null
          created_at: string
          created_by: string | null
          id: string
          incorporated_on: string | null
          is_external: boolean
          kind: string
          legal_form: string | null
          legal_name: string
          main_cnae: string | null
          next_review_on: string | null
          row_version: number
          share_capital_cents: number | null
          status: string
          tax_regime: string | null
          tenant_id: string
          total_quotas: number | null
          trade_name: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          city?: string | null
          client_id: string
          cnpj_hash?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          incorporated_on?: string | null
          is_external?: boolean
          kind: string
          legal_form?: string | null
          legal_name: string
          main_cnae?: string | null
          next_review_on?: string | null
          row_version?: number
          share_capital_cents?: number | null
          status?: string
          tax_regime?: string | null
          tenant_id: string
          total_quotas?: number | null
          trade_name?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          city?: string | null
          client_id?: string
          cnpj_hash?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          incorporated_on?: string | null
          is_external?: boolean
          kind?: string
          legal_form?: string | null
          legal_name?: string
          main_cnae?: string | null
          next_review_on?: string | null
          row_version?: number
          share_capital_cents?: number | null
          status?: string
          tax_regime?: string | null
          tenant_id?: string
          total_quotas?: number | null
          trade_name?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_entities_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_entities_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_entities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_holidays: {
        Row: {
          comarca: string | null
          conferido_por: string | null
          created_at: string
          day: string
          fonte_url: string | null
          id: string
          name: string
          scope: string
          tenant_id: string | null
          tribunal: string | null
        }
        Insert: {
          comarca?: string | null
          conferido_por?: string | null
          created_at?: string
          day: string
          fonte_url?: string | null
          id?: string
          name: string
          scope: string
          tenant_id?: string | null
          tribunal?: string | null
        }
        Update: {
          comarca?: string | null
          conferido_por?: string | null
          created_at?: string
          day?: string
          fonte_url?: string | null
          id?: string
          name?: string
          scope?: string
          tenant_id?: string | null
          tribunal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_holidays_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_intimation_suggestions: {
        Row: {
          calc_memo: Json | null
          calc_rule_version: string | null
          created_at: string
          id: string
          internal_due_on: string | null
          intimation_id: string
          sem_sugestao: string | null
          suggested_due_on: string | null
          tenant_id: string
        }
        Insert: {
          calc_memo?: Json | null
          calc_rule_version?: string | null
          created_at?: string
          id?: string
          internal_due_on?: string | null
          intimation_id: string
          sem_sugestao?: string | null
          suggested_due_on?: string | null
          tenant_id: string
        }
        Update: {
          calc_memo?: Json | null
          calc_rule_version?: string | null
          created_at?: string
          id?: string
          internal_due_on?: string | null
          intimation_id?: string
          sem_sugestao?: string | null
          suggested_due_on?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_intimation_suggestions_intimation_id_tenant_id_fkey"
            columns: ["intimation_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_intimations"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_intimation_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_intimation_sync: {
        Row: {
          alvo: string
          count_fonte: number
          count_gravado: number
          created_at: string
          detalhe: string | null
          dia: string
          id: string
          ok: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          alvo: string
          count_fonte: number
          count_gravado: number
          created_at?: string
          detalhe?: string | null
          dia: string
          id?: string
          ok: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          alvo?: string
          count_fonte?: number
          count_gravado?: number
          created_at?: string
          detalhe?: string | null
          dia?: string
          id?: string
          ok?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_intimation_sync_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_intimations: {
        Row: {
          alvo: string
          cancel_reason: string | null
          cancelled_at: string | null
          case_id: string | null
          classe: string | null
          created_at: string
          data_disponibilizacao: string
          destinatarios: Json
          djen_id: number
          hash: string | null
          id: string
          link: string | null
          numero_processo: string
          orgao: string | null
          reason: string | null
          status: string
          tenant_id: string
          texto_sanitizado: string
          tipo: string | null
          triaged_at: string | null
          triaged_by: string | null
          tribunal: string
          updated_at: string
        }
        Insert: {
          alvo: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          case_id?: string | null
          classe?: string | null
          created_at?: string
          data_disponibilizacao: string
          destinatarios?: Json
          djen_id: number
          hash?: string | null
          id?: string
          link?: string | null
          numero_processo: string
          orgao?: string | null
          reason?: string | null
          status?: string
          tenant_id: string
          texto_sanitizado: string
          tipo?: string | null
          triaged_at?: string | null
          triaged_by?: string | null
          tribunal: string
          updated_at?: string
        }
        Update: {
          alvo?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          case_id?: string | null
          classe?: string | null
          created_at?: string
          data_disponibilizacao?: string
          destinatarios?: Json
          djen_id?: number
          hash?: string | null
          id?: string
          link?: string | null
          numero_processo?: string
          orgao?: string | null
          reason?: string | null
          status?: string
          tenant_id?: string
          texto_sanitizado?: string
          tipo?: string | null
          triaged_at?: string | null
          triaged_by?: string | null
          tribunal?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_intimations_case_id_tenant_id_fkey"
            columns: ["case_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_cases"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_intimations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_ownerships: {
        Row: {
          closed_by_change_id: string | null
          created_at: string
          id: string
          opened_by_change_id: string
          owned_entity_id: string
          owner_entity_id: string | null
          owner_key: string | null
          owner_person_id: string | null
          percent: number
          quota_class: string | null
          quotas: number | null
          tenant_id: string
          updated_at: string
          usufruct_person_id: string | null
          usufruct_until: string | null
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          closed_by_change_id?: string | null
          created_at?: string
          id?: string
          opened_by_change_id: string
          owned_entity_id: string
          owner_entity_id?: string | null
          owner_key?: string | null
          owner_person_id?: string | null
          percent: number
          quota_class?: string | null
          quotas?: number | null
          tenant_id: string
          updated_at?: string
          usufruct_person_id?: string | null
          usufruct_until?: string | null
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          closed_by_change_id?: string | null
          created_at?: string
          id?: string
          opened_by_change_id?: string
          owned_entity_id?: string
          owner_entity_id?: string | null
          owner_key?: string | null
          owner_person_id?: string | null
          percent?: number
          quota_class?: string | null
          quotas?: number | null
          tenant_id?: string
          updated_at?: string
          usufruct_person_id?: string | null
          usufruct_until?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_ownerships_closed_by_change_id_tenant_id_fkey"
            columns: ["closed_by_change_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_corporate_changes"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_ownerships_opened_by_change_id_tenant_id_fkey"
            columns: ["opened_by_change_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_corporate_changes"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_ownerships_owned_entity_id_tenant_id_fkey"
            columns: ["owned_entity_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_ownerships_owner_entity_id_tenant_id_fkey"
            columns: ["owner_entity_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_ownerships_owner_person_id_tenant_id_fkey"
            columns: ["owner_person_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_persons"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_ownerships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_ownerships_usufruct_person_id_tenant_id_fkey"
            columns: ["usufruct_person_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "legal_persons"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      legal_persons: {
        Row: {
          archived_at: string | null
          birth_date: string | null
          client_id: string
          created_at: string
          created_by: string | null
          document_hash: string | null
          email: string | null
          full_name: string
          id: string
          is_contact: boolean
          marital_regime: string
          notes: string | null
          phone_e164: string | null
          relationship: string
          row_version: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          birth_date?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          document_hash?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_contact?: boolean
          marital_regime?: string
          notes?: string | null
          phone_e164?: string | null
          relationship?: string
          row_version?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          birth_date?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          document_hash?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_contact?: boolean
          marital_regime?: string
          notes?: string | null
          phone_e164?: string | null
          relationship?: string
          row_version?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_persons_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_persons_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "legal_persons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_entries: {
        Row: {
          appointment_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          points: number
          reason: string
          tenant_id: string
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          points: number
          reason: string
          tenant_id: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          points?: number
          reason?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_entries_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          appointment_id: string | null
          bytes: number | null
          client_id: string | null
          consent_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          height: number | null
          id: string
          kind: string
          phase: string | null
          storage_key: string
          tenant_id: string
          width: number | null
        }
        Insert: {
          appointment_id?: string | null
          bytes?: number | null
          client_id?: string | null
          consent_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          height?: number | null
          id?: string
          kind?: string
          phase?: string | null
          storage_key: string
          tenant_id: string
          width?: number | null
        }
        Update: {
          appointment_id?: string | null
          bytes?: number | null
          client_id?: string | null
          consent_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          height?: number | null
          id?: string
          kind?: string
          phase?: string | null
          storage_key?: string
          tenant_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "consents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          active: boolean
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
          position: number
          slug: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          id?: string
          position?: number
          slug: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          position?: number
          slug?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          appointment_id: string | null
          body: string | null
          booked_appointment_id: string | null
          campaign_id: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          clicked_at: string | null
          client_id: string | null
          cost_cents: number
          created_at: string
          error: string | null
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          provider_id: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          template: string | null
          tenant_id: string
        }
        Insert: {
          appointment_id?: string | null
          body?: string | null
          booked_appointment_id?: string | null
          campaign_id?: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          clicked_at?: string | null
          client_id?: string | null
          cost_cents?: number
          created_at?: string
          error?: string | null
          id?: string
          kind: Database["public"]["Enums"]["message_kind"]
          provider_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          template?: string | null
          tenant_id: string
        }
        Update: {
          appointment_id?: string | null
          body?: string | null
          booked_appointment_id?: string | null
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          clicked_at?: string | null
          client_id?: string | null
          cost_cents?: number
          created_at?: string
          error?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          provider_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          template?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_booked_appointment_id_fkey"
            columns: ["booked_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          eixo: string | null
          key: string
          label: string
          ordem: number
          sempre_ligado: boolean
        }
        Insert: {
          eixo?: string | null
          key: string
          label: string
          ordem: number
          sempre_ligado?: boolean
        }
        Update: {
          eixo?: string | null
          key?: string
          label?: string
          ordem?: number
          sempre_ligado?: boolean
        }
        Relationships: []
      }
      monthly_profit: {
        Row: {
          commission_cents: number
          fee_cents: number
          frozen_at: string
          material_cents: number
          month: string
          profit_cents: number
          revenue_cents: number
          tenant_id: string
          tickets_count: number
        }
        Insert: {
          commission_cents: number
          fee_cents: number
          frozen_at?: string
          material_cents: number
          month: string
          profit_cents: number
          revenue_cents: number
          tenant_id: string
          tickets_count: number
        }
        Update: {
          commission_cents?: number
          fee_cents?: number
          frozen_at?: string
          material_cents?: number
          month?: string
          profit_cents?: number
          revenue_cents?: number
          tenant_id?: string
          tickets_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_profit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      package_uses: {
        Row: {
          appointment_id: string | null
          id: string
          package_id: string
          tenant_id: string
          used_at: string
        }
        Insert: {
          appointment_id?: string | null
          id?: string
          package_id: string
          tenant_id: string
          used_at?: string
        }
        Update: {
          appointment_id?: string | null
          id?: string
          package_id?: string
          tenant_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_uses_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_uses_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_uses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          client_id: string
          created_at: string
          expires_on: string | null
          id: string
          paid_cents: number
          service_id: string
          tenant_id: string
          total_sessions: number
          used_sessions: number
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_on?: string | null
          id?: string
          paid_cents?: number
          service_id: string
          tenant_id: string
          total_sessions: number
          used_sessions?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_on?: string | null
          id?: string
          paid_cents?: number
          service_id?: string
          tenant_id?: string
          total_sessions?: number
          used_sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "packages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          appointment_id: string | null
          client_id: string | null
          created_at: string
          expires_at: string | null
          fee_cents: number
          id: string
          installments: number
          kind: Database["public"]["Enums"]["payment_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          net_cents: number | null
          paid_at: string | null
          pix_copy_paste: string | null
          pix_qr: string | null
          psp: string | null
          psp_charge_id: string | null
          psp_payload: Json | null
          refund_amount_cents: number | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          tenant_id: string
          ticket_id: string | null
        }
        Insert: {
          amount_cents: number
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          expires_at?: string | null
          fee_cents?: number
          id?: string
          installments?: number
          kind: Database["public"]["Enums"]["payment_kind"]
          method: Database["public"]["Enums"]["payment_method"]
          net_cents?: number | null
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr?: string | null
          psp?: string | null
          psp_charge_id?: string | null
          psp_payload?: Json | null
          refund_amount_cents?: number | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id: string
          ticket_id?: string | null
        }
        Update: {
          amount_cents?: number
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          expires_at?: string | null
          fee_cents?: number
          id?: string
          installments?: number
          kind?: Database["public"]["Enums"]["payment_kind"]
          method?: Database["public"]["Enums"]["payment_method"]
          net_cents?: number | null
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr?: string | null
          psp?: string | null
          psp_charge_id?: string | null
          psp_payload?: Json | null
          refund_amount_cents?: number | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_photos: {
        Row: {
          client_id: string
          created_at: string
          id: string
          source_media_id: string | null
          storage_key: string
          tenant_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          source_media_id?: string | null
          storage_key: string
          tenant_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          source_media_id?: string | null
          storage_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_photos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_photos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_photos_source_media_id_fkey"
            columns: ["source_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_photos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          meta: Json
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          meta?: Json
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          meta?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          avg_cost_cents: number
          created_at: string
          deleted_at: string | null
          expires_at: string | null
          id: string
          is_retail: boolean
          name: string
          price_cents: number | null
          reorder_point: number
          sku: string | null
          stock_qty: number
          tenant_id: string
          unit: string
        }
        Insert: {
          active?: boolean
          avg_cost_cents?: number
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          is_retail?: boolean
          name: string
          price_cents?: number | null
          reorder_point?: number
          sku?: string | null
          stock_qty?: number
          tenant_id: string
          unit?: string
        }
        Update: {
          active?: boolean
          avg_cost_cents?: number
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          is_retail?: boolean
          name?: string
          price_cents?: number | null
          reorder_point?: number
          sku?: string | null
          stock_qty?: number
          tenant_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profession_services: {
        Row: {
          ciclo_dias: number | null
          duracao_min: number
          id: string
          nome: string
          posicao: number
          preco_sugerido_cents: number
          profession_id: string
        }
        Insert: {
          ciclo_dias?: number | null
          duracao_min: number
          id?: string
          nome: string
          posicao?: number
          preco_sugerido_cents: number
          profession_id: string
        }
        Update: {
          ciclo_dias?: number | null
          duracao_min?: number
          id?: string
          nome?: string
          posicao?: number
          preco_sugerido_cents?: number
          profession_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profession_services_profession_id_fkey"
            columns: ["profession_id"]
            isOneToOne: false
            referencedRelation: "professions"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_services: {
        Row: {
          commission_bps: number | null
          duration_min: number | null
          price_cents: number | null
          professional_id: string
          service_id: string
          tenant_id: string
        }
        Insert: {
          commission_bps?: number | null
          duration_min?: number | null
          price_cents?: number | null
          professional_id: string
          service_id: string
          tenant_id: string
        }
        Update: {
          commission_bps?: number | null
          duration_min?: number | null
          price_cents?: number | null
          professional_id?: string
          service_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          accepts_online: boolean
          active: boolean
          bio: string | null
          color: string | null
          commission_bps: number
          product_commission_bps: number | null
          comp_model: Database["public"]["Enums"]["comp_model"]
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
          legal_role: string | null
          oab_number: string | null
          oab_uf: string | null
          photo_key: string | null
          rent_cents: number
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          accepts_online?: boolean
          active?: boolean
          bio?: string | null
          color?: string | null
          commission_bps?: number
          product_commission_bps?: number | null
          comp_model?: Database["public"]["Enums"]["comp_model"]
          created_at?: string
          deleted_at?: string | null
          display_name: string
          id?: string
          legal_role?: string | null
          oab_number?: string | null
          oab_uf?: string | null
          photo_key?: string | null
          rent_cents?: number
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          accepts_online?: boolean
          active?: boolean
          bio?: string | null
          color?: string | null
          commission_bps?: number
          product_commission_bps?: number | null
          comp_model?: Database["public"]["Enums"]["comp_model"]
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          id?: string
          legal_role?: string | null
          oab_number?: string | null
          oab_uf?: string | null
          photo_key?: string | null
          rent_cents?: number
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professions: {
        Row: {
          ativa: boolean
          campos_ficha: Json
          ciclo_padrao_dias: number
          cobranca: string
          created_at: string
          duracao_padrao_min: number
          grupo: string
          id: string
          inicio: string
          mensagens: Json
          modulos_padrao: Json
          nome: string
          onde: string
          pacote: string
          posicao: number
          ritmo: string
          sinonimos: string[]
          slug: string
          vocab: Json
        }
        Insert: {
          ativa?: boolean
          campos_ficha?: Json
          ciclo_padrao_dias: number
          cobranca: string
          created_at?: string
          duracao_padrao_min: number
          grupo: string
          id?: string
          inicio: string
          mensagens?: Json
          modulos_padrao?: Json
          nome: string
          onde: string
          pacote?: string
          posicao?: number
          ritmo: string
          sinonimos?: string[]
          slug: string
          vocab?: Json
        }
        Update: {
          ativa?: boolean
          campos_ficha?: Json
          ciclo_padrao_dias?: number
          cobranca?: string
          created_at?: string
          duracao_padrao_min?: number
          grupo?: string
          id?: string
          inicio?: string
          mensagens?: Json
          modulos_padrao?: Json
          nome?: string
          onde?: string
          pacote?: string
          posicao?: number
          ritmo?: string
          sinonimos?: string[]
          slug?: string
          vocab?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          locale: string
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          locale?: string
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          locale?: string
          phone?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          tenant_id: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          description: string
          id: string
          qty: number
          quote_id: string
          tenant_id: string
          total_cents: number
          unit_price_cents: number
        }
        Insert: {
          description: string
          id?: string
          qty?: number
          quote_id: string
          tenant_id: string
          total_cents: number
          unit_price_cents: number
        }
        Update: {
          description?: string
          id?: string
          qty?: number
          quote_id?: string
          tenant_id?: string
          total_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          approved_at: string | null
          client_id: string
          converted_appointment_id: string | null
          created_at: string
          created_by: string | null
          id: string
          message: string | null
          professional_id: string | null
          rejected_at: string | null
          rejected_reason: string | null
          sent_at: string | null
          status: string
          tenant_id: string
          total_cents: number
          valid_until: string | null
        }
        Insert: {
          approved_at?: string | null
          client_id: string
          converted_appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          professional_id?: string | null
          rejected_at?: string | null
          rejected_reason?: string | null
          sent_at?: string | null
          status?: string
          tenant_id: string
          total_cents?: number
          valid_until?: string | null
        }
        Update: {
          approved_at?: string | null
          client_id?: string
          converted_appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          professional_id?: string | null
          rejected_at?: string | null
          rejected_reason?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string
          total_cents?: number
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_appointment_id_fkey"
            columns: ["converted_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          expires_at: string
          key: string
        }
        Insert: {
          count: number
          expires_at: string
          key: string
        }
        Update: {
          count?: number
          expires_at?: string
          key?: string
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          id: string
          name: string
          position: number
          tenant_id: string
        }
        Insert: {
          id?: string
          name: string
          position?: number
          tenant_id: string
        }
        Update: {
          id?: string
          name?: string
          position?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_products: {
        Row: {
          product_id: string
          qty: number
          service_id: string
          tenant_id: string
        }
        Insert: {
          product_id: string
          qty: number
          service_id: string
          tenant_id: string
        }
        Update: {
          product_id?: string
          qty?: number
          service_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_products_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          bookable_online: boolean
          buffer_after_min: number
          buffer_before_min: number
          canonical_key: string | null
          category_id: string | null
          cost_cents: number
          created_at: string
          cycle_days: number
          cycle_days_observado: number | null
          cycle_days_observado_amostra: number | null
          cycle_days_observado_em: string | null
          deleted_at: string | null
          deposit_bps: number
          deposit_min_cents: number
          description: string | null
          duration_min: number
          half_day_price_cents: number | null
          hourly_rate_cents: number | null
          id: string
          image_key: string | null
          name: string
          parallel_capacity: number
          position: number
          price_cents: number
          pricing_model: string
          requires_anamnesis: boolean
          suggested_product_id: string | null
          tenant_id: string
        }
        Insert: {
          active?: boolean
          bookable_online?: boolean
          buffer_after_min?: number
          buffer_before_min?: number
          canonical_key?: string | null
          category_id?: string | null
          cost_cents?: number
          created_at?: string
          cycle_days?: number
          cycle_days_observado?: number | null
          cycle_days_observado_amostra?: number | null
          cycle_days_observado_em?: string | null
          deleted_at?: string | null
          deposit_bps?: number
          deposit_min_cents?: number
          description?: string | null
          duration_min: number
          half_day_price_cents?: number | null
          hourly_rate_cents?: number | null
          id?: string
          image_key?: string | null
          name: string
          parallel_capacity?: number
          position?: number
          price_cents: number
          pricing_model?: string
          requires_anamnesis?: boolean
          suggested_product_id?: string | null
          tenant_id: string
        }
        Update: {
          active?: boolean
          bookable_online?: boolean
          buffer_after_min?: number
          buffer_before_min?: number
          canonical_key?: string | null
          category_id?: string | null
          cost_cents?: number
          created_at?: string
          cycle_days?: number
          cycle_days_observado?: number | null
          cycle_days_observado_amostra?: number | null
          cycle_days_observado_em?: string | null
          deleted_at?: string | null
          deposit_bps?: number
          deposit_min_cents?: number
          description?: string | null
          duration_min?: number
          half_day_price_cents?: number | null
          hourly_rate_cents?: number | null
          id?: string
          image_key?: string | null
          name?: string
          parallel_capacity?: number
          position?: number
          price_cents?: number
          pricing_model?: string
          requires_anamnesis?: boolean
          suggested_product_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_suggested_product_id_fkey"
            columns: ["suggested_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_moves: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["stock_move_type"]
          note: string | null
          product_id: string
          qty: number
          source: string | null
          source_id: string | null
          tenant_id: string
          unit_cost_cents: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["stock_move_type"]
          note?: string | null
          product_id: string
          qty: number
          source?: string | null
          source_id?: string | null
          tenant_id: string
          unit_cost_cents?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["stock_move_type"]
          note?: string | null
          product_id?: string
          qty?: number
          source?: string | null
          source_id?: string | null
          tenant_id?: string
          unit_cost_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_moves_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_moves_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_moves_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean
          benefits: string | null
          created_at: string
          id: string
          name: string
          price_cents: number
          sessions_per_month: number | null
          tenant_id: string
        }
        Insert: {
          active?: boolean
          benefits?: string | null
          created_at?: string
          id?: string
          name: string
          price_cents: number
          sessions_per_month?: number | null
          tenant_id: string
        }
        Update: {
          active?: boolean
          benefits?: string | null
          created_at?: string
          id?: string
          name?: string
          price_cents?: number
          sessions_per_month?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_keys: {
        Row: {
          dek_wrapped: string
          key_version: number
          rotated_at: string
          tenant_id: string
        }
        Insert: {
          dek_wrapped: string
          key_version?: number
          rotated_at?: string
          tenant_id: string
        }
        Update: {
          dek_wrapped?: string
          key_version?: number
          rotated_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_modules: {
        Row: {
          ligado: boolean
          modulo: string
          origem: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ligado: boolean
          modulo: string
          origem: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ligado?: boolean
          modulo?: string
          origem?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_modulo_fkey"
            columns: ["modulo"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: Json | null
          cobranca: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          document: string | null
          id: string
          inicio: string | null
          name: string
          onde: string | null
          phone: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          profession_id: string | null
          ritmo: string | null
          settings: Json
          slug: string
          timezone: string
          trial_ends_at: string | null
          vertical: Database["public"]["Enums"]["vertical_pack"]
          vocab_override: Json
        }
        Insert: {
          address?: Json | null
          cobranca?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          document?: string | null
          id?: string
          inicio?: string | null
          name: string
          onde?: string | null
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          profession_id?: string | null
          ritmo?: string | null
          settings?: Json
          slug: string
          timezone?: string
          trial_ends_at?: string | null
          vertical: Database["public"]["Enums"]["vertical_pack"]
          vocab_override?: Json
        }
        Update: {
          address?: Json | null
          cobranca?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          document?: string | null
          id?: string
          inicio?: string | null
          name?: string
          onde?: string | null
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          profession_id?: string | null
          ritmo?: string | null
          settings?: Json
          slug?: string
          timezone?: string
          trial_ends_at?: string | null
          vertical?: Database["public"]["Enums"]["vertical_pack"]
          vocab_override?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tenants_profession_id_fkey"
            columns: ["profession_id"]
            isOneToOne: false
            referencedRelation: "professions"
            referencedColumns: ["id"]
          },
        ]
      }
      terms_acceptances: {
        Row: {
          aceito_em: string
          documento: string
          id: string
          tenant_id: string
          user_id: string | null
          versao: string
          via: string
        }
        Insert: {
          aceito_em?: string
          documento: string
          id?: string
          tenant_id: string
          user_id?: string | null
          versao: string
          via: string
        }
        Update: {
          aceito_em?: string
          documento?: string
          id?: string
          tenant_id?: string
          user_id?: string | null
          versao?: string
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_acceptances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_items: {
        Row: {
          commission_bps: number
          commission_cents: number
          cost_cents: number
          description: string
          discount_cents: number
          id: string
          material_incerto: boolean
          product_id: string | null
          professional_id: string | null
          qty: number
          service_id: string | null
          tenant_id: string
          ticket_id: string
          total_cents: number
          unit_price_cents: number
        }
        Insert: {
          commission_bps?: number
          commission_cents?: number
          cost_cents?: number
          description: string
          discount_cents?: number
          id?: string
          material_incerto?: boolean
          product_id?: string | null
          professional_id?: string | null
          qty?: number
          service_id?: string | null
          tenant_id: string
          ticket_id: string
          total_cents: number
          unit_price_cents: number
        }
        Update: {
          commission_bps?: number
          commission_cents?: number
          cost_cents?: number
          description?: string
          discount_cents?: number
          id?: string
          material_incerto?: boolean
          product_id?: string | null
          professional_id?: string | null
          qty?: number
          service_id?: string | null
          tenant_id?: string
          ticket_id?: string
          total_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          closed_at: string | null
          commission_cents: number
          created_at: string
          created_by: string | null
          discount_cents: number
          fee_bps: number
          fee_cents: number
          fixed_cost_cents: number
          id: string
          material_cost_cents: number
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          professional_id: string | null
          profit_cents: number
          status: Database["public"]["Enums"]["ticket_status"]
          subtotal_cents: number
          tenant_id: string
          tip_cents: number
          total_cents: number
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          closed_at?: string | null
          commission_cents?: number
          created_at?: string
          created_by?: string | null
          discount_cents?: number
          fee_bps?: number
          fee_cents?: number
          fixed_cost_cents?: number
          id?: string
          material_cost_cents?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          professional_id?: string | null
          profit_cents?: number
          status?: Database["public"]["Enums"]["ticket_status"]
          subtotal_cents?: number
          tenant_id: string
          tip_cents?: number
          total_cents?: number
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          closed_at?: string | null
          commission_cents?: number
          created_at?: string
          created_by?: string | null
          discount_cents?: number
          fee_bps?: number
          fee_cents?: number
          fixed_cost_cents?: number
          id?: string
          material_cost_cents?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          professional_id?: string | null
          profit_cents?: number
          status?: Database["public"]["Enums"]["ticket_status"]
          subtotal_cents?: number
          tenant_id?: string
          tip_cents?: number
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "tickets_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          professional_id: string | null
          reason: string | null
          starts_at: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          starts_at: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          starts_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_access_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          client_id: string
          created_at: string
          id: number
          ip: unknown
          orphaned_at: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          client_id: string
          created_at?: string
          id?: number
          ip?: unknown
          orphaned_at?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          client_id?: string
          created_at?: string
          id?: number
          ip?: unknown
          orphaned_at?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      vertical_packs: {
        Row: {
          accent_color: string | null
          anamnesis: Json
          consent_texts: Json
          consumption: Json
          label: string
          products: Json
          services: Json
          vertical: Database["public"]["Enums"]["vertical_pack"]
        }
        Insert: {
          accent_color?: string | null
          anamnesis: Json
          consent_texts: Json
          consumption: Json
          label: string
          products: Json
          services: Json
          vertical: Database["public"]["Enums"]["vertical_pack"]
        }
        Update: {
          accent_color?: string | null
          anamnesis?: Json
          consent_texts?: Json
          consumption?: Json
          label?: string
          products?: Json
          services?: Json
          vertical?: Database["public"]["Enums"]["vertical_pack"]
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          client_id: string
          created_at: string
          earliest_at: string | null
          fulfilled_at: string | null
          id: string
          latest_at: string | null
          notified_at: string | null
          period_of_day: string | null
          professional_id: string | null
          service_id: string
          tenant_id: string
          weekdays: number[] | null
        }
        Insert: {
          client_id: string
          created_at?: string
          earliest_at?: string | null
          fulfilled_at?: string | null
          id?: string
          latest_at?: string | null
          notified_at?: string | null
          period_of_day?: string | null
          professional_id?: string | null
          service_id: string
          tenant_id: string
          weekdays?: number[] | null
        }
        Update: {
          client_id?: string
          created_at?: string
          earliest_at?: string | null
          fulfilled_at?: string | null
          id?: string
          latest_at?: string | null
          notified_at?: string | null
          period_of_day?: string | null
          professional_id?: string | null
          service_id?: string
          tenant_id?: string
          weekdays?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_entries: {
        Row: {
          amount_cents: number
          client_id: string
          created_at: string
          expires_on: string | null
          id: string
          reason: string
          source_id: string | null
          tenant_id: string
        }
        Insert: {
          amount_cents: number
          client_id: string
          created_at?: string
          expires_on?: string | null
          id?: string
          reason: string
          source_id?: string | null
          tenant_id: string
        }
        Update: {
          amount_cents?: number
          client_id?: string
          created_at?: string
          expires_on?: string | null
          id?: string
          reason?: string
          source_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          event_id: string
          id: number
          payload: Json
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: number
          payload: Json
          processed_at?: string | null
          provider: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: number
          payload?: Json
          processed_at?: string | null
          provider?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_carteira_resumo: {
        Row: {
          com_retorno: number | null
          ltv_total: number | null
          novos_mes: number | null
          tenant_id: string | null
          total: number | null
          visitas_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_client_segments: {
        Row: {
          address: string | null
          anonymized_at: string | null
          birth_date: string | null
          created_at: string | null
          deleted_at: string | null
          document: string | null
          email: string | null
          emergency_contact: string | null
          gender: string | null
          id: string | null
          is_aniversariante: boolean | null
          is_primeira_visita_sem_retorno: boolean | null
          is_ticket_alto: boolean | null
          last_visit_at: string | null
          ltv_cents: number | null
          marketing_opt_in: boolean | null
          name: string | null
          name_busca: string | null
          no_show_count: number | null
          notes: string | null
          online_booking_blocked: boolean | null
          phone_e164: string | null
          phone_hash: string | null
          preferences: Json | null
          preferred_professional_id: string | null
          referred_by: string | null
          source: string | null
          tags: string[] | null
          tenant_id: string | null
          user_id: string | null
          visits_count: number | null
          whatsapp_opt_out: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_preferred_professional_id_fkey"
            columns: ["preferred_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_clientes_a_recuperar: {
        Row: {
          client_id: string | null
          ja_atrasado: boolean | null
          maior_atraso_dias: number | null
          maior_valor_cents: number | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cycles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_daily_cash: {
        Row: {
          commission_cents: number | null
          day: string | null
          fee_cents: number | null
          material_cents: number | null
          profit_cents: number | null
          revenue_cents: number | null
          tenant_id: string | null
          tickets: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_recover_revenue: {
        Row: {
          client_id: string | null
          client_name: string | null
          last_campaign_at: string | null
          last_visit_on: string | null
          late_days: number | null
          personal_cycle_days: number | null
          phone_e164: string | null
          predicted_on: string | null
          profit_at_risk_cents: number | null
          sample_size: number | null
          service_id: string | null
          service_name: string | null
          state: Database["public"]["Enums"]["cycle_state"] | null
          tenant_id: string | null
          value_at_risk_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cycles_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cycles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_profession_pack: {
        Args: { p_profession_id: string; p_tenant: string }
        Returns: undefined
      }
      apply_vertical_pack: {
        Args: {
          p_tenant: string
          p_vertical: Database["public"]["Enums"]["vertical_pack"]
        }
        Returns: undefined
      }
      can_see_appointment: {
        Args: { prof: string; t: string }
        Returns: boolean
      }
      can_see_commission: {
        Args: { prof: string; t: string }
        Returns: boolean
      }
      can_see_ticket: { Args: { prof: string; t: string }; Returns: boolean }
      claim_jobs: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          id: number
          kind: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          payload: Json
          run_after: string
          status: Database["public"]["Enums"]["job_status"]
          tenant_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "job_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      clear_tenant_context: { Args: never; Returns: undefined }
      consumir_rate_limit: {
        Args: { p_janela_segundos: number; p_key: string; p_limite: number }
        Returns: {
          permitido: boolean
          restante: number
        }[]
      }
      debitar_carteira: {
        Args: {
          p_client: string
          p_reason: string
          p_source?: string
          p_tenant: string
          p_valor: number
        }
        Returns: number
      }
      finish_job: {
        Args: {
          p_error?: string
          p_id: number
          p_status: Database["public"]["Enums"]["job_status"]
        }
        Returns: undefined
      }
      fk_sem_indice_report: {
        Args: never
        Returns: {
          colunas: string[]
          constraint_name: string
          tabela: string
        }[]
      }
      has_tenant: { Args: { t: string }; Returns: boolean }
      imutavel_sem_acento: { Args: { texto: string }; Returns: string }
      legal_abrir_intimacao: {
        Args: { p_id: string }
        Returns: {
          destinatarios: Json
          texto: string
        }[]
      }
      legal_apply_corporate_change: { Args: { p: Json }; Returns: string }
      legal_can_access_case: { Args: { p_case: string }; Returns: boolean }
      legal_count_restricted: { Args: { p_tenant: string }; Returns: number }
      legal_intimacao_decidir: { Args: { p: Json }; Returns: Json }
      legal_intimacoes_falha: { Args: { p: Json }; Returns: undefined }
      legal_intimacoes_gravar: { Args: { p: Json }; Returns: Json }
      legal_membros_sem_segundo_fator: {
        Args: { p_dias?: number }
        Returns: {
          sem_fator: number
          tenant_id: string
        }[]
      }
      legal_registrar_abertura_do_caso: {
        Args: { p_case: string }
        Returns: boolean
      }
      legal_registrar_mudanca_de_prazo: {
        Args: {
          p_antes: string
          p_campo: string
          p_deadline: string
          p_depois: string
          p_motivo: string
          p_tenant: string
        }
        Returns: undefined
      }
      legal_sou_da_equipe: {
        Args: { p_case: string; p_tenant: string }
        Returns: boolean
      }
      migracoes_aplicadas: {
        Args: never
        Returns: {
          name: string
        }[]
      }
      my_professional_id: { Args: { t: string }; Returns: string }
      privilegios_report: {
        Args: never
        Returns: {
          anon_qualquer: boolean
          auth_delete: boolean
          auth_truncate: boolean
          politica_de_delete: boolean
          table_name: string
        }[]
      }
      redigir_trilha_do_cliente: {
        Args: { p_client: string; p_tenant: string }
        Returns: Json
      }
      resolver_previsoes_em_lote: {
        Args: { p_atualizacoes: Json; p_tenant_id: string }
        Returns: number
      }
      resumo_central_de_acoes: {
        Args: { p_tenant: string }
        Returns: {
          agendamentos: number
          aniversariantes: number
          clientes: number
          em_risco: number
        }[]
      }
      set_tenant_context: { Args: { t: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      status_do_cron_do_motor: {
        Args: never
        Returns: {
          active: boolean
          jobname: string
          schedule: string
        }[]
      }
      tenant_rls_report: {
        Args: never
        Returns: {
          has_tenant_id: boolean
          policy_count: number
          rls_enabled: boolean
          rls_forced: boolean
          table_name: string
        }[]
      }
      tenant_role: {
        Args: { t: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      appointment_origin:
        | "app"
        | "public_page"
        | "whatsapp"
        | "recurring"
        | "waitlist"
        | "import"
      appointment_status:
        | "pending"
        | "confirmed"
        | "arrived"
        | "done"
        | "no_show"
        | "canceled"
        | "expired"
      comp_model: "commission" | "rent" | "hybrid" | "owner"
      consent_type: "health_data" | "image_use" | "marketing" | "terms"
      cycle_state: "on_track" | "due" | "late" | "at_risk" | "lost"
      job_status: "queued" | "running" | "done" | "failed" | "dead"
      message_channel: "whatsapp" | "sms" | "push" | "email"
      message_kind:
        | "reminder"
        | "confirmation"
        | "cycle"
        | "campaign"
        | "transactional"
        | "review"
      message_status:
        | "queued"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "opted_out"
      payment_kind: "deposit" | "service" | "product" | "club" | "fee"
      payment_method:
        | "pix"
        | "credit"
        | "debit"
        | "cash"
        | "club"
        | "package"
        | "voucher"
        | "other"
      payment_status:
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "expired"
        | "canceled"
      plan_tier: "gratis" | "essencial" | "equipe" | "avancado"
      stock_move_type: "in" | "out" | "adjust" | "loss" | "return"
      ticket_status: "open" | "closed" | "paid" | "canceled" | "refunded"
      user_role: "owner" | "manager" | "professional" | "reception" | "finance"
      vertical_pack:
        | "barber"
        | "nails"
        | "lashes"
        | "brows"
        | "waxing"
        | "aesthetics"
        | "tattoo"
        | "hair"
        | "general"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appointment_origin: [
        "app",
        "public_page",
        "whatsapp",
        "recurring",
        "waitlist",
        "import",
      ],
      appointment_status: [
        "pending",
        "confirmed",
        "arrived",
        "done",
        "no_show",
        "canceled",
        "expired",
      ],
      comp_model: ["commission", "rent", "hybrid", "owner"],
      consent_type: ["health_data", "image_use", "marketing", "terms"],
      cycle_state: ["on_track", "due", "late", "at_risk", "lost"],
      job_status: ["queued", "running", "done", "failed", "dead"],
      message_channel: ["whatsapp", "sms", "push", "email"],
      message_kind: [
        "reminder",
        "confirmation",
        "cycle",
        "campaign",
        "transactional",
        "review",
      ],
      message_status: [
        "queued",
        "sent",
        "delivered",
        "read",
        "failed",
        "opted_out",
      ],
      payment_kind: ["deposit", "service", "product", "club", "fee"],
      payment_method: [
        "pix",
        "credit",
        "debit",
        "cash",
        "club",
        "package",
        "voucher",
        "other",
      ],
      payment_status: [
        "pending",
        "paid",
        "failed",
        "refunded",
        "expired",
        "canceled",
      ],
      plan_tier: ["gratis", "essencial", "equipe", "avancado"],
      stock_move_type: ["in", "out", "adjust", "loss", "return"],
      ticket_status: ["open", "closed", "paid", "canceled", "refunded"],
      user_role: ["owner", "manager", "professional", "reception", "finance"],
      vertical_pack: [
        "barber",
        "nails",
        "lashes",
        "brows",
        "waxing",
        "aesthetics",
        "tattoo",
        "hair",
        "general",
      ],
    },
  },
} as const

