// GENERATED — do not edit by hand. Regenerate with `npm run db:types` (Supabase CLI)
// or scripts/db/gen-types.mjs against a plain-Postgres copy of the schema.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      activity_log: {
        Row: {
          id: number
          wedding_id: string
          actor_id: string | null
          table_name: string
          row_id: string | null
          action: string
          label: string | null
          changed: Json | null
          read_perms: string[]
          at: string
        }
        Insert: {
          id?: number
          wedding_id: string
          actor_id?: string | null
          table_name: string
          row_id?: string | null
          action: string
          label?: string | null
          changed?: Json | null
          read_perms: string[]
          at?: string
        }
        Update: {
          id?: number
          wedding_id?: string
          actor_id?: string | null
          table_name?: string
          row_id?: string | null
          action?: string
          label?: string | null
          changed?: Json | null
          read_perms?: string[]
          at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          id: string
          wedding_id: string
          correspondence_id: string
          storage_path: string
          name: string
          size: number
          mime: string
          uploaded_by: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          correspondence_id: string
          storage_path: string
          name: string
          size?: number
          mime?: string
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          correspondence_id?: string
          storage_path?: string
          name?: string
          size?: number
          mime?: string
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_wedding_id_correspondence_id_fkey"
            columns: ["wedding_id", "correspondence_id"]
            isOneToOne: false
            referencedRelation: "correspondence"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "attachments_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          id: string
          wedding_id: string
          name: string
          sort_order: number
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          name: string
          sort_order?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          name?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_categories_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          id: string
          wedding_id: string
          category_id: string | null
          label: string
          vendor_id: string | null
          estimate_eur: number
          quoted_eur: number | null
          contracted_eur: number | null
          paid_eur: number
          currency: Database["public"]["Enums"]["currency_code"]
          per_guest: boolean
          funded_by: string
          note: string
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          category_id?: string | null
          label: string
          vendor_id?: string | null
          estimate_eur?: number
          quoted_eur?: number | null
          contracted_eur?: number | null
          paid_eur?: number
          currency?: Database["public"]["Enums"]["currency_code"]
          per_guest?: boolean
          funded_by?: string
          note?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          category_id?: string | null
          label?: string
          vendor_id?: string | null
          estimate_eur?: number
          quoted_eur?: number | null
          contracted_eur?: number | null
          paid_eur?: number
          currency?: Database["public"]["Enums"]["currency_code"]
          per_guest?: boolean
          funded_by?: string
          note?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_wedding_id_category_id_fkey"
            columns: ["wedding_id", "category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "budget_lines_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_wedding_id_vendor_id_fkey"
            columns: ["wedding_id", "vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      budget_settings: {
        Row: {
          wedding_id: string
          budget_ceiling_usd: number
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          wedding_id: string
          budget_ceiling_usd?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          wedding_id?: string
          budget_ceiling_usd?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_settings_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_rows: {
        Row: {
          id: string
          wedding_id: string
          household: string
          save_the_date: string | null
          invitation: string | null
          reminder: string | null
          thank_you: string | null
          channel: string
          note: string
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          household: string
          save_the_date?: string | null
          invitation?: string | null
          reminder?: string | null
          thank_you?: string | null
          channel?: string
          note?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          household?: string
          save_the_date?: string | null
          invitation?: string | null
          reminder?: string | null
          thank_you?: string | null
          channel?: string
          note?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comms_rows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comms_rows_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comms_rows_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      correspondence: {
        Row: {
          id: string
          wedding_id: string
          vendor_id: string | null
          date: string
          direction: Database["public"]["Enums"]["comm_direction"]
          channel: string
          subject: string
          summary: string
          follow_up_by: string | null
          done: boolean
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          vendor_id?: string | null
          date?: string
          direction?: Database["public"]["Enums"]["comm_direction"]
          channel?: string
          subject?: string
          summary?: string
          follow_up_by?: string | null
          done?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          vendor_id?: string | null
          date?: string
          direction?: Database["public"]["Enums"]["comm_direction"]
          channel?: string
          subject?: string
          summary?: string
          follow_up_by?: string | null
          done?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "correspondence_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correspondence_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correspondence_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correspondence_wedding_id_vendor_id_fkey"
            columns: ["wedding_id", "vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      decisions: {
        Row: {
          id: string
          wedding_id: string
          title: string
          area: string
          status: Database["public"]["Enums"]["decision_status"]
          decide_by: string | null
          decided_on: string | null
          decided_by: string
          outcome: string
          rationale: string
          alternatives: string[]
          impact: string
          supersedes_id: string | null
          created_on: string
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          title: string
          area?: string
          status?: Database["public"]["Enums"]["decision_status"]
          decide_by?: string | null
          decided_on?: string | null
          decided_by?: string
          outcome?: string
          rationale?: string
          alternatives?: string[]
          impact?: string
          supersedes_id?: string | null
          created_on?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          title?: string
          area?: string
          status?: Database["public"]["Enums"]["decision_status"]
          decide_by?: string | null
          decided_on?: string | null
          decided_by?: string
          outcome?: string
          rationale?: string
          alternatives?: string[]
          impact?: string
          supersedes_id?: string | null
          created_on?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_wedding_id_supersedes_id_fkey"
            columns: ["wedding_id", "supersedes_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      events: {
        Row: {
          id: string
          wedding_id: string
          name: string
          date: string | null
          start_time: string | null
          location: string
          dress: string
          invited_tier: Database["public"]["Enums"]["invited_tier"]
          note: string
          sort_order: number
          is_primary: boolean
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          name: string
          date?: string | null
          start_time?: string | null
          location?: string
          dress?: string
          invited_tier?: Database["public"]["Enums"]["invited_tier"]
          note?: string
          sort_order?: number
          is_primary?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          name?: string
          date?: string | null
          start_time?: string | null
          location?: string
          dress?: string
          invited_tier?: Database["public"]["Enums"]["invited_tier"]
          note?: string
          sort_order?: number
          is_primary?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          id: string
          wedding_id: string
          question: string
          answer: string
          sort_order: number
          published: boolean
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          question: string
          answer?: string
          sort_order?: number
          published?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          question?: string
          answer?: string
          sort_order?: number
          published?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faqs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faqs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faqs_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_contacts: {
        Row: {
          id: string
          wedding_id: string
          guest_id: string
          email: string
          phone: string
          address: string
          country: string
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          guest_id: string
          email?: string
          phone?: string
          address?: string
          country?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          guest_id?: string
          email?: string
          phone?: string
          address?: string
          country?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_contacts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_contacts_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_contacts_wedding_id_guest_id_fkey"
            columns: ["wedding_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      guests: {
        Row: {
          id: string
          wedding_id: string
          household: string
          first_name: string
          last_name: string
          side: Database["public"]["Enums"]["guest_side"]
          tier: Database["public"]["Enums"]["guest_tier"]
          relationship: string
          is_child: boolean
          plus_one_for: string | null
          meal: string
          dietary: string
          room_id: string | null
          table_id: string | null
          arrival: string | null
          departure: string | null
          arrival_flight: string
          departure_flight: string
          needs_shuttle: boolean
          invite_sent: string | null
          notes: string
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          household?: string
          first_name?: string
          last_name?: string
          side?: Database["public"]["Enums"]["guest_side"]
          tier?: Database["public"]["Enums"]["guest_tier"]
          relationship?: string
          is_child?: boolean
          plus_one_for?: string | null
          meal?: string
          dietary?: string
          room_id?: string | null
          table_id?: string | null
          arrival?: string | null
          departure?: string | null
          arrival_flight?: string
          departure_flight?: string
          needs_shuttle?: boolean
          invite_sent?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          household?: string
          first_name?: string
          last_name?: string
          side?: Database["public"]["Enums"]["guest_side"]
          tier?: Database["public"]["Enums"]["guest_tier"]
          relationship?: string
          is_child?: boolean
          plus_one_for?: string | null
          meal?: string
          dietary?: string
          room_id?: string | null
          table_id?: string | null
          arrival?: string | null
          departure?: string | null
          arrival_flight?: string
          departure_flight?: string
          needs_shuttle?: boolean
          invite_sent?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_wedding_id_plus_one_for_fkey"
            columns: ["wedding_id", "plus_one_for"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "guests_wedding_id_room_id_fkey"
            columns: ["wedding_id", "room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "guests_wedding_id_table_id_fkey"
            columns: ["wedding_id", "table_id"]
            isOneToOne: false
            referencedRelation: "seat_tables"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      invitations: {
        Row: {
          id: string
          wedding_id: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          invited_by: string
          token: string
          expires_at: string
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          wedding_id: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          invited_by: string
          token?: string
          expires_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          wedding_id?: string
          email?: string
          role?: Database["public"]["Enums"]["app_role"]
          invited_by?: string
          token?: string
          expires_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_docs: {
        Row: {
          id: string
          wedding_id: string
          country: string
          title: string
          who: string
          issued_by: string
          needs_apostille: boolean
          needs_translation: boolean
          validity_days: number | null
          lead_time: string
          status: Database["public"]["Enums"]["legal_status"]
          obtained_on: string | null
          expires_on: string | null
          note: string
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          country?: string
          title: string
          who?: string
          issued_by?: string
          needs_apostille?: boolean
          needs_translation?: boolean
          validity_days?: number | null
          lead_time?: string
          status?: Database["public"]["Enums"]["legal_status"]
          obtained_on?: string | null
          expires_on?: string | null
          note?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          country?: string
          title?: string
          who?: string
          issued_by?: string
          needs_apostille?: boolean
          needs_translation?: boolean
          validity_days?: number | null
          lead_time?: string
          status?: Database["public"]["Enums"]["legal_status"]
          obtained_on?: string | null
          expires_on?: string | null
          note?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_docs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_docs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_docs_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          id: string
          wedding_id: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["membership_status"]
          invited_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          wedding_id: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          invited_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          wedding_id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          invited_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          id: string
          wedding_id: string
          label: string
          line_id: string | null
          vendor_id: string | null
          amount: number
          currency: Database["public"]["Enums"]["currency_code"]
          due_date: string | null
          paid_date: string | null
          method: string
          note: string
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          label: string
          line_id?: string | null
          vendor_id?: string | null
          amount?: number
          currency?: Database["public"]["Enums"]["currency_code"]
          due_date?: string | null
          paid_date?: string | null
          method?: string
          note?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          label?: string
          line_id?: string | null
          vendor_id?: string | null
          amount?: number
          currency?: Database["public"]["Enums"]["currency_code"]
          due_date?: string | null
          paid_date?: string | null
          method?: string
          note?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_wedding_id_line_id_fkey"
            columns: ["wedding_id", "line_id"]
            isOneToOne: false
            referencedRelation: "budget_lines"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "payments_wedding_id_vendor_id_fkey"
            columns: ["wedding_id", "vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url: string
          last_seen_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string
          avatar_url?: string
          last_seen_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          avatar_url?: string
          last_seen_at?: string | null
          created_at?: string
        }
        Relationships: [
        ]
      }
      role_permissions: {
        Row: {
          role: Database["public"]["Enums"]["app_role"]
          permission: string
        }
        Insert: {
          role: Database["public"]["Enums"]["app_role"]
          permission: string
        }
        Update: {
          role?: Database["public"]["Enums"]["app_role"]
          permission?: string
        }
        Relationships: [
        ]
      }
      rooms: {
        Row: {
          id: string
          wedding_id: string
          property: string
          name: string
          type: string
          beds: number
          nightly_eur: number | null
          nights: number
          held_until: string | null
          assigned_to: string
          status: Database["public"]["Enums"]["room_status"]
          note: string
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          property?: string
          name: string
          type?: string
          beds?: number
          nightly_eur?: number | null
          nights?: number
          held_until?: string | null
          assigned_to?: string
          status?: Database["public"]["Enums"]["room_status"]
          note?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          property?: string
          name?: string
          type?: string
          beds?: number
          nightly_eur?: number | null
          nights?: number
          held_until?: string | null
          assigned_to?: string
          status?: Database["public"]["Enums"]["room_status"]
          note?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      rsvps: {
        Row: {
          id: string
          wedding_id: string
          guest_id: string
          event_id: string
          status: Database["public"]["Enums"]["rsvp_status"]
          responded_at: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          guest_id: string
          event_id: string
          status?: Database["public"]["Enums"]["rsvp_status"]
          responded_at?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          guest_id?: string
          event_id?: string
          status?: Database["public"]["Enums"]["rsvp_status"]
          responded_at?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_wedding_id_event_id_fkey"
            columns: ["wedding_id", "event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "rsvps_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_wedding_id_guest_id_fkey"
            columns: ["wedding_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      schedule_items: {
        Row: {
          id: string
          wedding_id: string
          event_id: string
          time: string | null
          duration_mins: number
          title: string
          detail: string
          owner: string
          vendor_id: string | null
          location: string
          kind: Database["public"]["Enums"]["schedule_kind"]
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          event_id: string
          time?: string | null
          duration_mins?: number
          title: string
          detail?: string
          owner?: string
          vendor_id?: string | null
          location?: string
          kind?: Database["public"]["Enums"]["schedule_kind"]
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          event_id?: string
          time?: string | null
          duration_mins?: number
          title?: string
          detail?: string
          owner?: string
          vendor_id?: string | null
          location?: string
          kind?: Database["public"]["Enums"]["schedule_kind"]
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_wedding_id_event_id_fkey"
            columns: ["wedding_id", "event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "schedule_items_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_wedding_id_vendor_id_fkey"
            columns: ["wedding_id", "vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      seat_tables: {
        Row: {
          id: string
          wedding_id: string
          name: string
          shape: Database["public"]["Enums"]["table_shape"]
          seats: number
          x: number
          y: number
          note: string
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          name: string
          shape?: Database["public"]["Enums"]["table_shape"]
          seats?: number
          x?: number
          y?: number
          note?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          name?: string
          shape?: Database["public"]["Enums"]["table_shape"]
          seats?: number
          x?: number
          y?: number
          note?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seat_tables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_tables_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_tables_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          id: string
          wedding_id: string
          title: string
          phase: string
          offset_days: number
          due_override: string | null
          owner: string
          status: Database["public"]["Enums"]["task_status"]
          category: string
          note: string
          critical: boolean
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          title: string
          phase?: string
          offset_days?: number
          due_override?: string | null
          owner?: string
          status?: Database["public"]["Enums"]["task_status"]
          category?: string
          note?: string
          critical?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          title?: string
          phase?: string
          offset_days?: number
          due_override?: string | null
          owner?: string
          status?: Database["public"]["Enums"]["task_status"]
          category?: string
          note?: string
          critical?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          id: string
          wedding_id: string
          name: string
          audience: Database["public"]["Enums"]["template_audience"]
          channel: string
          subject: string
          body: string
          sort_order: number
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          name: string
          audience?: Database["public"]["Enums"]["template_audience"]
          channel?: string
          subject?: string
          body?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          name?: string
          audience?: Database["public"]["Enums"]["template_audience"]
          channel?: string
          subject?: string
          body?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_finance: {
        Row: {
          id: string
          wedding_id: string
          vendor_id: string
          quote_eur: number | null
          deposit_eur: number | null
          deposit_due: string | null
          balance_due: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          vendor_id: string
          quote_eur?: number | null
          deposit_eur?: number | null
          deposit_due?: string | null
          balance_due?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          vendor_id?: string
          quote_eur?: number | null
          deposit_eur?: number | null
          deposit_due?: string | null
          balance_due?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_finance_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_finance_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_finance_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_finance_wedding_id_vendor_id_fkey"
            columns: ["wedding_id", "vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      vendors: {
        Row: {
          id: string
          wedding_id: string
          name: string
          category: string
          status: Database["public"]["Enums"]["vendor_status"]
          contact: string
          email: string
          phone: string
          country: string
          language: string
          website: string
          cancellation: string
          notes: string
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          name: string
          category?: string
          status?: Database["public"]["Enums"]["vendor_status"]
          contact?: string
          email?: string
          phone?: string
          country?: string
          language?: string
          website?: string
          cancellation?: string
          notes?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          name?: string
          category?: string
          status?: Database["public"]["Enums"]["vendor_status"]
          contact?: string
          email?: string
          phone?: string
          country?: string
          language?: string
          website?: string
          cancellation?: string
          notes?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          id: string
          wedding_id: string
          name: string
          status: Database["public"]["Enums"]["venue_status"]
          country: string
          region: string
          town: string
          url: string
          nearest_airport: string
          airport_mins: number | null
          capacity_seated: number | null
          beds_on_site: number | null
          catering_model: string
          curfew: string
          rain_plan: string
          exclusivity: string
          quote_eur: number | null
          quote_is_estimate: boolean
          hold_expires: string | null
          legal_note: string
          scores: Json
          pros: string[]
          cons: string[]
          notes: string
          visit_date: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          wedding_id: string
          name: string
          status?: Database["public"]["Enums"]["venue_status"]
          country?: string
          region?: string
          town?: string
          url?: string
          nearest_airport?: string
          airport_mins?: number | null
          capacity_seated?: number | null
          beds_on_site?: number | null
          catering_model?: string
          curfew?: string
          rain_plan?: string
          exclusivity?: string
          quote_eur?: number | null
          quote_is_estimate?: boolean
          hold_expires?: string | null
          legal_note?: string
          scores?: Json
          pros?: string[]
          cons?: string[]
          notes?: string
          visit_date?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          wedding_id?: string
          name?: string
          status?: Database["public"]["Enums"]["venue_status"]
          country?: string
          region?: string
          town?: string
          url?: string
          nearest_airport?: string
          airport_mins?: number | null
          capacity_seated?: number | null
          beds_on_site?: number | null
          catering_model?: string
          curfew?: string
          rain_plan?: string
          exclusivity?: string
          quote_eur?: number | null
          quote_is_estimate?: boolean
          hold_expires?: string | null
          legal_note?: string
          scores?: Json
          pros?: string[]
          cons?: string[]
          notes?: string
          visit_date?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_settings: {
        Row: {
          wedding_id: string
          couple_a: string
          couple_b: string
          target_date: string
          date_is_firm: boolean
          fx_eur_usd: number
          fx_set_on: string
          fx_source: Database["public"]["Enums"]["fx_source"]
          guest_target: number
          decide_venue_by: string | null
          rsvp_by: string | null
          website: string
          candidate_countries: string[]
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          wedding_id: string
          couple_a?: string
          couple_b?: string
          target_date?: string
          date_is_firm?: boolean
          fx_eur_usd?: number
          fx_set_on?: string
          fx_source?: Database["public"]["Enums"]["fx_source"]
          guest_target?: number
          decide_venue_by?: string | null
          rsvp_by?: string | null
          website?: string
          candidate_countries?: string[]
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          wedding_id?: string
          couple_a?: string
          couple_b?: string
          target_date?: string
          date_is_firm?: boolean
          fx_eur_usd?: number
          fx_set_on?: string
          fx_source?: Database["public"]["Enums"]["fx_source"]
          guest_target?: number
          decide_venue_by?: string | null
          rsvp_by?: string | null
          website?: string
          candidate_countries?: string[]
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wedding_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_settings_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      weddings: {
        Row: {
          id: string
          name: string
          created_by: string
          created_at: string
          archived_at: string | null
        }
        Insert: {
          id?: string
          name: string
          created_by: string
          created_at?: string
          archived_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_by?: string
          created_at?: string
          archived_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weddings_created_by_fkey"
            columns: ["created_by"]
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
      accept_invitation: {
        Args: {
          p_token: string
        }
        Returns: string
      }
      assistant_take_token: {
        Args: {
          w: string
          p_kind?: string
        }
        Returns: boolean
      }
      create_wedding: {
        Args: {
          p_name: string
          p_target_date?: string
          p_couple_a?: string
          p_couple_b?: string
        }
        Returns: string
      }
      invite_member: {
        Args: {
          w: string
          p_email: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: Database["public"]["Tables"]["invitations"]["Row"]
      }
      my_permissions: {
        Args: {
          w: string
        }
        Returns: string[]
      }
      resend_invitation: {
        Args: {
          p_id: string
        }
        Returns: Database["public"]["Tables"]["invitations"]["Row"]
      }
      revoke_invitation: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      seed_wedding: {
        Args: {
          w: string
        }
        Returns: undefined
      }
      touch_last_seen: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "planner" | "collaborator" | "viewer"
      comm_direction: "sent" | "received"
      currency_code: "EUR" | "USD"
      decision_status: "open" | "decided" | "parked"
      fx_source: "auto" | "manual"
      guest_side: "A" | "B" | "both"
      guest_tier: "A" | "B"
      invited_tier: "A" | "all"
      legal_status: "not_started" | "in_progress" | "obtained" | "expired" | "na"
      membership_status: "active" | "suspended"
      room_status: "held" | "confirmed" | "released"
      rsvp_status: "pending" | "yes" | "no" | "maybe"
      schedule_kind: "moment" | "vendor" | "logistics" | "food" | "music" | "photo"
      table_shape: "round" | "long" | "head"
      task_status: "todo" | "doing" | "done" | "na"
      template_audience: "guest" | "vendor"
      vendor_status: "researching" | "contacted" | "quoted" | "booked" | "deposit_paid" | "complete" | "passed"
      venue_status: "shortlist" | "visiting" | "quoted" | "held" | "booked" | "passed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
