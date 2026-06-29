export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string;
          created_at: string;
          details: Json;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          details?: Json;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          details?: Json;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value?: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      banners: {
        Row: {
          clicks: number;
          created_at: string;
          created_by: string | null;
          ends_at: string | null;
          id: string;
          image_path: string | null;
          impressions: number;
          is_active: boolean;
          link_url: string | null;
          placement: string;
          sort_order: number;
          starts_at: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          clicks?: number;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          image_path?: string | null;
          impressions?: number;
          is_active?: boolean;
          link_url?: string | null;
          placement?: string;
          sort_order?: number;
          starts_at?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          clicks?: number;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          image_path?: string | null;
          impressions?: number;
          is_active?: boolean;
          link_url?: string | null;
          placement?: string;
          sort_order?: number;
          starts_at?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
          id: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
          id?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
          id?: string;
        };
        Relationships: [];
      };
      blog_posts: {
        Row: {
          author_id: string | null;
          body: string | null;
          cover_path: string | null;
          created_at: string;
          excerpt: string | null;
          id: string;
          published_at: string | null;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          body?: string | null;
          cover_path?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published_at?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string | null;
          cover_path?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published_at?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          code: string;
          created_at: string;
          currency: string;
          description: string | null;
          discount_type: string;
          discount_value: number;
          id: string;
          is_active: boolean;
          max_redemptions: number | null;
          plan_id: string | null;
          times_redeemed: number;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          discount_type?: string;
          discount_value: number;
          id?: string;
          is_active?: boolean;
          max_redemptions?: number | null;
          plan_id?: string | null;
          times_redeemed?: number;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          discount_type?: string;
          discount_value?: number;
          id?: string;
          is_active?: boolean;
          max_redemptions?: number | null;
          plan_id?: string | null;
          times_redeemed?: number;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "coupons_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_recommendations: {
        Row: {
          created_at: string;
          id: string;
          rec_date: string;
          rec_rank: number;
          score: number;
          target_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          rec_date?: string;
          rec_rank?: number;
          score?: number;
          target_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          rec_date?: string;
          rec_rank?: number;
          score?: number;
          target_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      filter_options: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          is_active: boolean;
          label: string;
          sort_order: number;
          updated_at: string;
          value: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label: string;
          sort_order?: number;
          updated_at?: string;
          value: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label?: string;
          sort_order?: number;
          updated_at?: string;
          value?: string;
        };
        Relationships: [];
      };
      filter_presets: {
        Row: {
          created_at: string;
          filters: Json;
          id: string;
          is_quick: boolean;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          filters?: Json;
          id?: string;
          is_quick?: boolean;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          filters?: Json;
          id?: string;
          is_quick?: boolean;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      hero_slides: {
        Row: {
          created_at: string;
          cta_href: string | null;
          cta_label: string | null;
          ends_at: string | null;
          headline: string | null;
          id: string;
          image_path: string | null;
          is_published: boolean;
          sort_order: number;
          starts_at: string | null;
          subheadline: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          cta_href?: string | null;
          cta_label?: string | null;
          ends_at?: string | null;
          headline?: string | null;
          id?: string;
          image_path?: string | null;
          is_published?: boolean;
          sort_order?: number;
          starts_at?: string | null;
          subheadline?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          cta_href?: string | null;
          cta_label?: string | null;
          ends_at?: string | null;
          headline?: string | null;
          id?: string;
          image_path?: string | null;
          is_published?: boolean;
          sort_order?: number;
          starts_at?: string | null;
          subheadline?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      interaction_events: {
        Row: {
          context: Json;
          created_at: string;
          id: string;
          signal_type: string;
          target_id: string | null;
          user_id: string;
          weight: number;
        };
        Insert: {
          context?: Json;
          created_at?: string;
          id?: string;
          signal_type: string;
          target_id?: string | null;
          user_id: string;
          weight?: number;
        };
        Update: {
          context?: Json;
          created_at?: string;
          id?: string;
          signal_type?: string;
          target_id?: string | null;
          user_id?: string;
          weight?: number;
        };
        Relationships: [];
      };
      likes: {
        Row: {
          created_at: string;
          id: string;
          is_like: boolean;
          liked_id: string;
          liker_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_like?: boolean;
          liked_id: string;
          liker_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_like?: boolean;
          liked_id?: string;
          liker_id?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          created_at: string;
          id: string;
          user1_id: string;
          user2_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          user1_id: string;
          user2_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          user1_id?: string;
          user2_id?: string;
        };
        Relationships: [];
      };
      media_library: {
        Row: {
          alt_text: string | null;
          content_type: string;
          created_at: string;
          file_name: string;
          folder: string;
          height: number | null;
          id: string;
          kind: string;
          path: string;
          size_bytes: number | null;
          updated_at: string;
          uploaded_by: string | null;
          width: number | null;
        };
        Insert: {
          alt_text?: string | null;
          content_type: string;
          created_at?: string;
          file_name: string;
          folder?: string;
          height?: number | null;
          id?: string;
          kind?: string;
          path: string;
          size_bytes?: number | null;
          updated_at?: string;
          uploaded_by?: string | null;
          width?: number | null;
        };
        Update: {
          alt_text?: string | null;
          content_type?: string;
          created_at?: string;
          file_name?: string;
          folder?: string;
          height?: number | null;
          id?: string;
          kind?: string;
          path?: string;
          size_bytes?: number | null;
          updated_at?: string;
          uploaded_by?: string | null;
          width?: number | null;
        };
        Relationships: [];
      };
      site_content: {
        Row: {
          data: Json;
          section: string;
          updated_at: string;
        };
        Insert: {
          data?: Json;
          section: string;
          updated_at?: string;
        };
        Update: {
          data?: Json;
          section?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          match_id: string;
          read_at: string | null;
          sender_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          match_id: string;
          read_at?: string | null;
          sender_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          match_id?: string;
          read_at?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_notes: {
        Row: {
          author_id: string | null;
          created_at: string;
          id: string;
          note: string;
          report_id: string;
        };
        Insert: {
          author_id?: string | null;
          created_at?: string;
          id?: string;
          note: string;
          report_id: string;
        };
        Update: {
          author_id?: string | null;
          created_at?: string;
          id?: string;
          note?: string;
          report_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "moderation_notes_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          browser_push: boolean;
          created_at: string;
          likes: boolean;
          new_matches: boolean;
          new_messages: boolean;
          updated_at: string;
          user_id: string;
          verification: boolean;
        };
        Insert: {
          browser_push?: boolean;
          created_at?: string;
          likes?: boolean;
          new_matches?: boolean;
          new_messages?: boolean;
          updated_at?: string;
          user_id: string;
          verification?: boolean;
        };
        Update: {
          browser_push?: boolean;
          created_at?: string;
          likes?: boolean;
          new_matches?: boolean;
          new_messages?: boolean;
          updated_at?: string;
          user_id?: string;
          verification?: boolean;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          data: Json;
          id: string;
          read_at: string | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          read_at?: string | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          read_at?: string | null;
          title?: string;
          type?: Database["public"]["Enums"]["notification_type"];
          user_id?: string;
        };
        Relationships: [];
      };
      payment_installments: {
        Row: {
          amount_paid_cents: number;
          amount_total_cents: number;
          created_at: string;
          currency: string;
          id: string;
          installment_amount_cents: number;
          installments_paid: number;
          last_paid_at: string | null;
          metadata: Json;
          next_due_at: string | null;
          plan_id: string | null;
          status: string;
          subscription_id: string | null;
          total_installments: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_paid_cents?: number;
          amount_total_cents: number;
          created_at?: string;
          currency?: string;
          id?: string;
          installment_amount_cents: number;
          installments_paid?: number;
          last_paid_at?: string | null;
          metadata?: Json;
          next_due_at?: string | null;
          plan_id?: string | null;
          status?: string;
          subscription_id?: string | null;
          total_installments: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount_paid_cents?: number;
          amount_total_cents?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          installment_amount_cents?: number;
          installments_paid?: number;
          last_paid_at?: string | null;
          metadata?: Json;
          next_due_at?: string | null;
          plan_id?: string | null;
          status?: string;
          subscription_id?: string | null;
          total_installments?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_installments_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_installments_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_provider_settings: {
        Row: {
          config: Json;
          created_at: string;
          display_name: string;
          id: string;
          is_enabled: boolean;
          provider: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          config?: Json;
          created_at?: string;
          display_name: string;
          id?: string;
          is_enabled?: boolean;
          provider: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          config?: Json;
          created_at?: string;
          display_name?: string;
          id?: string;
          is_enabled?: boolean;
          provider?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_cents: number;
          coupon_code: string | null;
          created_at: string;
          currency: string;
          customer_email: string | null;
          description: string | null;
          gateway: string | null;
          id: string;
          installment_id: string | null;
          installment_number: number | null;
          invoice_number: string | null;
          kind: string;
          metadata: Json;
          payment_method: string | null;
          period_end: string | null;
          period_start: string | null;
          plan_id: string | null;
          provider: string;
          provider_payment_id: string | null;
          reference: string | null;
          status: string;
          subscription_id: string | null;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          coupon_code?: string | null;
          created_at?: string;
          currency?: string;
          customer_email?: string | null;
          description?: string | null;
          gateway?: string | null;
          id?: string;
          installment_id?: string | null;
          installment_number?: number | null;
          invoice_number?: string | null;
          kind?: string;
          metadata?: Json;
          payment_method?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          plan_id?: string | null;
          provider?: string;
          provider_payment_id?: string | null;
          reference?: string | null;
          status?: string;
          subscription_id?: string | null;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          coupon_code?: string | null;
          created_at?: string;
          currency?: string;
          customer_email?: string | null;
          description?: string | null;
          gateway?: string | null;
          id?: string;
          installment_id?: string | null;
          installment_number?: number | null;
          invoice_number?: string | null;
          kind?: string;
          metadata?: Json;
          payment_method?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          plan_id?: string | null;
          provider?: string;
          provider_payment_id?: string | null;
          reference?: string | null;
          status?: string;
          subscription_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_audit_log: {
        Row: {
          changed_by: string | null;
          created_at: string;
          field_name: string;
          id: string;
          new_value: string | null;
          old_value: string | null;
          profile_id: string;
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          field_name: string;
          id?: string;
          new_value?: string | null;
          old_value?: string | null;
          profile_id: string;
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          field_name?: string;
          id?: string;
          new_value?: string | null;
          old_value?: string | null;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_audit_log_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_photos: {
        Row: {
          created_at: string;
          id: string;
          is_private: boolean;
          is_primary: boolean;
          moderation_status: string;
          position: number;
          storage_path: string | null;
          url: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_private?: boolean;
          is_primary?: boolean;
          moderation_status?: string;
          position?: number;
          storage_path?: string | null;
          url: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_private?: boolean;
          is_primary?: boolean;
          moderation_status?: string;
          position?: number;
          storage_path?: string | null;
          url?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          bio: string | null;
          birth_date: string | null;
          account_locked_until: string | null;
          created_at: string;
          display_name: string | null;
          drinking: string | null;
          education: string | null;
          education_importance: string | null;
          email_verified: boolean;
          family_plans: string | null;
          faith_or_values_importance: string | null;
          faith: string | null;
          faith_importance: string | null;
          family_values: string | null;
          failed_login_attempts: number;
          gender: string | null;
          hide_age: boolean;
          hide_distance: boolean;
          hide_online_status: boolean;
          id: string;
          incognito: boolean;
          interested_in: string[];
          dealbreakers: string[];
          interests: string[];
          is_demo_profile: boolean;
          is_discoverable: boolean;
          is_featured: boolean;
          is_verified: boolean;
          languages: string[];
          languages_spoken: string[];
          last_active: string;
          last_login_at: string | null;
          latitude: number | null;
          location_access_suspended: boolean;
          location_city: string | null;
          location_country: string | null;
          location_geog: unknown;
          location_hidden: boolean;
          location_state: string | null;
          location_updated_at: string | null;
          longitude: number | null;
          membership_tier: Database["public"]["Enums"]["membership_tier"];
          marriage_intention: string | null;
          marriage_timeline: string | null;
          wants_children: string | null;
          has_children: string | null;
          relocation_openness: string | null;
          communication_style: string | null;
          long_distance_openness: string | null;
          parenting_preferences: string | null;
          conflict_resolution_style: string | null;
          love_language: string | null;
          work_life_balance: string | null;
          culture_background: string | null;
          personality_type: string | null;
          hobbies: string[];
          partner_expectations: string | null;
          future_plans: string | null;
          serious_profile_visibility: Json;
          phone_verified: boolean;
          identity_verified: boolean;
          photo_verified: boolean;
          trust_explanation: Json;
          profile_completion_score: number;
          trust_score: number;
          trust_level: string;
          onboarding_complete: boolean;
          pets: string | null;
          profession: string | null;
          profile_completion_status: string;
          profile_source: string;
          relationship_goal: string | null;
          religion: string | null;
          smoking: string | null;
          updated_at: string;
          username: string | null;
          workout: string | null;
        };
        Insert: {
          account_locked_until?: string | null;
          bio?: string | null;
          birth_date?: string | null;
          created_at?: string;
          display_name?: string | null;
          drinking?: string | null;
          education?: string | null;
          education_importance?: string | null;
          email_verified?: boolean;
          family_plans?: string | null;
          faith_or_values_importance?: string | null;
          faith?: string | null;
          faith_importance?: string | null;
          family_values?: string | null;
          failed_login_attempts?: number;
          gender?: string | null;
          hide_age?: boolean;
          hide_distance?: boolean;
          hide_online_status?: boolean;
          id: string;
          incognito?: boolean;
          interested_in?: string[];
          dealbreakers?: string[];
          interests?: string[];
          is_demo_profile?: boolean;
          is_discoverable?: boolean;
          is_featured?: boolean;
          is_verified?: boolean;
          languages?: string[];
          languages_spoken?: string[];
          last_active?: string;
          last_login_at?: string | null;
          latitude?: number | null;
          location_access_suspended?: boolean;
          location_city?: string | null;
          location_country?: string | null;
          location_geog?: unknown;
          location_hidden?: boolean;
          location_state?: string | null;
          location_updated_at?: string | null;
          longitude?: number | null;
          membership_tier?: Database["public"]["Enums"]["membership_tier"];
          marriage_intention?: string | null;
          marriage_timeline?: string | null;
          wants_children?: string | null;
          has_children?: string | null;
          relocation_openness?: string | null;
          communication_style?: string | null;
          long_distance_openness?: string | null;
          parenting_preferences?: string | null;
          conflict_resolution_style?: string | null;
          love_language?: string | null;
          work_life_balance?: string | null;
          culture_background?: string | null;
          personality_type?: string | null;
          hobbies?: string[];
          partner_expectations?: string | null;
          future_plans?: string | null;
          serious_profile_visibility?: Json;
          phone_verified?: boolean;
          identity_verified?: boolean;
          photo_verified?: boolean;
          trust_explanation?: Json;
          profile_completion_score?: number;
          trust_score?: number;
          trust_level?: string;
          onboarding_complete?: boolean;
          pets?: string | null;
          profession?: string | null;
          profile_completion_status?: string;
          profile_source?: string;
          relationship_goal?: string | null;
          religion?: string | null;
          smoking?: string | null;
          updated_at?: string;
          username?: string | null;
          workout?: string | null;
        };
        Update: {
          account_locked_until?: string | null;
          bio?: string | null;
          birth_date?: string | null;
          created_at?: string;
          display_name?: string | null;
          drinking?: string | null;
          education?: string | null;
          education_importance?: string | null;
          email_verified?: boolean;
          family_plans?: string | null;
          faith_or_values_importance?: string | null;
          faith?: string | null;
          faith_importance?: string | null;
          family_values?: string | null;
          failed_login_attempts?: number;
          gender?: string | null;
          hide_age?: boolean;
          hide_distance?: boolean;
          hide_online_status?: boolean;
          id?: string;
          incognito?: boolean;
          interested_in?: string[];
          dealbreakers?: string[];
          interests?: string[];
          is_demo_profile?: boolean;
          is_discoverable?: boolean;
          is_featured?: boolean;
          is_verified?: boolean;
          languages?: string[];
          languages_spoken?: string[];
          last_active?: string;
          last_login_at?: string | null;
          latitude?: number | null;
          location_access_suspended?: boolean;
          location_city?: string | null;
          location_country?: string | null;
          location_geog?: unknown;
          location_hidden?: boolean;
          location_state?: string | null;
          location_updated_at?: string | null;
          longitude?: number | null;
          membership_tier?: Database["public"]["Enums"]["membership_tier"];
          marriage_intention?: string | null;
          marriage_timeline?: string | null;
          wants_children?: string | null;
          has_children?: string | null;
          relocation_openness?: string | null;
          communication_style?: string | null;
          long_distance_openness?: string | null;
          parenting_preferences?: string | null;
          conflict_resolution_style?: string | null;
          love_language?: string | null;
          work_life_balance?: string | null;
          culture_background?: string | null;
          personality_type?: string | null;
          hobbies?: string[];
          partner_expectations?: string | null;
          future_plans?: string | null;
          serious_profile_visibility?: Json;
          phone_verified?: boolean;
          identity_verified?: boolean;
          photo_verified?: boolean;
          trust_explanation?: Json;
          profile_completion_score?: number;
          trust_score?: number;
          trust_level?: string;
          onboarding_complete?: boolean;
          pets?: string | null;
          profession?: string | null;
          profile_completion_status?: string;
          profile_source?: string;
          relationship_goal?: string | null;
          religion?: string | null;
          smoking?: string | null;
          updated_at?: string;
          username?: string | null;
          workout?: string | null;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          assigned_to: string | null;
          category: Database["public"]["Enums"]["report_category"];
          content_id: string | null;
          content_type: string | null;
          created_at: string;
          details: string | null;
          id: string;
          match_id: string | null;
          reason: string;
          reported_id: string;
          reporter_id: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          severity: Database["public"]["Enums"]["report_severity"];
          status: Database["public"]["Enums"]["report_status"];
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          category?: Database["public"]["Enums"]["report_category"];
          content_id?: string | null;
          content_type?: string | null;
          created_at?: string;
          details?: string | null;
          id?: string;
          match_id?: string | null;
          reason: string;
          reported_id: string;
          reporter_id: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: Database["public"]["Enums"]["report_severity"];
          status?: Database["public"]["Enums"]["report_status"];
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          category?: Database["public"]["Enums"]["report_category"];
          content_id?: string | null;
          content_type?: string | null;
          created_at?: string;
          details?: string | null;
          id?: string;
          match_id?: string | null;
          reason?: string;
          reported_id?: string;
          reporter_id?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: Database["public"]["Enums"]["report_severity"];
          status?: Database["public"]["Enums"]["report_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      search_events: {
        Row: {
          created_at: string;
          filters: Json;
          id: string;
          result_count: number;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          filters?: Json;
          id?: string;
          result_count?: number;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          filters?: Json;
          id?: string;
          result_count?: number;
          user_id?: string | null;
        };
        Relationships: [];
      };
      subscription_plans: {
        Row: {
          badge: string | null;
          billing_interval: string;
          created_at: string;
          currency: string;
          description: string | null;
          features: Json;
          highlights: Json;
          id: string;
          interval_count: number;
          is_active: boolean;
          is_visible: boolean;
          name: string;
          price_cents: number;
          slug: string | null;
          sort_order: number;
          tagline: string | null;
          tier: Database["public"]["Enums"]["membership_tier"];
          trial_days: number;
          updated_at: string;
          variant: string;
        };
        Insert: {
          badge?: string | null;
          billing_interval?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          features?: Json;
          highlights?: Json;
          id?: string;
          interval_count?: number;
          is_active?: boolean;
          is_visible?: boolean;
          name: string;
          price_cents?: number;
          slug?: string | null;
          sort_order?: number;
          tagline?: string | null;
          tier: Database["public"]["Enums"]["membership_tier"];
          trial_days?: number;
          updated_at?: string;
          variant?: string;
        };
        Update: {
          badge?: string | null;
          billing_interval?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          features?: Json;
          highlights?: Json;
          id?: string;
          interval_count?: number;
          is_active?: boolean;
          is_visible?: boolean;
          name?: string;
          price_cents?: number;
          slug?: string | null;
          sort_order?: number;
          tagline?: string | null;
          tier?: Database["public"]["Enums"]["membership_tier"];
          trial_days?: number;
          updated_at?: string;
          variant?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          auto_renew: boolean;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          gateway: string | null;
          id: string;
          metadata: Json;
          payment_method: string | null;
          plan_id: string | null;
          provider: string;
          provider_subscription_id: string | null;
          status: string;
          tier: Database["public"]["Enums"]["membership_tier"];
          trial_end: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auto_renew?: boolean;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          gateway?: string | null;
          id?: string;
          metadata?: Json;
          payment_method?: string | null;
          plan_id?: string | null;
          provider?: string;
          provider_subscription_id?: string | null;
          status?: string;
          tier: Database["public"]["Enums"]["membership_tier"];
          trial_end?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auto_renew?: boolean;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          gateway?: string | null;
          id?: string;
          metadata?: Json;
          payment_method?: string | null;
          plan_id?: string | null;
          provider?: string;
          provider_subscription_id?: string | null;
          status?: string;
          tier?: Database["public"]["Enums"]["membership_tier"];
          trial_end?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      success_stories: {
        Row: {
          body: string;
          couple_names: string | null;
          created_at: string;
          id: string;
          image_path: string | null;
          is_published: boolean;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          couple_names?: string | null;
          created_at?: string;
          id?: string;
          image_path?: string | null;
          is_published?: boolean;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          couple_names?: string | null;
          created_at?: string;
          id?: string;
          image_path?: string | null;
          is_published?: boolean;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      testimonials: {
        Row: {
          country: string | null;
          created_at: string;
          id: string;
          is_published: boolean;
          name: string;
          photo_path: string | null;
          quote: string;
          rating: number;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          country?: string | null;
          created_at?: string;
          id?: string;
          is_published?: boolean;
          name: string;
          photo_path?: string | null;
          quote: string;
          rating?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          country?: string | null;
          created_at?: string;
          id?: string;
          is_published?: boolean;
          name?: string;
          photo_path?: string | null;
          quote?: string;
          rating?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_moderation: {
        Row: {
          ban_reason: string | null;
          banned_until: string | null;
          created_at: string;
          is_banned: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ban_reason?: string | null;
          banned_until?: string | null;
          created_at?: string;
          is_banned?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ban_reason?: string | null;
          banned_until?: string | null;
          created_at?: string;
          is_banned?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      user_warnings: {
        Row: {
          acknowledged: boolean;
          created_at: string;
          id: string;
          issued_by: string | null;
          reason: string;
          report_id: string | null;
          severity: Database["public"]["Enums"]["report_severity"];
          user_id: string;
        };
        Insert: {
          acknowledged?: boolean;
          created_at?: string;
          id?: string;
          issued_by?: string | null;
          reason: string;
          report_id?: string | null;
          severity?: Database["public"]["Enums"]["report_severity"];
          user_id: string;
        };
        Update: {
          acknowledged?: boolean;
          created_at?: string;
          id?: string;
          issued_by?: string | null;
          reason?: string;
          report_id?: string | null;
          severity?: Database["public"]["Enums"]["report_severity"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_warnings_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
        ];
      };
      verification_requests: {
        Row: {
          created_at: string;
          document_type: string | null;
          id: string;
          note: string | null;
          photo_path: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["verification_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          document_type?: string | null;
          id?: string;
          note?: string | null;
          photo_path: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["verification_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          document_type?: string | null;
          id?: string;
          note?: string | null;
          photo_path?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["verification_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      verification_review: {
        Row: {
          created_at: string;
          fraud_flags: Json;
          fraud_score: number;
          id: string;
          id_photo_path: string | null;
          request_id: string;
          selfie_hash: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          fraud_flags?: Json;
          fraud_score?: number;
          id?: string;
          id_photo_path?: string | null;
          request_id: string;
          selfie_hash?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          fraud_flags?: Json;
          fraud_score?: number;
          id?: string;
          id_photo_path?: string | null;
          request_id?: string;
          selfie_hash?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "verification_review_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: true;
            referencedRelation: "verification_requests";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_assign_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      admin_revoke_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      admin_set_location_access: {
        Args: { _suspended: boolean; _user_id: string };
        Returns: boolean;
      };
      bootstrap_super_admin: { Args: never; Returns: string };
      compat_breakdown: {
        Args: {
          distance_m: number;
          t_birth: string;
          t_completeness: number;
          t_drinking: string;
          t_education: string;
          t_family: string;
          t_goal: string;
          t_interests: string[];
          t_langs: string[];
          t_pets: string;
          t_religion: string;
          t_smoking: string;
          t_verified: boolean;
          t_workout: string;
          v_birth: string;
          v_drinking: string;
          v_education: string;
          v_family: string;
          v_goal: string;
          v_interests: string[];
          v_langs: string[];
          v_pets: string;
          v_religion: string;
          v_smoking: string;
          v_workout: string;
        };
        Returns: Json;
      };
      compatibility_scores: {
        Args: { _ids: string[] };
        Returns: {
          breakdown: Json;
          id: string;
          score: number;
        }[];
      };
      create_notification: {
        Args: {
          _body: string;
          _data?: Json;
          _title: string;
          _type: Database["public"]["Enums"]["notification_type"];
          _user_id: string;
        };
        Returns: undefined;
      };
      demo_profiles_visible: { Args: never; Returns: boolean };
      discover_profiles: {
        Args: {
          _city?: string;
          _country?: string;
          _drinking?: string;
          _education?: string;
          _family_plans?: string;
          _has_bio?: boolean;
          _interests?: string[];
          _languages?: string[];
          _limit?: number;
          _max_age?: number;
          _max_distance_km?: number;
          _min_age?: number;
          _online_minutes?: number;
          _pets?: string;
          _premium_only?: boolean;
          _profession?: string;
          _recently_active_minutes?: number;
          _relationship_goal?: string;
          _religion?: string;
          _smoking?: string;
          _state?: string;
          _verified_only?: boolean;
          _workout?: string;
        };
        Returns: {
          distance_m: number;
          id: string;
        }[];
      };
      discover_section: {
        Args: { _kind: string; _limit?: number };
        Returns: {
          distance_m: number;
          id: string;
        }[];
      };
      get_daily_recommendations: {
        Args: { _limit?: number };
        Returns: {
          distance_m: number;
          id: string;
          score: number;
        }[];
      };
      get_visible_profiles: {
        Args: { _ids: string[] };
        Returns: {
          bio: string;
          birth_date: string;
          created_at: string;
          display_name: string;
          education: string;
          education_importance: string;
          faith: string;
          faith_importance: string;
          culture_background: string;
          gender: string;
          phone_verified: boolean;
          identity_verified: boolean;
          photo_verified: boolean;
          id: string;
          interested_in: string[];
          interests: string[];
          is_demo_profile: boolean;
          is_featured: boolean;
          is_verified: boolean;
          languages: string[];
          languages_spoken: string[];
          last_active: string;
          latitude: number;
          location_access_suspended: boolean;
          location_city: string;
          location_country: string;
          location_hidden: boolean;
          location_state: string;
          location_updated_at: string;
          longitude: number;
          membership_tier: Database["public"]["Enums"]["membership_tier"];
          onboarding_complete: boolean;
          relationship_goal: string;
          marriage_intention: string;
          marriage_timeline: string;
          wants_children: string;
          has_children: string;
          faith_or_values_importance: string;
          family_values: string;
          relocation_openness: string;
          communication_style: string;
          dealbreakers: string[];
          long_distance_openness: string;
          parenting_preferences: string;
          conflict_resolution_style: string;
          love_language: string;
          work_life_balance: string;
          personality_type: string;
          hobbies: string[];
          partner_expectations: string;
          future_plans: string;
          profile_completion_score: number;
          trust_score: number;
          trust_level: string;
          trust_explanation: Json;
          religion: string;
          updated_at: string;
        }[];
      };
      location_distribution: {
        Args: never;
        Returns: {
          city: string;
          country: string;
          member_count: number;
        }[];
      };
      location_heatmap: {
        Args: {
          _end_date?: string;
          _start_date?: string;
          _verified_only?: boolean;
        };
        Returns: {
          city: string;
          country: string;
          member_count: number;
          verified_count: number;
        }[];
      };
      matching_analytics: { Args: { _days?: number }; Returns: Json };
      moderation_activity: {
        Args: { _limit?: number };
        Returns: {
          action: string;
          actor_id: string;
          actor_name: string;
          created_at: string;
          details: Json;
          entity_id: string;
          entity_type: string;
          id: string;
        }[];
      };
      moderation_delete_content: {
        Args: { _content_id: string; _content_type: string };
        Returns: boolean;
      };
      moderation_reports: {
        Args: never;
        Returns: {
          assigned_to: string;
          assignee_name: string;
          category: Database["public"]["Enums"]["report_category"];
          content_id: string;
          content_type: string;
          created_at: string;
          details: string;
          id: string;
          match_id: string;
          reason: string;
          reported_banned_until: string;
          reported_distinct_reporters: number;
          reported_id: string;
          reported_is_banned: boolean;
          reported_name: string;
          reported_total_reports: number;
          reporter_id: string;
          reporter_name: string;
          resolution_note: string;
          resolved_at: string;
          severity: Database["public"]["Enums"]["report_severity"];
          status: Database["public"]["Enums"]["report_status"];
        }[];
      };
      moderation_stats: { Args: never; Returns: Json };
      pref_match: {
        Args: { _gender: string; _interested: string[] };
        Returns: boolean;
      };
      recommended_matches: {
        Args: { _kind?: string; _limit?: number };
        Returns: {
          distance_m: number;
          id: string;
          score: number;
        }[];
      };
      search_analytics: { Args: { _days?: number }; Returns: Json };
      search_profiles: {
        Args: {
          _city?: string;
          _country?: string;
          _drinking?: string;
          _education?: string;
          _family_plans?: string;
          _has_bio?: boolean;
          _interests?: string[];
          _languages?: string[];
          _limit?: number;
          _max_age?: number;
          _max_distance_km?: number;
          _min_age?: number;
          _offset?: number;
          _online_minutes?: number;
          _pets?: string;
          _premium_only?: boolean;
          _profession?: string;
          _recently_active_minutes?: number;
          _relationship_goal?: string;
          _religion?: string;
          _smoking?: string;
          _state?: string;
          _verified_only?: boolean;
          _workout?: string;
        };
        Returns: {
          distance_m: number;
          id: string;
          total_count: number;
        }[];
      };
      suspicious_locations: {
        Args: { _limit?: number };
        Returns: {
          display_name: string;
          latitude: number;
          location_access_suspended: boolean;
          location_city: string;
          location_country: string;
          location_updated_at: string;
          longitude: number;
          reason: string;
          shared_count: number;
          user_id: string;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "moderator" | "user" | "super_admin";
      membership_tier: "free" | "premium" | "gold" | "platinum";
      notification_type:
        | "message"
        | "match"
        | "verification"
        | "like"
        | "payment"
        | "system"
        | "promotion"
        | "safety";
      report_category:
        | "profile"
        | "photo"
        | "message"
        | "scam"
        | "fake_profile"
        | "harassment"
        | "abuse"
        | "spam"
        | "underage"
        | "other";
      report_severity: "low" | "medium" | "high" | "critical";
      report_status: "pending" | "reviewed" | "resolved" | "dismissed";
      verification_status: "pending" | "approved" | "rejected";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "super_admin"],
      membership_tier: ["free", "premium", "gold", "platinum"],
      notification_type: [
        "message",
        "match",
        "verification",
        "like",
        "payment",
        "system",
        "promotion",
        "safety",
      ],
      report_category: [
        "profile",
        "photo",
        "message",
        "scam",
        "fake_profile",
        "harassment",
        "abuse",
        "spam",
        "underage",
        "other",
      ],
      report_severity: ["low", "medium", "high", "critical"],
      report_status: ["pending", "reviewed", "resolved", "dismissed"],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const;
