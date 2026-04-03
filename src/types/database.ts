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
          source_type: 'scraped' | 'user' | 'business'
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
          created_at: string
          updated_at: string
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
    }
  }
}
