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
          campaign_id: string | null
          channel: Database["public"]["Enums"]["message_channel"]
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
          campaign_id?: string | null
          channel: Database["public"]["Enums"]["message_channel"]
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
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
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
          comp_model: Database["public"]["Enums"]["comp_model"]
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
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
          comp_model?: Database["public"]["Enums"]["comp_model"]
          created_at?: string
          deleted_at?: string | null
          display_name: string
          id?: string
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
          comp_model?: Database["public"]["Enums"]["comp_model"]
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          id?: string
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
          tenant_id: string
        }
        Insert: {
          active?: boolean
          bookable_online?: boolean
          buffer_after_min?: number
          buffer_before_min?: number
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
          tenant_id: string
        }
        Update: {
          active?: boolean
          bookable_online?: boolean
          buffer_after_min?: number
          buffer_before_min?: number
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
      ticket_items: {
        Row: {
          commission_bps: number
          commission_cents: number
          cost_cents: number
          description: string
          discount_cents: number
          id: string
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
          fee_cents: number
          id: string
          material_cost_cents: number
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
          fee_cents?: number
          id?: string
          material_cost_cents?: number
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
          fee_cents?: number
          id?: string
          material_cost_cents?: number
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
            foreignKeyName: "client_cycles_tenant_id_fkey"
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
          late_days: number | null
          phone_e164: string | null
          predicted_on: string | null
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
      migracoes_aplicadas: {
        Args: never
        Returns: {
          name: string
        }[]
      }
      my_professional_id: { Args: { t: string }; Returns: string }
      redigir_trilha_do_cliente: {
        Args: { p_client: string; p_tenant: string }
        Returns: Json
      }
      set_tenant_context: { Args: { t: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      tenant_rls_report: {
        Args: never
        Returns: {
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
