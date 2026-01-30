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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_member_permissions: {
        Row: {
          can_manage_labels_macros: boolean
          can_send: boolean
          can_transfer: boolean
          created_at: string
          id: string
          member_id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          can_manage_labels_macros?: boolean
          can_send?: boolean
          can_transfer?: boolean
          created_at?: string
          id?: string
          member_id: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          can_manage_labels_macros?: boolean
          can_send?: boolean
          can_transfer?: boolean
          created_at?: string
          id?: string
          member_id?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      account_members: {
        Row: {
          created_at: string
          id: string
          member_email: string | null
          member_id: string
          member_name: string | null
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_email?: string | null
          member_id: string
          member_name?: string | null
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_email?: string | null
          member_id?: string
          member_name?: string | null
          owner_id?: string
        }
        Relationships: []
      }
      agent_status: {
        Row: {
          auto_offline: boolean | null
          created_at: string
          id: string
          last_seen_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_offline?: boolean | null
          created_at?: string
          id?: string
          last_seen_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_offline?: boolean | null
          created_at?: string
          id?: string
          last_seen_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_agent_preferences: {
        Row: {
          auto_start_ai: boolean
          created_at: string
          default_agent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_start_ai?: boolean
          created_at?: string
          default_agent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_start_ai?: boolean
          created_at?: string
          default_agent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_agent_transfer_rules: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          source_agent_id: string
          target_agent_id: string
          transfer_message: string | null
          trigger_keywords: string[]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          source_agent_id: string
          target_agent_id: string
          transfer_message?: string | null
          trigger_keywords?: string[]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          source_agent_id?: string
          target_agent_id?: string
          transfer_message?: string | null
          trigger_keywords?: string[]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_transfer_rules_source_agent_id_fkey"
            columns: ["source_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_transfer_rules_target_agent_id_fkey"
            columns: ["target_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          agent_type: string | null
          ai_model: string | null
          anti_hallucination_enabled: boolean | null
          buffer_max_messages: number | null
          buffer_wait_seconds: number | null
          color: string | null
          consultation_context: string | null
          created_at: string | null
          created_by: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_chat_enabled: boolean | null
          is_whatsapp_enabled: boolean | null
          max_chars_per_message: number | null
          max_lines_per_message: number | null
          memory_auto_extract: boolean | null
          memory_enabled: boolean | null
          memory_generate_summary: boolean | null
          memory_max_items: number | null
          memory_sync_clients: boolean | null
          message_buffer_enabled: boolean | null
          name: string
          response_delay_max: number | null
          response_delay_min: number | null
          specialization: string | null
          split_delay_max: number | null
          split_delay_min: number | null
          split_mode: string | null
          system_prompt: string | null
          typing_simulation: boolean | null
          updated_at: string | null
          use_canned_responses: boolean | null
          use_native_ai: boolean | null
          webhook_url: string | null
        }
        Insert: {
          agent_type?: string | null
          ai_model?: string | null
          anti_hallucination_enabled?: boolean | null
          buffer_max_messages?: number | null
          buffer_wait_seconds?: number | null
          color?: string | null
          consultation_context?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_chat_enabled?: boolean | null
          is_whatsapp_enabled?: boolean | null
          max_chars_per_message?: number | null
          max_lines_per_message?: number | null
          memory_auto_extract?: boolean | null
          memory_enabled?: boolean | null
          memory_generate_summary?: boolean | null
          memory_max_items?: number | null
          memory_sync_clients?: boolean | null
          message_buffer_enabled?: boolean | null
          name: string
          response_delay_max?: number | null
          response_delay_min?: number | null
          specialization?: string | null
          split_delay_max?: number | null
          split_delay_min?: number | null
          split_mode?: string | null
          system_prompt?: string | null
          typing_simulation?: boolean | null
          updated_at?: string | null
          use_canned_responses?: boolean | null
          use_native_ai?: boolean | null
          webhook_url?: string | null
        }
        Update: {
          agent_type?: string | null
          ai_model?: string | null
          anti_hallucination_enabled?: boolean | null
          buffer_max_messages?: number | null
          buffer_wait_seconds?: number | null
          color?: string | null
          consultation_context?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_chat_enabled?: boolean | null
          is_whatsapp_enabled?: boolean | null
          max_chars_per_message?: number | null
          max_lines_per_message?: number | null
          memory_auto_extract?: boolean | null
          memory_enabled?: boolean | null
          memory_generate_summary?: boolean | null
          memory_max_items?: number | null
          memory_sync_clients?: boolean | null
          message_buffer_enabled?: boolean | null
          name?: string
          response_delay_max?: number | null
          response_delay_min?: number | null
          specialization?: string | null
          split_delay_max?: number | null
          split_delay_min?: number | null
          split_mode?: string | null
          system_prompt?: string | null
          typing_simulation?: boolean | null
          updated_at?: string | null
          use_canned_responses?: boolean | null
          use_native_ai?: boolean | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      ai_chat_messages: {
        Row: {
          agent_id: string
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          rating: string | null
          role: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          rating?: string | null
          role: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          rating?: string | null
          role?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_client_memories: {
        Row: {
          agent_id: string | null
          ai_summary: string | null
          app_name: string | null
          client_name: string | null
          created_at: string | null
          custom_memories: Json | null
          device: string | null
          expiration_date: string | null
          id: string
          is_vip: boolean | null
          last_interaction_at: string | null
          nickname: string | null
          phone: string
          plan_name: string | null
          plan_price: number | null
          purchase_date: string | null
          sentiment: string | null
          total_interactions: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          ai_summary?: string | null
          app_name?: string | null
          client_name?: string | null
          created_at?: string | null
          custom_memories?: Json | null
          device?: string | null
          expiration_date?: string | null
          id?: string
          is_vip?: boolean | null
          last_interaction_at?: string | null
          nickname?: string | null
          phone: string
          plan_name?: string | null
          plan_price?: number | null
          purchase_date?: string | null
          sentiment?: string | null
          total_interactions?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string | null
          ai_summary?: string | null
          app_name?: string | null
          client_name?: string | null
          created_at?: string | null
          custom_memories?: Json | null
          device?: string | null
          expiration_date?: string | null
          id?: string
          is_vip?: boolean | null
          last_interaction_at?: string | null
          nickname?: string | null
          phone?: string
          plan_name?: string | null
          plan_price?: number | null
          purchase_date?: string | null
          sentiment?: string | null
          total_interactions?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_client_memories_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_message_buffer: {
        Row: {
          agent_id: string | null
          conversation_id: string
          created_at: string | null
          first_message_at: string | null
          id: string
          instance_id: string
          last_message_at: string | null
          messages: Json | null
          phone: string
          scheduled_response_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          conversation_id: string
          created_at?: string | null
          first_message_at?: string | null
          id?: string
          instance_id: string
          last_message_at?: string | null
          messages?: Json | null
          phone: string
          scheduled_response_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string | null
          conversation_id?: string
          created_at?: string | null
          first_message_at?: string | null
          id?: string
          instance_id?: string
          last_message_at?: string | null
          messages?: Json | null
          phone?: string
          scheduled_response_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_message_buffer_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_message_buffer_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sub_agent_links: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          principal_agent_id: string
          priority: number
          sub_agent_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          principal_agent_id: string
          priority?: number
          sub_agent_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          principal_agent_id?: string
          priority?: number
          sub_agent_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_sub_agent_links_principal_agent_id_fkey"
            columns: ["principal_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_sub_agent_links_sub_agent_id_fkey"
            columns: ["sub_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_at: string
          blocked_by: string
          created_at: string
          id: string
          reason: string | null
          unblocked_at: string | null
          user_id: string
        }
        Insert: {
          blocked_at?: string
          blocked_by: string
          created_at?: string
          id?: string
          reason?: string | null
          unblocked_at?: string | null
          user_id: string
        }
        Update: {
          blocked_at?: string
          blocked_by?: string
          created_at?: string
          id?: string
          reason?: string | null
          unblocked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bot_proxy_config: {
        Row: {
          block_bot_payment: boolean | null
          bot_phone: string
          created_at: string
          id: string
          instance_id: string | null
          is_active: boolean | null
          mercado_pago_plan_id: string | null
          owner_payment_info: string | null
          payment_keywords: string[] | null
          trigger_label_id: string | null
          updated_at: string
          use_mercado_pago: boolean | null
          user_id: string
        }
        Insert: {
          block_bot_payment?: boolean | null
          bot_phone: string
          created_at?: string
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          mercado_pago_plan_id?: string | null
          owner_payment_info?: string | null
          payment_keywords?: string[] | null
          trigger_label_id?: string | null
          updated_at?: string
          use_mercado_pago?: boolean | null
          user_id: string
        }
        Update: {
          block_bot_payment?: boolean | null
          bot_phone?: string
          created_at?: string
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          mercado_pago_plan_id?: string | null
          owner_payment_info?: string | null
          payment_keywords?: string[] | null
          trigger_label_id?: string | null
          updated_at?: string
          use_mercado_pago?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_proxy_config_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_proxy_config_mercado_pago_plan_id_fkey"
            columns: ["mercado_pago_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_proxy_config_trigger_label_id_fkey"
            columns: ["trigger_label_id"]
            isOneToOne: false
            referencedRelation: "inbox_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_proxy_plans: {
        Row: {
          config_id: string
          created_at: string | null
          duration_days: number
          id: string
          is_active: boolean | null
          name: string
          option_number: number
          price: number
          updated_at: string | null
        }
        Insert: {
          config_id: string
          created_at?: string | null
          duration_days: number
          id?: string
          is_active?: boolean | null
          name: string
          option_number: number
          price: number
          updated_at?: string | null
        }
        Update: {
          config_id?: string
          created_at?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean | null
          name?: string
          option_number?: number
          price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_proxy_plans_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "bot_proxy_config"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_proxy_replacements: {
        Row: {
          config_id: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          replace_text: string
          search_text: string
          updated_at: string
        }
        Insert: {
          config_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          replace_text: string
          search_text: string
          updated_at?: string
        }
        Update: {
          config_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          replace_text?: string
          search_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_proxy_replacements_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "bot_proxy_config"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_proxy_sessions: {
        Row: {
          bot_conversation_id: string | null
          client_conversation_id: string | null
          client_phone: string
          config_id: string
          created_at: string
          id: string
          is_active: boolean | null
          last_activity_at: string
        }
        Insert: {
          bot_conversation_id?: string | null
          client_conversation_id?: string | null
          client_phone: string
          config_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_activity_at?: string
        }
        Update: {
          bot_conversation_id?: string | null
          client_conversation_id?: string | null
          client_phone?: string
          config_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_activity_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_proxy_sessions_bot_conversation_id_fkey"
            columns: ["bot_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_proxy_sessions_client_conversation_id_fkey"
            columns: ["client_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_proxy_sessions_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "bot_proxy_config"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_dispatch_history: {
        Row: {
          completed_at: string | null
          config_id: string | null
          created_at: string | null
          dispatch_type: string
          failed_count: number | null
          id: string
          message_content: string | null
          started_at: string | null
          status: string | null
          success_count: number | null
          target_type: string
          total_recipients: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          config_id?: string | null
          created_at?: string | null
          dispatch_type?: string
          failed_count?: number | null
          id?: string
          message_content?: string | null
          started_at?: string | null
          status?: string | null
          success_count?: number | null
          target_type?: string
          total_recipients?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          config_id?: string | null
          created_at?: string | null
          dispatch_type?: string
          failed_count?: number | null
          id?: string
          message_content?: string | null
          started_at?: string | null
          status?: string | null
          success_count?: number | null
          target_type?: string
          total_recipients?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_dispatch_history_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "dispatch_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_contacts: {
        Row: {
          campaign_id: string
          created_at: string | null
          error_message: string | null
          id: string
          name: string | null
          phone: string
          sent_at: string | null
          status: string
          variables: Json | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          name?: string | null
          phone: string
          sent_at?: string | null
          status?: string
          variables?: Json | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          name?: string | null
          phone?: string
          sent_at?: string | null
          status?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_logs: {
        Row: {
          campaign_id: string
          contact_id: string | null
          created_at: string | null
          event_type: string
          id: string
          message: string | null
          metadata: Json | null
        }
        Insert: {
          campaign_id: string
          contact_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json | null
        }
        Update: {
          campaign_id?: string
          contact_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "campaign_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          completed_at: string | null
          created_at: string | null
          failed_count: number | null
          id: string
          instance_id: string
          max_delay_seconds: number | null
          message_template: string
          min_delay_seconds: number | null
          name: string
          pause_after_messages: number | null
          pause_duration_seconds: number | null
          progress: number | null
          scheduled_at: string | null
          sent_count: number | null
          started_at: string | null
          status: string
          total_contacts: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          failed_count?: number | null
          id?: string
          instance_id: string
          max_delay_seconds?: number | null
          message_template: string
          min_delay_seconds?: number | null
          name: string
          pause_after_messages?: number | null
          pause_duration_seconds?: number | null
          progress?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          total_contacts?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          failed_count?: number | null
          id?: string
          instance_id?: string
          max_delay_seconds?: number | null
          message_template?: string
          min_delay_seconds?: number | null
          name?: string
          pause_after_messages?: number | null
          pause_duration_seconds?: number | null
          progress?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          total_contacts?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      canned_responses: {
        Row: {
          content: string
          created_at: string
          id: string
          is_global: boolean | null
          media_name: string | null
          media_type: string | null
          media_url: string | null
          short_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_global?: boolean | null
          media_name?: string | null
          media_type?: string | null
          media_url?: string | null
          short_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_global?: boolean | null
          media_name?: string | null
          media_type?: string | null
          media_url?: string | null
          short_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_inbox_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          is_private: boolean | null
          is_read: boolean | null
          media_type: string | null
          media_url: string | null
          metadata: Json | null
          sender_id: string | null
          sender_type: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_private?: boolean | null
          is_read?: boolean | null
          media_type?: string | null
          media_url?: string | null
          metadata?: Json | null
          sender_id?: string | null
          sender_type: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_private?: boolean | null
          is_read?: boolean | null
          media_type?: string | null
          media_url?: string | null
          metadata?: Json | null
          sender_id?: string | null
          sender_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_inbox_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_pix_payments: {
        Row: {
          amount: number
          client_id: string | null
          client_phone: string
          conversation_id: string | null
          created_at: string
          description: string | null
          duration_days: number | null
          expected_plan: string | null
          expected_plan_label: string | null
          expires_at: string | null
          external_id: string | null
          id: string
          instance_id: string | null
          paid_at: string | null
          pix_code: string | null
          pix_qr_code: string | null
          plan_id: string | null
          plan_name: string
          renewal_applied_at: string | null
          renewal_error: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          client_phone: string
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number | null
          expected_plan?: string | null
          expected_plan_label?: string | null
          expires_at?: string | null
          external_id?: string | null
          id?: string
          instance_id?: string | null
          paid_at?: string | null
          pix_code?: string | null
          pix_qr_code?: string | null
          plan_id?: string | null
          plan_name: string
          renewal_applied_at?: string | null
          renewal_error?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          client_phone?: string
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number | null
          expected_plan?: string | null
          expected_plan_label?: string | null
          expires_at?: string | null
          external_id?: string | null
          id?: string
          instance_id?: string | null
          paid_at?: string | null
          pix_code?: string | null
          pix_qr_code?: string | null
          plan_id?: string | null
          plan_name?: string
          renewal_applied_at?: string | null
          renewal_error?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_pix_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pix_payments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pix_payments_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pix_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "bot_proxy_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tag_assignments: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          tag_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          tag_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tag_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "client_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tags: {
        Row: {
          color: string
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          app_name: string | null
          created_at: string | null
          device: string | null
          email: string
          expires_at: string
          id: string
          name: string
          notes: string | null
          plan: string
          price: number | null
          service: string | null
          service_password: string | null
          service_username: string | null
          updated_at: string | null
          user_id: string
          whatsapp: string
        }
        Insert: {
          app_name?: string | null
          created_at?: string | null
          device?: string | null
          email: string
          expires_at: string
          id?: string
          name: string
          notes?: string | null
          plan: string
          price?: number | null
          service?: string | null
          service_password?: string | null
          service_username?: string | null
          updated_at?: string | null
          user_id: string
          whatsapp: string
        }
        Update: {
          app_name?: string | null
          created_at?: string | null
          device?: string | null
          email?: string
          expires_at?: string
          id?: string
          name?: string
          notes?: string | null
          plan?: string
          price?: number | null
          service?: string | null
          service_password?: string | null
          service_username?: string | null
          updated_at?: string | null
          user_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      conversation_labels: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          label_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          label_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_labels_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "inbox_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          active_agent_id: string | null
          ai_enabled: boolean | null
          ai_paused_at: string | null
          assigned_to: string | null
          contact_avatar: string | null
          contact_name: string | null
          country_code: string | null
          created_at: string
          first_reply_at: string | null
          id: string
          instance_id: string
          last_message_at: string | null
          last_message_preview: string | null
          metadata: Json
          phone: string
          priority: string | null
          resolved_at: string | null
          snoozed_until: string | null
          status: string
          transfer_reason: string | null
          transferred_from_agent_id: string | null
          unread_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_agent_id?: string | null
          ai_enabled?: boolean | null
          ai_paused_at?: string | null
          assigned_to?: string | null
          contact_avatar?: string | null
          contact_name?: string | null
          country_code?: string | null
          created_at?: string
          first_reply_at?: string | null
          id?: string
          instance_id: string
          last_message_at?: string | null
          last_message_preview?: string | null
          metadata?: Json
          phone: string
          priority?: string | null
          resolved_at?: string | null
          snoozed_until?: string | null
          status?: string
          transfer_reason?: string | null
          transferred_from_agent_id?: string | null
          unread_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_agent_id?: string | null
          ai_enabled?: boolean | null
          ai_paused_at?: string | null
          assigned_to?: string | null
          contact_avatar?: string | null
          contact_name?: string | null
          country_code?: string | null
          created_at?: string
          first_reply_at?: string | null
          id?: string
          instance_id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          metadata?: Json
          phone?: string
          priority?: string | null
          resolved_at?: string | null
          snoozed_until?: string | null
          status?: string
          transfer_reason?: string | null
          transferred_from_agent_id?: string | null
          unread_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_active_agent_id_fkey"
            columns: ["active_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_transferred_from_agent_id_fkey"
            columns: ["transferred_from_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_fields_config: {
        Row: {
          created_at: string | null
          display_order: number | null
          field_key: string
          field_name: string
          field_options: Json | null
          field_type: string | null
          id: string
          instance_id: string | null
          is_active: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          field_key: string
          field_name: string
          field_options?: Json | null
          field_type?: string | null
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          field_key?: string
          field_name?: string
          field_options?: Json | null
          field_type?: string | null
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      crm_lead_data: {
        Row: {
          closed_at: string | null
          conversation_id: string | null
          created_at: string | null
          custom_fields: Json | null
          deal_value: number | null
          id: string
          instance_id: string | null
          is_ticket_open: boolean | null
          lead_email: string | null
          lead_full_name: string | null
          lead_kanban_order: number | null
          lead_name: string | null
          lead_notes: string | null
          lead_personal_id: string | null
          lead_status: string | null
          lost_reason: string | null
          phone: string
          synced_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          conversation_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          deal_value?: number | null
          id?: string
          instance_id?: string | null
          is_ticket_open?: boolean | null
          lead_email?: string | null
          lead_full_name?: string | null
          lead_kanban_order?: number | null
          lead_name?: string | null
          lead_notes?: string | null
          lead_personal_id?: string | null
          lead_status?: string | null
          lost_reason?: string | null
          phone: string
          synced_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          closed_at?: string | null
          conversation_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          deal_value?: number | null
          id?: string
          instance_id?: string | null
          is_ticket_open?: boolean | null
          lead_email?: string | null
          lead_full_name?: string | null
          lead_kanban_order?: number | null
          lead_name?: string | null
          lead_notes?: string | null
          lead_personal_id?: string | null
          lead_status?: string | null
          lost_reason?: string | null
          phone?: string
          synced_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dispatch_configs: {
        Row: {
          ai_personalization: boolean | null
          allowed_days: number[] | null
          attention_call: boolean | null
          auto_archive: boolean | null
          balancing_mode: string | null
          business_hours_enabled: boolean | null
          business_hours_end: string | null
          business_hours_start: string | null
          created_at: string | null
          id: string
          instance_ids: string[]
          max_delay_seconds: number | null
          messages: Json
          min_delay_seconds: number | null
          name: string
          pause_after_messages: number | null
          pause_duration_minutes: number | null
          randomize_order: boolean | null
          smart_delay: boolean | null
          stop_after_messages: number | null
          updated_at: string | null
          user_id: string
          verify_numbers: boolean | null
        }
        Insert: {
          ai_personalization?: boolean | null
          allowed_days?: number[] | null
          attention_call?: boolean | null
          auto_archive?: boolean | null
          balancing_mode?: string | null
          business_hours_enabled?: boolean | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          created_at?: string | null
          id?: string
          instance_ids?: string[]
          max_delay_seconds?: number | null
          messages?: Json
          min_delay_seconds?: number | null
          name: string
          pause_after_messages?: number | null
          pause_duration_minutes?: number | null
          randomize_order?: boolean | null
          smart_delay?: boolean | null
          stop_after_messages?: number | null
          updated_at?: string | null
          user_id: string
          verify_numbers?: boolean | null
        }
        Update: {
          ai_personalization?: boolean | null
          allowed_days?: number[] | null
          attention_call?: boolean | null
          auto_archive?: boolean | null
          balancing_mode?: string | null
          business_hours_enabled?: boolean | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          created_at?: string | null
          id?: string
          instance_ids?: string[]
          max_delay_seconds?: number | null
          messages?: Json
          min_delay_seconds?: number | null
          name?: string
          pause_after_messages?: number | null
          pause_duration_minutes?: number | null
          randomize_order?: boolean | null
          smart_delay?: boolean | null
          stop_after_messages?: number | null
          updated_at?: string | null
          user_id?: string
          verify_numbers?: boolean | null
        }
        Relationships: []
      }
      email_verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          ip_address: string
          verified_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          ip_address: string
          verified_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          ip_address?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      inbox_audit_logs: {
        Row: {
          action: string
          auditable_id: string | null
          auditable_type: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          auditable_id?: string | null
          auditable_type?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          auditable_id?: string | null
          auditable_type?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      inbox_automation_rules: {
        Row: {
          actions: Json
          conditions: Json | null
          created_at: string
          description: string | null
          event_type: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actions?: Json
          conditions?: Json | null
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actions?: Json
          conditions?: Json | null
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inbox_labels: {
        Row: {
          color: string
          color_code: number | null
          created_at: string
          description: string | null
          id: string
          instance_id: string | null
          name: string
          updated_at: string
          user_id: string
          whatsapp_label_id: string | null
        }
        Insert: {
          color?: string
          color_code?: number | null
          created_at?: string
          description?: string | null
          id?: string
          instance_id?: string | null
          name: string
          updated_at?: string
          user_id: string
          whatsapp_label_id?: string | null
        }
        Update: {
          color?: string
          color_code?: number | null
          created_at?: string
          description?: string | null
          id?: string
          instance_id?: string | null
          name?: string
          updated_at?: string
          user_id?: string
          whatsapp_label_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_labels_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_macros: {
        Row: {
          actions: Json
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
          visibility: string | null
        }
        Insert: {
          actions?: Json
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
          visibility?: string | null
        }
        Update: {
          actions?: Json
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
          visibility?: string | null
        }
        Relationships: []
      }
      inbox_scheduled_message_logs: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: string
          scheduled_message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          scheduled_message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          scheduled_message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_scheduled_message_logs_scheduled_message_id_fkey"
            columns: ["scheduled_message_id"]
            isOneToOne: false
            referencedRelation: "inbox_scheduled_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_scheduled_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          instance_id: string | null
          last_error: string | null
          phone: string
          send_at: string
          sent_at: string | null
          status: string
          template_key: string
          template_vars: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          instance_id?: string | null
          last_error?: string | null
          phone: string
          send_at: string
          sent_at?: string | null
          status?: string
          template_key: string
          template_vars?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          instance_id?: string | null
          last_error?: string | null
          phone?: string
          send_at?: string
          sent_at?: string | null
          status?: string
          template_key?: string
          template_vars?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inbox_team_members: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          team_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          team_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "inbox_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_teams: {
        Row: {
          auto_assign: boolean | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_assign?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_assign?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          content: string
          created_at: string | null
          id: string
          subject: string | null
          template_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          subject?: string | null
          template_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          subject?: string | null
          template_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_history: {
        Row: {
          client_id: string | null
          created_at: string | null
          days_until_expiration: number | null
          id: string
          notification_type: string
          status: string | null
          subject: string | null
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          days_until_expiration?: number | null
          id?: string
          notification_type: string
          status?: string | null
          subject?: string | null
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          days_until_expiration?: number | null
          id?: string
          notification_type?: string
          status?: string | null
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          auto_send_enabled: boolean | null
          created_at: string | null
          email_reminders_enabled: boolean | null
          id: string
          reminder_days: number[] | null
          reminder_messages: Json | null
          updated_at: string | null
          user_id: string
          whatsapp_reminders_enabled: boolean | null
        }
        Insert: {
          auto_send_enabled?: boolean | null
          created_at?: string | null
          email_reminders_enabled?: boolean | null
          id?: string
          reminder_days?: number[] | null
          reminder_messages?: Json | null
          updated_at?: string | null
          user_id: string
          whatsapp_reminders_enabled?: boolean | null
        }
        Update: {
          auto_send_enabled?: boolean | null
          created_at?: string | null
          email_reminders_enabled?: boolean | null
          id?: string
          reminder_days?: number[] | null
          reminder_messages?: Json | null
          updated_at?: string | null
          user_id?: string
          whatsapp_reminders_enabled?: boolean | null
        }
        Relationships: []
      }
      owner_notification_log: {
        Row: {
          contact_name: string | null
          contact_phone: string | null
          conversation_id: string | null
          created_at: string | null
          event_type: string
          id: string
          sent_at: string | null
          summary: string | null
          urgency: string | null
          user_id: string
        }
        Insert: {
          contact_name?: string | null
          contact_phone?: string | null
          conversation_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          sent_at?: string | null
          summary?: string | null
          urgency?: string | null
          user_id: string
        }
        Update: {
          contact_name?: string | null
          contact_phone?: string | null
          conversation_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          sent_at?: string | null
          summary?: string | null
          urgency?: string | null
          user_id?: string
        }
        Relationships: []
      }
      owner_notification_settings: {
        Row: {
          created_at: string | null
          id: string
          long_wait_minutes: number | null
          min_interval_minutes: number | null
          notification_instance_id: string | null
          notification_phone: string | null
          notify_on_ai_uncertainty: boolean | null
          notify_on_complaint: boolean | null
          notify_on_long_wait: boolean | null
          notify_on_new_contact: boolean | null
          notify_on_payment_proof: boolean | null
          notify_on_vip_message: boolean | null
          notify_via_whatsapp: boolean | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          long_wait_minutes?: number | null
          min_interval_minutes?: number | null
          notification_instance_id?: string | null
          notification_phone?: string | null
          notify_on_ai_uncertainty?: boolean | null
          notify_on_complaint?: boolean | null
          notify_on_long_wait?: boolean | null
          notify_on_new_contact?: boolean | null
          notify_on_payment_proof?: boolean | null
          notify_on_vip_message?: boolean | null
          notify_via_whatsapp?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          long_wait_minutes?: number | null
          min_interval_minutes?: number | null
          notification_instance_id?: string | null
          notification_phone?: string | null
          notify_on_ai_uncertainty?: boolean | null
          notify_on_complaint?: boolean | null
          notify_on_long_wait?: boolean | null
          notify_on_new_contact?: boolean | null
          notify_on_payment_proof?: boolean | null
          notify_on_vip_message?: boolean | null
          notify_via_whatsapp?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      plan_settings: {
        Row: {
          created_at: string | null
          id: string
          plan_key: string
          plan_name: string
          plan_price: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          plan_key: string
          plan_name: string
          plan_price: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          plan_key?: string
          plan_name?: string
          plan_price?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          id: number
          markup_locked: boolean
          markup_percent: number
          updated_at: string
        }
        Insert: {
          id: number
          markup_locked?: boolean
          markup_percent?: number
          updated_at?: string
        }
        Update: {
          id?: number
          markup_locked?: boolean
          markup_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          updated_at: string | null
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      registration_ips: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          user_id?: string | null
        }
        Relationships: []
      }
      renewal_history: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          new_expires_at: string
          plan: string
          previous_expires_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          new_expires_at: string
          plan: string
          previous_expires_at: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          new_expires_at?: string
          plan?: string
          previous_expires_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewal_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_goals: {
        Row: {
          client_goal: number | null
          created_at: string | null
          id: string
          period: string | null
          revenue_goal: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client_goal?: number | null
          created_at?: string | null
          id?: string
          period?: string | null
          revenue_goal?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          client_goal?: number | null
          created_at?: string | null
          id?: string
          period?: string | null
          revenue_goal?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          message_content: string
          message_type: string
          scheduled_at: string
          status: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          message_content: string
          message_type: string
          scheduled_at: string
          status?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          message_content?: string
          message_type?: string
          scheduled_at?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_contacts: {
        Row: {
          created_at: string | null
          dispatch_history_id: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          original_contact_id: string | null
          phone: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dispatch_history_id?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          original_contact_id?: string | null
          phone: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dispatch_history_id?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          original_contact_id?: string | null
          phone?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      smm_orders: {
        Row: {
          cancelled_at: string | null
          created_at: string
          credits_spent: number
          error_message: string | null
          id: string
          last_synced_at: string | null
          link: string
          markup_percent: number
          meta: Json
          price_brl: number
          profit_brl: number
          profit_real_brl: number | null
          provider_charge: number | null
          provider_cost_brl: number
          provider_currency: string | null
          provider_order_id: string | null
          provider_rate_per_1000: number | null
          provider_refill_id: string | null
          provider_refill_status: string | null
          provider_remains: number | null
          provider_start_count: number | null
          provider_status: string | null
          quantity: number
          requested_refill_at: string | null
          service_id: number
          service_name: string | null
          status: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          credits_spent: number
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          link: string
          markup_percent: number
          meta?: Json
          price_brl: number
          profit_brl: number
          profit_real_brl?: number | null
          provider_charge?: number | null
          provider_cost_brl: number
          provider_currency?: string | null
          provider_order_id?: string | null
          provider_rate_per_1000?: number | null
          provider_refill_id?: string | null
          provider_refill_status?: string | null
          provider_remains?: number | null
          provider_start_count?: number | null
          provider_status?: string | null
          quantity: number
          requested_refill_at?: string | null
          service_id: number
          service_name?: string | null
          status?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          credits_spent?: number
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          link?: string
          markup_percent?: number
          meta?: Json
          price_brl?: number
          profit_brl?: number
          profit_real_brl?: number | null
          provider_charge?: number | null
          provider_cost_brl?: number
          provider_currency?: string | null
          provider_order_id?: string | null
          provider_rate_per_1000?: number | null
          provider_refill_id?: string | null
          provider_refill_status?: string | null
          provider_remains?: number | null
          provider_start_count?: number | null
          provider_status?: string | null
          quantity?: number
          requested_refill_at?: string | null
          service_id?: number
          service_name?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      status_schedules: {
        Row: {
          background_color: number | null
          created_at: string | null
          error_message: string | null
          fail_count: number | null
          font_style: number | null
          id: string
          instance_ids: string[]
          media_mimetype: string | null
          media_url: string | null
          recurrence_days: number[] | null
          recurrence_end_date: string | null
          recurrence_type: string | null
          scheduled_at: string
          sent_at: string | null
          status: string | null
          status_type: string
          success_count: number | null
          text_content: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          background_color?: number | null
          created_at?: string | null
          error_message?: string | null
          fail_count?: number | null
          font_style?: number | null
          id?: string
          instance_ids: string[]
          media_mimetype?: string | null
          media_url?: string | null
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string | null
          status_type: string
          success_count?: number | null
          text_content?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          background_color?: number | null
          created_at?: string | null
          error_message?: string | null
          fail_count?: number | null
          font_style?: number | null
          id?: string
          instance_ids?: string[]
          media_mimetype?: string | null
          media_url?: string | null
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string | null
          status_type?: string
          success_count?: number | null
          text_content?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscription_notification_settings: {
        Row: {
          created_at: string
          id: string
          reminder_messages: Json | null
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean | null
        }
        Insert: {
          created_at?: string
          id?: string
          reminder_messages?: Json | null
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean | null
        }
        Update: {
          created_at?: string
          id?: string
          reminder_messages?: Json | null
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean | null
        }
        Relationships: []
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          external_id: string | null
          id: string
          paid_at: string | null
          payment_method: string
          pix_code: string | null
          pix_qr_code: string | null
          plan_id: string
          status: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string | null
          external_id?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string
          pix_code?: string | null
          pix_qr_code?: string | null
          plan_id: string
          status?: string
          subscription_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          external_id?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string
          pix_code?: string | null
          pix_qr_code?: string | null
          plan_id?: string
          status?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          discount_percentage: number
          duration_months: number
          id: string
          is_active: boolean
          name: string
          plan_type: string | null
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_percentage?: number
          duration_months: number
          id?: string
          is_active?: boolean
          name: string
          plan_type?: string | null
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_percentage?: number
          duration_months?: number
          id?: string
          is_active?: boolean
          name?: string
          plan_type?: string | null
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_daily_dispatches: {
        Row: {
          created_at: string
          dispatch_count: number
          dispatch_date: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dispatch_count?: number
          dispatch_date?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dispatch_count?: number
          dispatch_date?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_payment_credentials: {
        Row: {
          created_at: string
          mercado_pago_access_token_enc: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          mercado_pago_access_token_enc: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          mercado_pago_access_token_enc?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          can_manage_campaigns: boolean | null
          can_manage_clients: boolean | null
          can_manage_contacts: boolean | null
          can_manage_inbox: boolean | null
          can_manage_warming: boolean | null
          can_manage_whatsapp: boolean | null
          can_send_dispatches: boolean | null
          can_view_ai_agent: boolean | null
          can_view_campaigns: boolean | null
          can_view_clients: boolean | null
          can_view_contacts: boolean | null
          can_view_dashboard: boolean | null
          can_view_dispatches: boolean | null
          can_view_inbox: boolean | null
          can_view_reports: boolean | null
          can_view_reseller: boolean | null
          can_view_settings: boolean | null
          can_view_warming: boolean | null
          can_view_whatsapp: boolean | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_manage_campaigns?: boolean | null
          can_manage_clients?: boolean | null
          can_manage_contacts?: boolean | null
          can_manage_inbox?: boolean | null
          can_manage_warming?: boolean | null
          can_manage_whatsapp?: boolean | null
          can_send_dispatches?: boolean | null
          can_view_ai_agent?: boolean | null
          can_view_campaigns?: boolean | null
          can_view_clients?: boolean | null
          can_view_contacts?: boolean | null
          can_view_dashboard?: boolean | null
          can_view_dispatches?: boolean | null
          can_view_inbox?: boolean | null
          can_view_reports?: boolean | null
          can_view_reseller?: boolean | null
          can_view_settings?: boolean | null
          can_view_warming?: boolean | null
          can_view_whatsapp?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_manage_campaigns?: boolean | null
          can_manage_clients?: boolean | null
          can_manage_contacts?: boolean | null
          can_manage_inbox?: boolean | null
          can_manage_warming?: boolean | null
          can_manage_whatsapp?: boolean | null
          can_send_dispatches?: boolean | null
          can_view_ai_agent?: boolean | null
          can_view_campaigns?: boolean | null
          can_view_clients?: boolean | null
          can_view_contacts?: boolean | null
          can_view_dashboard?: boolean | null
          can_view_dispatches?: boolean | null
          can_view_inbox?: boolean | null
          can_view_reports?: boolean | null
          can_view_reseller?: boolean | null
          can_view_settings?: boolean | null
          can_view_warming?: boolean | null
          can_view_whatsapp?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_pricing_settings: {
        Row: {
          created_at: string
          markup_percent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          markup_percent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          markup_percent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_wallets: {
        Row: {
          created_at: string
          credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_topups: {
        Row: {
          amount_brl: number
          created_at: string
          credits: number
          expires_at: string
          external_id: string | null
          id: string
          paid_at: string | null
          pix_code: string | null
          pix_qr_code: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_brl: number
          created_at?: string
          credits: number
          expires_at: string
          external_id?: string | null
          id?: string
          paid_at?: string | null
          pix_code?: string | null
          pix_qr_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_brl?: number
          created_at?: string
          credits?: number
          expires_at?: string
          external_id?: string | null
          id?: string
          paid_at?: string | null
          pix_code?: string | null
          pix_qr_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount_brl: number | null
          created_at: string
          credits: number
          id: string
          reference_id: string | null
          reference_type: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount_brl?: number | null
          created_at?: string
          credits: number
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount_brl?: number | null
          created_at?: string
          credits?: number
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_agent_routing: {
        Row: {
          agent_id: string
          created_at: string | null
          id: string
          instance_id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          id?: string
          instance_id: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          id?: string
          instance_id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_agent_routing_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_agent_routing_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          business_hours_end: string | null
          business_hours_start: string | null
          created_at: string
          daily_limit: number | null
          id: string
          instance_key: string | null
          instance_name: string
          last_connected_at: string | null
          phone_connected: string | null
          profile_name: string | null
          profile_picture_url: string | null
          qr_code: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_hours_end?: string | null
          business_hours_start?: string | null
          created_at?: string
          daily_limit?: number | null
          id?: string
          instance_key?: string | null
          instance_name: string
          last_connected_at?: string | null
          phone_connected?: string | null
          profile_name?: string | null
          profile_picture_url?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_hours_end?: string | null
          business_hours_start?: string | null
          created_at?: string
          daily_limit?: number | null
          id?: string
          instance_key?: string | null
          instance_name?: string
          last_connected_at?: string | null
          phone_connected?: string | null
          profile_name?: string | null
          profile_picture_url?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_owner_id: { Args: { p_user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_user_blocked: { Args: { _user_id: string }; Returns: boolean }
      wallet_credit: {
        Args: {
          p_amount: number
          p_reference_id?: string
          p_reference_type?: string
          p_tx_type?: string
          p_user_id: string
        }
        Returns: undefined
      }
      wallet_debit: {
        Args: {
          p_amount: number
          p_reference_id?: string
          p_reference_type?: string
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
