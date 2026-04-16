// Supabase database types — covers all tables used in the codebase.
// Regenerate with: supabase gen types typescript

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          first_name: string
          last_name: string
          birth_date: string
          phone: string
          avatar_url: string | null
          address: string | null
          postal_code: string | null
          city: string | null
          country: string | null
          bio: string | null
          role: 'user' | 'business' | 'admin' | 'god'
          spotify_connected: boolean
          spotify_refresh_token: string | null
          spotify_user_id: string | null
          facebook_connected: boolean
          facebook_user_id: string | null
          preferred_bundesland: string | null
          preferred_categories: string[] | null
          notification_enabled: boolean
          agb_accepted_at: string | null
          newsletter_opt_in: boolean
          created_at: string
          updated_at: string
          last_seen_at: string
        }
      }
      events: {
        Row: {
          id: string
          source_type: 'scraped' | 'user' | 'business' | 'derived'
          source_name: string | null
          source_id: string | null
          source_url: string | null
          created_by: string | null
          business_id: string | null
          title: string
          description: string | null
          category: string | null
          tags: string[] | null
          start_date: string
          end_date: string | null
          is_all_day: boolean
          location_name: string | null
          address: string | null
          postal_code: string | null
          district: string | null
          bundesland: string | null
          latitude: number | null
          longitude: number | null
          image_url: string | null
          images: string[] | null
          price_text: string | null
          price_min: number | null
          price_max: number | null
          ticket_url: string | null
          visibility: 'public' | 'private' | 'group'
          organizer: string | null
          organizer_url: string | null
          view_count: number
          save_count: number
          share_count: number
          event_score: number | null
          score_updated_at: string | null
          venue_id: string | null
          event_series_id: string | null
          content_fingerprint: string | null
          parent_event_id: string | null
          created_at: string
          updated_at: string
        }
      }
      venues: {
        Row: {
          id: string
          name: string
          name_normalized: string
          type: 'bar' | 'pub' | 'nightclub' | 'club' | 'vereinslokal' | 'university' | 'student_org' | 'cultural_center' | 'concert_hall' | 'theater' | 'museum' | 'other'
          subtype: string | null
          address: string | null
          postal_code: string | null
          city: string | null
          bundesland: string | null
          latitude: number | null
          longitude: number | null
          website: string | null
          facebook_url: string | null
          instagram_url: string | null
          event_feed_url: string | null
          event_feed_type: 'ics' | 'rss' | 'json-ld' | 'html' | 'api' | null
          osm_id: number | null
          osm_tags: Json | null
          registry_source: 'osm' | 'open_data' | 'oeh' | 'esn' | 'iaeste' | 'aiesec' | 'aegee' | 'manual'
          is_student_relevant: boolean
          localness_score: number
          last_scraped_at: string | null
          scrape_status: 'active' | 'inactive' | 'error' | 'pending'
          created_at: string
          updated_at: string
        }
      }
      event_series: {
        Row: {
          id: string
          venue_id: string | null
          title: string
          title_normalized: string
          recurrence_rule: string | null
          category: string | null
          day_of_week: number | null
          start_time: string | null
          created_at: string
        }
      }
      saved_events: {
        Row: {
          id: string
          user_id: string
          event_id: string
          remind_at: string | null
          reminded: boolean
          notes: string | null
          created_at: string
        }
      }
      groups: {
        Row: {
          id: string
          name: string
          description: string | null
          image_url: string | null
          created_by: string
          is_public: boolean
          invite_code: string
          created_at: string
          updated_at: string
        }
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string
          role: 'member' | 'admin' | 'owner'
          joined_at: string
        }
      }
      group_messages: {
        Row: {
          id: string
          group_id: string
          user_id: string
          content: string
          message_type: 'text' | 'event_share' | 'image'
          event_id: string | null
          created_at: string
        }
      }
      group_contributions: {
        Row: {
          id: string
          group_id: string
          user_id: string
          event_id: string
          note: string | null
          created_at: string
        }
      }
      direct_messages: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          content: string
          message_type: 'text' | 'event_share' | 'image'
          event_id: string | null
          read: boolean
          read_at: string | null
          created_at: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          event_id: string | null
          group_id: string | null
          from_user_id: string | null
          action_url: string | null
          read: boolean
          read_at: string | null
          created_at: string
        }
      }
      friendships: {
        Row: {
          id: string
          user_id: string
          friend_id: string
          status: 'pending' | 'accepted' | 'blocked'
          created_at: string
          updated_at: string
        }
      }
      activities: {
        Row: {
          id: string
          user_id: string
          type: string
          content: string | null
          event_id: string | null
          group_id: string | null
          metadata: Json | null
          created_at: string
        }
      }
      activity_likes: {
        Row: {
          id: string
          user_id: string
          activity_id: string
          created_at: string
        }
      }
      activity_comments: {
        Row: {
          id: string
          activity_id: string
          user_id: string
          content: string
          created_at: string
        }
      }
      analytics_events: {
        Row: {
          id: string
          user_id: string | null
          session_id: string | null
          event_type: string
          event_data: Json
          page: string | null
          referrer: string | null
          user_agent: string | null
          ip_hash: string | null
          created_at: string
        }
      }
      event_reminders: {
        Row: {
          id: string
          user_id: string
          event_id: string
          remind_at: string
          sent: boolean
          created_at: string
        }
      }
      calendar_shares: {
        Row: {
          id: string
          user_id: string
          share_token: string
          is_active: boolean
          created_at: string
        }
      }
      memories: {
        Row: {
          id: string
          created_by: string
          event_id: string | null
          title: string
          description: string | null
          date: string
          location_name: string | null
          created_at: string
          updated_at: string
        }
      }
      memory_participants: {
        Row: {
          id: string
          memory_id: string
          user_id: string
          created_at: string
        }
      }
      memory_photos: {
        Row: {
          id: string
          memory_id: string
          user_id: string
          photo_url: string
          caption: string | null
          created_at: string
        }
      }
      spotify_artist_matches: {
        Row: {
          id: string
          event_id: string
          artist_name: string
          spotify_artist_id: string | null
          matched: boolean
          created_at: string
        }
      }
      spotify_tokens: {
        Row: {
          id: string
          user_id: string
          access_token: string
          refresh_token: string
          access_token_expires_at: string
          spotify_user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          access_token: string
          refresh_token: string
          access_token_expires_at: string
          spotify_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          refresh_token?: string
          access_token_expires_at?: string
          spotify_user_id?: string | null
          updated_at?: string
        }
      }
      imported_spotify_artists: {
        Row: {
          id: string
          user_id: string
          artist_name: string
          spotify_artist_id: string
          spotify_image_url: string | null
          genres: Json | null
          popularity: number | null
          rank: number
          imported_at: string
        }
        Insert: {
          id?: string
          user_id: string
          artist_name: string
          spotify_artist_id: string
          spotify_image_url?: string | null
          genres?: Json | null
          popularity?: number | null
          rank: number
          imported_at?: string
        }
        Update: {
          artist_name?: string
          spotify_image_url?: string | null
          genres?: Json | null
          popularity?: number | null
          rank?: number
          imported_at?: string
        }
      }
      followed_artists: {
        Row: {
          id: string
          user_id: string
          artist_name: string
          artist_name_normalized: string
          spotify_artist_id: string | null
          spotify_image_url: string | null
          source: 'spotify' | 'manual'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          artist_name: string
          spotify_artist_id?: string | null
          spotify_image_url?: string | null
          source?: 'spotify' | 'manual'
          created_at?: string
        }
        Update: {
          artist_name?: string
          spotify_artist_id?: string | null
          spotify_image_url?: string | null
          source?: 'spotify' | 'manual'
        }
      }
      artist_event_notifications: {
        Row: {
          id: string
          user_id: string
          event_id: string
          artist_name: string
          match_score: number
          match_source: 'title' | 'description' | 'lineup'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_id: string
          artist_name: string
          match_score?: number
          match_source?: 'title' | 'description' | 'lineup'
          created_at?: string
        }
        Update: {
          match_score?: number
          match_source?: 'title' | 'description' | 'lineup'
        }
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          artist_alerts_enabled: boolean
          channel_in_app: boolean
          channel_email: boolean
          channel_sms: boolean
          phone_number: string | null
          reminder_7d: boolean
          reminder_1d: boolean
          city_digest_enabled: boolean
          venue_alerts_enabled: boolean
          today_near_you_enabled: boolean
          student_alerts_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          artist_alerts_enabled?: boolean
          channel_in_app?: boolean
          channel_email?: boolean
          channel_sms?: boolean
          phone_number?: string | null
          reminder_7d?: boolean
          reminder_1d?: boolean
          city_digest_enabled?: boolean
          venue_alerts_enabled?: boolean
          today_near_you_enabled?: boolean
          student_alerts_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          artist_alerts_enabled?: boolean
          channel_in_app?: boolean
          channel_email?: boolean
          channel_sms?: boolean
          phone_number?: string | null
          reminder_7d?: boolean
          reminder_1d?: boolean
          city_digest_enabled?: boolean
          venue_alerts_enabled?: boolean
          today_near_you_enabled?: boolean
          student_alerts_enabled?: boolean
          updated_at?: string
        }
      }
      matching_cursor: {
        Row: {
          id: string
          last_processed_at: string
          last_success_at: string | null
          events_processed: number
          matches_found: number
          updated_at: string
        }
        Insert: {
          id?: string
          last_processed_at?: string
          last_success_at?: string | null
          events_processed?: number
          matches_found?: number
          updated_at?: string
        }
        Update: {
          last_processed_at?: string
          last_success_at?: string | null
          events_processed?: number
          matches_found?: number
          updated_at?: string
        }
      }
      event_tags: {
        Row: {
          event_id: string
          tag: string
        }
        Insert: {
          event_id: string
          tag: string
        }
        Update: {
          event_id?: string
          tag?: string
        }
      }
      festivals: {
        Row: {
          id: string
          canonical_name: string
          slug: string
          website_url: string | null
          lineup_url: string | null
          city: string | null
          state: string | null
          starts_at: string | null
          ends_at: string | null
          genres: string | null
          registry_source: string | null
          spotify_priority: string | null
          direct_lineup_candidate: boolean
          lineup_fetch_mode: string | null
          lineup_status: 'unknown' | 'fetched' | 'error' | 'no_lineup'
          lineup_hash: string | null
          lineup_last_checked_at: string | null
          parent_event_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          canonical_name: string
          slug: string
          website_url?: string | null
          lineup_url?: string | null
          city?: string | null
          state?: string | null
          starts_at?: string | null
          ends_at?: string | null
          genres?: string | null
          registry_source?: string | null
          spotify_priority?: string | null
          direct_lineup_candidate?: boolean
          lineup_fetch_mode?: string | null
          lineup_status?: 'unknown' | 'fetched' | 'error' | 'no_lineup'
          lineup_hash?: string | null
          lineup_last_checked_at?: string | null
          parent_event_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          canonical_name?: string
          slug?: string
          website_url?: string | null
          lineup_url?: string | null
          city?: string | null
          state?: string | null
          starts_at?: string | null
          ends_at?: string | null
          genres?: string | null
          registry_source?: string | null
          spotify_priority?: string | null
          direct_lineup_candidate?: boolean
          lineup_fetch_mode?: string | null
          lineup_status?: 'unknown' | 'fetched' | 'error' | 'no_lineup'
          lineup_hash?: string | null
          lineup_last_checked_at?: string | null
          parent_event_id?: string | null
          updated_at?: string
        }
      }
      festival_artists: {
        Row: {
          id: string
          festival_id: string
          artist_name_raw: string
          artist_name_normalized: string
          day_label: string | null
          stage_name: string | null
          billing: string | null
          source_url: string | null
          source_type: string | null
          confidence_score: number | null
          spotify_artist_id: string | null
          matched_by: string | null
          derived_event_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          festival_id: string
          artist_name_raw: string
          artist_name_normalized: string
          day_label?: string | null
          stage_name?: string | null
          billing?: string | null
          source_url?: string | null
          source_type?: string | null
          confidence_score?: number | null
          spotify_artist_id?: string | null
          matched_by?: string | null
          derived_event_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          artist_name_raw?: string
          artist_name_normalized?: string
          day_label?: string | null
          stage_name?: string | null
          billing?: string | null
          source_url?: string | null
          source_type?: string | null
          confidence_score?: number | null
          spotify_artist_id?: string | null
          matched_by?: string | null
          derived_event_id?: string | null
          updated_at?: string
        }
      }
    }
  }
}
