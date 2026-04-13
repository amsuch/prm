export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          user_id: string;
          first_name: string;
          last_name: string | null;
          company: string | null;
          job_title: string | null;
          department: string | null;
          birthday: string | null;
          notes: string | null;
          avatar_url: string | null;
          source: string | null;
          source_id: string | null;
          custom_fields: Json;
          is_archived: boolean;
          last_contacted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          first_name: string;
          last_name?: string | null;
          company?: string | null;
          job_title?: string | null;
          department?: string | null;
          birthday?: string | null;
          notes?: string | null;
          avatar_url?: string | null;
          source?: string | null;
          source_id?: string | null;
          custom_fields?: Json;
          is_archived?: boolean;
          last_contacted_at?: string | null;
        };
        Update: {
          first_name?: string;
          last_name?: string | null;
          company?: string | null;
          job_title?: string | null;
          department?: string | null;
          birthday?: string | null;
          notes?: string | null;
          avatar_url?: string | null;
          source?: string | null;
          source_id?: string | null;
          custom_fields?: Json;
          is_archived?: boolean;
          last_contacted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_emails: {
        Row: {
          id: string;
          contact_id: string;
          label: string;
          email: string;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          label?: string;
          email: string;
          is_primary?: boolean;
        };
        Update: {
          label?: string;
          email?: string;
          is_primary?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "contact_emails_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_phones: {
        Row: {
          id: string;
          contact_id: string;
          label: string;
          phone: string;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          label?: string;
          phone: string;
          is_primary?: boolean;
        };
        Update: {
          label?: string;
          phone?: string;
          is_primary?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "contact_phones_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_urls: {
        Row: {
          id: string;
          contact_id: string;
          label: string;
          url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          label?: string;
          url: string;
        };
        Update: {
          label?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_urls_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string | null;
        };
        Update: {
          name?: string;
          color?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_tags: {
        Row: {
          contact_id: string;
          tag_id: string;
        };
        Insert: {
          contact_id: string;
          tag_id: string;
        };
        Update: {
          contact_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      relationship_types: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          reverse_name: string | null;
          category: string;
          is_symmetric: boolean;
          is_system: boolean;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          reverse_name?: string | null;
          category?: string;
          is_symmetric?: boolean;
          is_system?: boolean;
        };
        Update: {
          name?: string;
          reverse_name?: string | null;
          category?: string;
          is_symmetric?: boolean;
        };
        Relationships: [];
      };
      contact_relationships: {
        Row: {
          id: string;
          contact_a_id: string;
          contact_b_id: string;
          relationship_type_id: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_a_id: string;
          contact_b_id: string;
          relationship_type_id: string;
          notes?: string | null;
        };
        Update: {
          notes?: string | null;
          relationship_type_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_relationships_contact_a_id_fkey";
            columns: ["contact_a_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_relationships_contact_b_id_fkey";
            columns: ["contact_b_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_relationships_relationship_type_id_fkey";
            columns: ["relationship_type_id"];
            isOneToOne: false;
            referencedRelation: "relationship_types";
            referencedColumns: ["id"];
          },
        ];
      };
      interactions: {
        Row: {
          id: string;
          user_id: string;
          contact_id: string;
          type: string;
          direction: string | null;
          title: string | null;
          body: string | null;
          occurred_at: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          contact_id: string;
          type?: string;
          direction?: string | null;
          title?: string | null;
          body?: string | null;
          occurred_at?: string;
          metadata?: Json;
        };
        Update: {
          type?: string;
          direction?: string | null;
          title?: string | null;
          body?: string | null;
          occurred_at?: string;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "interactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interactions_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      custom_field_definitions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          field_key: string;
          field_type: string;
          options: Json | null;
          is_required: boolean;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          field_key: string;
          field_type: string;
          options?: Json | null;
          is_required?: boolean;
          display_order?: number;
        };
        Update: {
          name?: string;
          field_key?: string;
          field_type?: string;
          options?: Json | null;
          is_required?: boolean;
          display_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reminders: {
        Row: {
          id: string;
          user_id: string;
          contact_id: string | null;
          title: string;
          remind_at: string;
          recurrence: string;
          is_completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          contact_id?: string | null;
          title: string;
          remind_at: string;
          recurrence?: string;
          is_completed?: boolean;
        };
        Update: {
          title?: string;
          remind_at?: string;
          recurrence?: string;
          is_completed?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "reminders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      entities: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          category: string | null;
          address: string | null;
          phone: string | null;
          website: string | null;
          notes: string | null;
          avatar_url: string | null;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          category?: string | null;
          address?: string | null;
          phone?: string | null;
          website?: string | null;
          notes?: string | null;
          avatar_url?: string | null;
          is_archived?: boolean;
        };
        Update: {
          name?: string;
          category?: string | null;
          address?: string | null;
          phone?: string | null;
          website?: string | null;
          notes?: string | null;
          avatar_url?: string | null;
          is_archived?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "entities_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_emails: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          label: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          label?: string;
        };
        Update: {
          email?: string;
          label?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_emails_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_sync_state: {
        Row: {
          user_id: string;
          last_sync_at: string | null;
          sync_token: string | null;
          is_connected: boolean;
          provider_token: string | null;
          provider_refresh_token: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          last_sync_at?: string | null;
          sync_token?: string | null;
          is_connected?: boolean;
          provider_token?: string | null;
          provider_refresh_token?: string | null;
        };
        Update: {
          last_sync_at?: string | null;
          sync_token?: string | null;
          is_connected?: boolean;
          provider_token?: string | null;
          provider_refresh_token?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_sync_state_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_suggestions: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          display_name: string | null;
          event_title: string | null;
          event_date: string | null;
          status: string;
          created_contact_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          display_name?: string | null;
          event_title?: string | null;
          event_date?: string | null;
          status?: string;
          created_contact_id?: string | null;
        };
        Update: {
          email?: string;
          display_name?: string | null;
          event_title?: string | null;
          event_date?: string | null;
          status?: string;
          created_contact_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_suggestions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_suggestions_created_contact_id_fkey";
            columns: ["created_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
        };
        Update: {
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          role: string;
          content: string;
          response_json: Json | null;
          tool_progress_json: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: string;
          content: string;
          response_json?: Json | null;
          tool_progress_json?: Json | null;
        };
        Update: {
          content?: string;
          response_json?: Json | null;
          tool_progress_json?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "chat_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      entity_categories: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          icon: string;
          color: string;
          is_system: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          icon?: string;
          color?: string;
          is_system?: boolean;
        };
        Update: {
          name?: string;
          icon?: string;
          color?: string;
        };
        Relationships: [];
      };
      entity_people: {
        Row: {
          id: string;
          entity_id: string;
          user_id: string;
          first_name: string;
          last_name: string | null;
          role: string | null;
          notes: string | null;
          promoted_contact_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          user_id: string;
          first_name: string;
          last_name?: string | null;
          role?: string | null;
          notes?: string | null;
          promoted_contact_id?: string | null;
        };
        Update: {
          first_name?: string;
          last_name?: string | null;
          role?: string | null;
          notes?: string | null;
          promoted_contact_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "entity_people_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_people_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_people_promoted_contact_id_fkey";
            columns: ["promoted_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_contacts: {
        Args: { search_query: string; p_user_id: string };
        Returns: {
          id: string;
          first_name: string;
          last_name: string | null;
          company: string | null;
          job_title: string | null;
          email: string | null;
          phone: string | null;
          avatar_url: string | null;
          source: string | null;
          last_contacted_at: string | null;
          custom_fields: Json;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
          rank: number;
        }[];
      };
      get_contact_relationships: {
        Args: { p_contact_id: string };
        Returns: {
          relationship_id: string;
          related_contact_id: string;
          related_first_name: string;
          related_last_name: string | null;
          related_company: string | null;
          related_avatar_url: string | null;
          relationship_name: string;
          relationship_category: string;
          notes: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
