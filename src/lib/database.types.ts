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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          changed: Json | null
          id: number
          label: string | null
          read_perms: string[]
          row_id: string | null
          table_name: string
          wedding_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          changed?: Json | null
          id?: number
          label?: string | null
          read_perms: string[]
          row_id?: string | null
          table_name: string
          wedding_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          changed?: Json | null
          id?: number
          label?: string | null
          read_perms?: string[]
          row_id?: string | null
          table_name?: string
          wedding_id?: string
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
          correspondence_id: string
          created_at: string
          created_by: string | null
          id: string
          mime: string
          name: string
          size: number
          storage_path: string
          updated_at: string
          updated_by: string | null
          uploaded_by: string | null
          wedding_id: string
        }
        Insert: {
          correspondence_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          mime?: string
          name: string
          size?: number
          storage_path: string
          updated_at?: string
          updated_by?: string | null
          uploaded_by?: string | null
          wedding_id: string
        }
        Update: {
          correspondence_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          mime?: string
          name?: string
          size?: number
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
          uploaded_by?: string | null
          wedding_id?: string
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
          created_at: string
          created_by: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
          updated_by: string | null
          wedding_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          wedding_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          wedding_id?: string
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
          category_id: string | null
          contracted_eur: number | null
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          estimate_eur: number
          funded_by: string
          id: string
          label: string
          note: string
          paid_eur: number
          per_guest: boolean
          quoted_eur: number | null
          updated_at: string
          updated_by: string | null
          vendor_id: string | null
          wedding_id: string
        }
        Insert: {
          category_id?: string | null
          contracted_eur?: number | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          estimate_eur?: number
          funded_by?: string
          id?: string
          label: string
          note?: string
          paid_eur?: number
          per_guest?: boolean
          quoted_eur?: number | null
          updated_at?: string
          updated_by?: string | null
          vendor_id?: string | null
          wedding_id: string
        }
        Update: {
          category_id?: string | null
          contracted_eur?: number | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          estimate_eur?: number
          funded_by?: string
          id?: string
          label?: string
          note?: string
          paid_eur?: number
          per_guest?: boolean
          quoted_eur?: number | null
          updated_at?: string
          updated_by?: string | null
          vendor_id?: string | null
          wedding_id?: string
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
          budget_ceiling_usd: number
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
          wedding_id: string
        }
        Insert: {
          budget_ceiling_usd?: number
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
          wedding_id: string
        }
        Update: {
          budget_ceiling_usd?: number
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
          wedding_id?: string
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
            isOneToOne: true
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_categories: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          position: number
          wedding_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          position?: number
          wedding_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          position?: number
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_categories_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          archived_at: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          position: number
          topic: string
          wedding_id: string
        }
        Insert: {
          archived_at?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          position?: number
          topic?: string
          wedding_id: string
        }
        Update: {
          archived_at?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          position?: number
          topic?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channels_wedding_id_category_id_fkey"
            columns: ["wedding_id", "category_id"]
            isOneToOne: false
            referencedRelation: "chat_categories"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "chat_channels_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          author_id: string | null
          body: string
          channel_id: string
          created_at: string
          edited_at: string | null
          id: string
          mentions: string[]
          parent_id: string | null
          pinned: boolean
          wedding_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          channel_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[]
          parent_id?: string | null
          pinned?: boolean
          wedding_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          channel_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[]
          parent_id?: string | null
          pinned?: boolean
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_wedding_id_channel_id_fkey"
            columns: ["wedding_id", "channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "chat_messages_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_wedding_id_parent_id_fkey"
            columns: ["wedding_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      chat_reads: {
        Row: {
          channel_id: string
          last_read_at: string
          user_id: string
          wedding_id: string
        }
        Insert: {
          channel_id: string
          last_read_at?: string
          user_id?: string
          wedding_id: string
        }
        Update: {
          channel_id?: string
          last_read_at?: string
          user_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reads_wedding_id_channel_id_fkey"
            columns: ["wedding_id", "channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["wedding_id", "id"]
          },
          {
            foreignKeyName: "chat_reads_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          anchor: Json
          anchor_label: string
          author_id: string | null
          body: string
          created_at: string
          edited_at: string | null
          id: string
          mentions: string[]
          page: string
          parent_id: string | null
          read_perms: string[]
          resolved_at: string | null
          resolved_by: string | null
          wedding_id: string
        }
        Insert: {
          anchor?: Json
          anchor_label?: string
          author_id?: string | null
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[]
          page: string
          parent_id?: string | null
          read_perms?: string[]
          resolved_at?: string | null
          resolved_by?: string | null
          wedding_id: string
        }
        Update: {
          anchor?: Json
          anchor_label?: string
          author_id?: string | null
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[]
          page?: string
          parent_id?: string | null
          read_perms?: string[]
          resolved_at?: string | null
          resolved_by?: string | null
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_wedding_id_parent_id_fkey"
            columns: ["wedding_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["wedding_id", "id"]
          },
        ]
      }
      comms_rows: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          household: string
          id: string
          invitation: string | null
          note: string
          reminder: string | null
          save_the_date: string | null
          thank_you: string | null
          updated_at: string
          updated_by: string | null
          wedding_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by?: string | null
          household: string
          id?: string
          invitation?: string | null
          note?: string
          reminder?: string | null
          save_the_date?: string | null
          thank_you?: string | null
          updated_at?: string
          updated_by?: string | null
          wedding_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          household?: string
          id?: string
          invitation?: string | null
          note?: string
          reminder?: string | null
          save_the_date?: string | null
          thank_you?: string | null
          updated_at?: string
          updated_by?: string | null
          wedding_id?: string
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
          channel: string
          created_at: string
          created_by: string | null
          date: string
          direction: Database["public"]["Enums"]["comm_direction"]
          done: boolean
          follow_up_by: string | null
          id: string
          subject: string
          summary: string
          updated_at: string
          updated_by: string | null
          vendor_id: string | null
          wedding_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by?: string | null
          date?: string
          direction?: Database["public"]["Enums"]["comm_direction"]
          done?: boolean
          follow_up_by?: string | null
          id?: string
          subject?: string
          summary?: string
          updated_at?: string
          updated_by?: string | null
          vendor_id?: string | null
          wedding_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          date?: string
          direction?: Database["public"]["Enums"]["comm_direction"]
          done?: boolean
          follow_up_by?: string | null
          id?: string
          subject?: string
          summary?: string
          updated_at?: string
          updated_by?: string | null
          vendor_id?: string | null
          wedding_id?: string
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
          alternatives: string[]
          area: string
          created_at: string
          created_by: string | null
          created_on: string
          decide_by: string | null
          decided_by: string
          decided_on: string | null
          id: string
          impact: string
          outcome: string
          rationale: string
          status: Database["public"]["Enums"]["decision_status"]
          supersedes_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
          wedding_id: string
        }
        Insert: {
          alternatives?: string[]
          area?: string
          created_at?: string
          created_by?: string | null
          created_on?: string
          decide_by?: string | null
          decided_by?: string
          decided_on?: string | null
          id?: string
          impact?: string
          outcome?: string
          rationale?: string
          status?: Database["public"]["Enums"]["decision_status"]
          supersedes_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          wedding_id: string
        }
        Update: {
          alternatives?: string[]
          area?: string
          created_at?: string
          created_by?: string | null
          created_on?: string
          decide_by?: string | null
          decided_by?: string
          decided_on?: string | null
          id?: string
          impact?: string
          outcome?: string
          rationale?: string
          status?: Database["public"]["Enums"]["decision_status"]
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          wedding_id?: string
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
          created_at: string
          created_by: string | null
          date: string | null
          dress: string
          id: string
          invited_tier: Database["public"]["Enums"]["invited_tier"]
          is_primary: boolean
          location: string
          name: string
          note: string
          sort_order: number
          start_time: string | null
          updated_at: string
          updated_by: string | null
          wedding_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string | null
          dress?: string
          id?: string
          invited_tier?: Database["public"]["Enums"]["invited_tier"]
          is_primary?: boolean
          location?: string
          name: string
          note?: string
          sort_order?: number
          start_time?: string | null
          updated_at?: string
          updated_by?: string | null
          wedding_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string | null
          dress?: string
          id?: string
          invited_tier?: Database["public"]["Enums"]["invited_tier"]
          is_primary?: boolean
          location?: string
          name?: string
          note?: string
          sort_order?: number
          start_time?: string | null
          updated_at?: string
          updated_by?: string | null
          wedding_id?: string
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
          answer: string
          created_at: string
          created_by: string | null
          id: string
          published: boolean
          question: string
          sort_order: number
          updated_at: string
          updated_by: string | null
          wedding_id: string
        }
        Insert: {
          answer?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          question: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          wedding_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          wedding_id?: string
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
          address: string
          country: string
          created_at: string
          created_by: string | null
          email: string
          guest_id: string
          id: string
          phone: string
          updated_at: string
          updated_by: string | null
          wedding_id: string
        }
        Insert: {
          address?: string
          country?: string
          created_at?: string
          created_by?: string | null
          email?: string
          guest_id: string
          id?: string
          phone?: string
          updated_at?: string
          updated_by?: string | null
          wedding_id: string
        }
        Update: {
          address?: string
          country?: string
          created_at?: string
          created_by?: string | null
          email?: string
          guest_id?: string
          id?: string
          phone?: string
          updated_at?: string
          updated_by?: string | null
          wedding_id?: string
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
          arrival: string | null
          arrival_flight: string
          created_at: string
          created_by: string | null
          departure: string | null
          departure_flight: string
          dietary: string
          first_name: string
          household: string
          id: string
          invite_sent: string | null
          is_child: boolean
          last_name: string
          meal: string
          needs_shuttle: boolean
          notes: string
          plus_one_for: string | null
          relationship: string
          room_id: string | null
          side: Database["public"]["Enums"]["guest_side"]
          table_id: string | null
          tier: Database["public"]["Enums"]["guest_tier"]
          updated_at: string
          updated_by: string | null
          wedding_id: string
        }
        Insert: {
          arrival?: string | null
          arrival_flight?: string
          created_at?: string
          created_by?: string | null
          departure?: string | null
          departure_flight?: string
          dietary?: string
          first_name?: string
          household?: string
          id?: string
          invite_sent?: string | null
          is_child?: boolean
          last_name?: string
          meal?: string
          needs_shuttle?: boolean
          notes?: string
          plus_one_for?: string | null
          relationship?: string
          room_id?: string | null
          side?: Database["public"]["Enums"]["guest_side"]
          table_id?: string | null
          tier?: Database["public"]["Enums"]["guest_tier"]
          updated_at?: string
          updated_by?: string | null
          wedding_id: string
        }
        Update: {
          arrival?: string | null
          arrival_flight?: string
          created_at?: string
          created_by?: string | null
          departure?: string | null
          departure_flight?: string
          dietary?: string
          first_name?: string
          household?: string
          id?: string
          invite_sent?: string | null
          is_child?: boolean
          last_name?: string
          meal?: string
          needs_shuttle?: boolean
          notes?: string
          plus_one_for?: string | null
          relationship?: string
          room_id?: string | null
          side?: Database["public"]["Enums"]["guest_side"]
          table_id?: string | null
          tier?: Database["public"]["Enums"]["guest_tier"]
          updated_at?: string
          updated_by?: string | null
          wedding_id?: string
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
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
          wedding_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          token?: string
          wedding_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          wedding_id?: string
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
          country: string
          created_at: string
          created_by: string | null
          expires_on: string | null
          id: string
          issued_by: string
          lead_time: string
          needs_apostille: boolean
          needs_translation: boolean
          note: string
          obtained_on: string | null
          status: Database["public"]["Enums"]["legal_status"]
          title: string
          updated_at: string
          updated_by: string | null
          validity_days: number | null
          wedding_id: string
          who: string
        }
        Insert: {
          country?: string
          created_at?: string
          created_by?: string | null
          expires_on?: string | null
          id?: string
          issued_by?: string
          lead_time?: string
          needs_apostille?: boolean
          needs_translation?: boolean
          note?: string
          obtained_on?: string | null
          status?: Database["public"]["Enums"]["legal_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
          validity_days?: number | null
          wedding_id: string
          who?: string
        }
        Update: {
          country?: string
          created_at?: string
          created_by?: string | null
          expires_on?: string | null
          id?: string
          issued_by?: string
          lead_time?: string
          needs_apostille?: boolean
          needs_translation?: boolean
          note?: string
          obtained_on?: string | null
          status?: Database["public"]["Enums"]["legal_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
          validity_days?: number | null
          wedding_id?: string
          who?: string
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
          created_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id?: string
          wedding_id?: string
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
      mentions: {
        Row: {
          author_id: string | null
          channel_id: string | null
          comment_id: string | null
          created_at: string
          emailed_at: string | null
          excerpt: string
          id: string
          message_id: string | null
          page: string | null
          read_at: string | null
          user_id: string
          wedding_id: string
        }
        Insert: {
          author_id?: string | null
          channel_id?: string | null
          comment_id?: string | null
          created_at?: string
          emailed_at?: string | null
          excerpt?: string
          id?: string
          message_id?: string | null
          page?: string | null
          read_at?: string | null
          user_id: string
          wedding_id: string
        }
        Update: {
          author_id?: string | null
          channel_id?: string | null
          comment_id?: string | null
          created_at?: string
          emailed_at?: string | null
          excerpt?: string
          id?: string
          message_id?: string | null
          page?: string | null
          read_at?: string | null
          user_id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          due_date: string | null
          id: string
          label: string
          line_id: string | null
          method: string
          note: string
          paid_date: string | null
          updated_at: string
          updated_by: string | null
          vendor_id: string | null
          wedding_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          due_date?: string | null
          id?: string
          label: string
          line_id?: string | null
          method?: string
          note?: string
          paid_date?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor_id?: string | null
          wedding_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          due_date?: string | null
          id?: string
          label?: string
          line_id?: string | null
          method?: string
          note?: string
          paid_date?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor_id?: string | null
          wedding_id?: string
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
          avatar_url: string
          created_at: string
          email: string
          full_name: string
          id: string
          last_seen_at: string | null
        }
        Insert: {
          avatar_url?: string
          created_at?: string
          email: string
          full_name?: string
          id: string
          last_seen_at?: string | null
        }
        Update: {
          avatar_url?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          last_seen_at?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      rooms: {
        Row: {
          assigned_to: string
          beds: number
          created_at: string
          created_by: string | null
          held_until: string | null
          id: string
          name: string
          nightly_eur: number | null
          nights: number
          note: string
          property: string
          status: Database["public"]["Enums"]["room_status"]
          type: string
          updated_at: string
          updated_by: string | null
          wedding_id: string
        }
        Insert: {
          assigned_to?: string
          beds?: number
          created_at?: string
          created_by?: string | null
          held_until?: string | null
          id?: string
          name: string
          nightly_eur?: number | null
          nights?: number
          note?: string
          property?: string
          status?: Database["public"]["Enums"]["room_status"]
          type?: string
          updated_at?: string
          updated_by?: string | null
          wedding_id: string
        }
        Update: {
          assigned_to?: string
          beds?: number
          created_at?: string
          created_by?: string | null
          held_until?: string | null
          id?: string
          name?: string
          nightly_eur?: number | null
          nights?: number
          note?: string
          property?: string
          status?: Database["public"]["Enums"]["room_status"]
          type?: string
          updated_at?: string
          updated_by?: string | null
          wedding_id?: string
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
          created_at: string
          created_by: string | null
          event_id: string
          guest_id: string
          id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["rsvp_status"]
          updated_at: string
          updated_by: string | null
          wedding_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          guest_id: string
          id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
          updated_by?: string | null
          wedding_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          guest_id?: string
          id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
          updated_by?: string | null
          wedding_id?: string
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
          created_at: string
          created_by: string | null
          detail: string
          duration_mins: number
          event_id: string
          id: string
          kind: Database["public"]["Enums"]["schedule_kind"]
          location: string
          owner: string
          time: string | null
          title: string
          updated_at: string
          updated_by: string | null
          vendor_id: string | null
          wedding_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          detail?: string
          duration_mins?: number
          event_id: string
          id?: string
          kind?: Database["public"]["Enums"]["schedule_kind"]
          location?: string
          owner?: string
          time?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          vendor_id?: string | null
          wedding_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          detail?: string
          duration_mins?: number
          event_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["schedule_kind"]
          location?: string
          owner?: string
          time?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          vendor_id?: string | null
          wedding_id?: string
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
          created_at: string
          created_by: string | null
          id: string
          name: string
          note: string
          seats: number
          shape: Database["public"]["Enums"]["table_shape"]
          updated_at: string
          updated_by: string | null
          wedding_id: string
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          note?: string
          seats?: number
          shape?: Database["public"]["Enums"]["table_shape"]
          updated_at?: string
          updated_by?: string | null
          wedding_id: string
          x?: number
          y?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          note?: string
          seats?: number
          shape?: Database["public"]["Enums"]["table_shape"]
          updated_at?: string
          updated_by?: string | null
          wedding_id?: string
          x?: number
          y?: number
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
          category: string
          created_at: string
          created_by: string | null
          critical: boolean
          due_override: string | null
          id: string
          note: string
          offset_days: number
          owner: string
          phase: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          updated_by: string | null
          wedding_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          critical?: boolean
          due_override?: string | null
          id?: string
          note?: string
          offset_days?: number
          owner?: string
          phase?: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
          wedding_id: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          critical?: boolean
          due_override?: string | null
          id?: string
          note?: string
          offset_days?: number
          owner?: string
          phase?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
          wedding_id?: string
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
          audience: Database["public"]["Enums"]["template_audience"]
          body: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          sort_order: number
          subject: string
          updated_at: string
          updated_by: string | null
          wedding_id: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["template_audience"]
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          sort_order?: number
          subject?: string
          updated_at?: string
          updated_by?: string | null
          wedding_id: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["template_audience"]
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          sort_order?: number
          subject?: string
          updated_at?: string
          updated_by?: string | null
          wedding_id?: string
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
          balance_due: string | null
          created_at: string
          created_by: string | null
          deposit_due: string | null
          deposit_eur: number | null
          id: string
          quote_eur: number | null
          updated_at: string
          updated_by: string | null
          vendor_id: string
          wedding_id: string
        }
        Insert: {
          balance_due?: string | null
          created_at?: string
          created_by?: string | null
          deposit_due?: string | null
          deposit_eur?: number | null
          id?: string
          quote_eur?: number | null
          updated_at?: string
          updated_by?: string | null
          vendor_id: string
          wedding_id: string
        }
        Update: {
          balance_due?: string | null
          created_at?: string
          created_by?: string | null
          deposit_due?: string | null
          deposit_eur?: number | null
          id?: string
          quote_eur?: number | null
          updated_at?: string
          updated_by?: string | null
          vendor_id?: string
          wedding_id?: string
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
          cancellation: string
          category: string
          contact: string
          country: string
          created_at: string
          created_by: string | null
          email: string
          id: string
          language: string
          name: string
          notes: string
          phone: string
          status: Database["public"]["Enums"]["vendor_status"]
          updated_at: string
          updated_by: string | null
          website: string
          wedding_id: string
        }
        Insert: {
          cancellation?: string
          category?: string
          contact?: string
          country?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          language?: string
          name: string
          notes?: string
          phone?: string
          status?: Database["public"]["Enums"]["vendor_status"]
          updated_at?: string
          updated_by?: string | null
          website?: string
          wedding_id: string
        }
        Update: {
          cancellation?: string
          category?: string
          contact?: string
          country?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          language?: string
          name?: string
          notes?: string
          phone?: string
          status?: Database["public"]["Enums"]["vendor_status"]
          updated_at?: string
          updated_by?: string | null
          website?: string
          wedding_id?: string
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
          airport_mins: number | null
          beds_on_site: number | null
          capacity_seated: number | null
          catering_model: string
          cons: string[]
          country: string
          created_at: string
          created_by: string | null
          curfew: string
          exclusivity: string
          hold_expires: string | null
          id: string
          legal_note: string
          name: string
          nearest_airport: string
          notes: string
          pros: string[]
          quote_eur: number | null
          quote_is_estimate: boolean
          rain_plan: string
          region: string
          scores: Json
          status: Database["public"]["Enums"]["venue_status"]
          town: string
          updated_at: string
          updated_by: string | null
          url: string
          visit_date: string | null
          wedding_id: string
        }
        Insert: {
          airport_mins?: number | null
          beds_on_site?: number | null
          capacity_seated?: number | null
          catering_model?: string
          cons?: string[]
          country?: string
          created_at?: string
          created_by?: string | null
          curfew?: string
          exclusivity?: string
          hold_expires?: string | null
          id?: string
          legal_note?: string
          name: string
          nearest_airport?: string
          notes?: string
          pros?: string[]
          quote_eur?: number | null
          quote_is_estimate?: boolean
          rain_plan?: string
          region?: string
          scores?: Json
          status?: Database["public"]["Enums"]["venue_status"]
          town?: string
          updated_at?: string
          updated_by?: string | null
          url?: string
          visit_date?: string | null
          wedding_id: string
        }
        Update: {
          airport_mins?: number | null
          beds_on_site?: number | null
          capacity_seated?: number | null
          catering_model?: string
          cons?: string[]
          country?: string
          created_at?: string
          created_by?: string | null
          curfew?: string
          exclusivity?: string
          hold_expires?: string | null
          id?: string
          legal_note?: string
          name?: string
          nearest_airport?: string
          notes?: string
          pros?: string[]
          quote_eur?: number | null
          quote_is_estimate?: boolean
          rain_plan?: string
          region?: string
          scores?: Json
          status?: Database["public"]["Enums"]["venue_status"]
          town?: string
          updated_at?: string
          updated_by?: string | null
          url?: string
          visit_date?: string | null
          wedding_id?: string
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
      wedding_role_permissions: {
        Row: {
          granted: boolean
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
          wedding_id: string
        }
        Insert: {
          granted: boolean
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
          wedding_id: string
        }
        Update: {
          granted?: boolean
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_role_permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_role_permissions_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_settings: {
        Row: {
          candidate_countries: string[]
          couple_a: string
          couple_b: string
          created_at: string
          created_by: string | null
          date_is_firm: boolean
          decide_venue_by: string | null
          fx_eur_usd: number
          fx_set_on: string
          fx_source: Database["public"]["Enums"]["fx_source"]
          guest_target: number
          rsvp_by: string | null
          target_date: string
          updated_at: string
          updated_by: string | null
          website: string
          wedding_id: string
        }
        Insert: {
          candidate_countries?: string[]
          couple_a?: string
          couple_b?: string
          created_at?: string
          created_by?: string | null
          date_is_firm?: boolean
          decide_venue_by?: string | null
          fx_eur_usd?: number
          fx_set_on?: string
          fx_source?: Database["public"]["Enums"]["fx_source"]
          guest_target?: number
          rsvp_by?: string | null
          target_date?: string
          updated_at?: string
          updated_by?: string | null
          website?: string
          wedding_id: string
        }
        Update: {
          candidate_countries?: string[]
          couple_a?: string
          couple_b?: string
          created_at?: string
          created_by?: string | null
          date_is_firm?: boolean
          decide_venue_by?: string | null
          fx_eur_usd?: number
          fx_set_on?: string
          fx_source?: Database["public"]["Enums"]["fx_source"]
          guest_target?: number
          rsvp_by?: string | null
          target_date?: string
          updated_at?: string
          updated_by?: string | null
          website?: string
          wedding_id?: string
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
            isOneToOne: true
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      weddings: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
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
      accept_invitation: { Args: { p_token: string }; Returns: string }
      assistant_take_token: {
        Args: { p_kind?: string; w: string }
        Returns: boolean
      }
      claim_storage_purge: { Args: { p_limit?: number }; Returns: string[] }
      create_wedding: {
        Args: {
          p_couple_a?: string
          p_couple_b?: string
          p_name: string
          p_target_date?: string
        }
        Returns: string
      }
      invite_member: {
        Args: {
          p_email: string
          p_role: Database["public"]["Enums"]["app_role"]
          w: string
        }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
          wedding_id: string
        }
        SetofOptions: {
          from: "*"
          to: "invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_permissions: { Args: { w: string }; Returns: string[] }
      resend_invitation: {
        Args: { p_id: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
          wedding_id: string
        }
        SetofOptions: {
          from: "*"
          to: "invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_invitation: { Args: { p_id: string }; Returns: undefined }
      seed_wedding: { Args: { w: string }; Returns: undefined }
      set_role_permissions: {
        Args: { changes: Json; w: string }
        Returns: undefined
      }
      touch_last_seen: { Args: never; Returns: undefined }
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
      legal_status:
        | "not_started"
        | "in_progress"
        | "obtained"
        | "expired"
        | "na"
      membership_status: "active" | "suspended"
      room_status: "held" | "confirmed" | "released"
      rsvp_status: "pending" | "yes" | "no" | "maybe"
      schedule_kind:
        | "moment"
        | "vendor"
        | "logistics"
        | "food"
        | "music"
        | "photo"
      table_shape: "round" | "long" | "head"
      task_status: "todo" | "doing" | "done" | "na"
      template_audience: "guest" | "vendor"
      vendor_status:
        | "researching"
        | "contacted"
        | "quoted"
        | "booked"
        | "deposit_paid"
        | "complete"
        | "passed"
      venue_status:
        | "shortlist"
        | "visiting"
        | "quoted"
        | "held"
        | "booked"
        | "passed"
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
      app_role: ["owner", "planner", "collaborator", "viewer"],
      comm_direction: ["sent", "received"],
      currency_code: ["EUR", "USD"],
      decision_status: ["open", "decided", "parked"],
      fx_source: ["auto", "manual"],
      guest_side: ["A", "B", "both"],
      guest_tier: ["A", "B"],
      invited_tier: ["A", "all"],
      legal_status: ["not_started", "in_progress", "obtained", "expired", "na"],
      membership_status: ["active", "suspended"],
      room_status: ["held", "confirmed", "released"],
      rsvp_status: ["pending", "yes", "no", "maybe"],
      schedule_kind: [
        "moment",
        "vendor",
        "logistics",
        "food",
        "music",
        "photo",
      ],
      table_shape: ["round", "long", "head"],
      task_status: ["todo", "doing", "done", "na"],
      template_audience: ["guest", "vendor"],
      vendor_status: [
        "researching",
        "contacted",
        "quoted",
        "booked",
        "deposit_paid",
        "complete",
        "passed",
      ],
      venue_status: [
        "shortlist",
        "visiting",
        "quoted",
        "held",
        "booked",
        "passed",
      ],
    },
  },
} as const
