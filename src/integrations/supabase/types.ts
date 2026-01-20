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
      daily_checkins: {
        Row: {
          boolean_value: boolean | null
          checkin_date: string
          created_at: string
          duration_minutes: number | null
          id: string
          is_verified: boolean
          metadata: Json | null
          numeric_value: number | null
          task_instance_id: string
          time_value: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          boolean_value?: boolean | null
          checkin_date?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_verified?: boolean
          metadata?: Json | null
          numeric_value?: number | null
          task_instance_id: string
          time_value?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          boolean_value?: boolean | null
          checkin_date?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_verified?: boolean
          metadata?: Json | null
          numeric_value?: number | null
          task_instance_id?: string
          time_value?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_checkins_task_instance_id_fkey"
            columns: ["task_instance_id"]
            isOneToOne: false
            referencedRelation: "task_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          id: string
          joined_at: string
          league_id: string
          role: Database["public"]["Enums"]["league_role"]
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          league_id: string
          role?: Database["public"]["Enums"]["league_role"]
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          league_id?: string
          role?: Database["public"]["Enums"]["league_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      league_task_configs: {
        Row: {
          config_overrides: Json
          created_at: string
          display_order: number
          id: string
          is_enabled: boolean
          max_daily_points: number
          season_id: string
          task_template_id: string
          updated_at: string
        }
        Insert: {
          config_overrides?: Json
          created_at?: string
          display_order?: number
          id?: string
          is_enabled?: boolean
          max_daily_points?: number
          season_id: string
          task_template_id: string
          updated_at?: string
        }
        Update: {
          config_overrides?: Json
          created_at?: string
          display_order?: number
          id?: string
          is_enabled?: boolean
          max_daily_points?: number
          season_id?: string
          task_template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_task_configs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_task_configs_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          invite_code: string | null
          max_custom_tasks: number
          max_members: number
          min_members: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          invite_code?: string | null
          max_custom_tasks?: number
          max_members?: number
          min_members?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          invite_code?: string | null
          max_custom_tasks?: number
          max_members?: number
          min_members?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      matchups: {
        Row: {
          created_at: string
          id: string
          status: Database["public"]["Enums"]["matchup_status"]
          updated_at: string
          user1_id: string
          user1_score: number
          user2_id: string
          user2_score: number
          week_id: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["matchup_status"]
          updated_at?: string
          user1_id: string
          user1_score?: number
          user2_id: string
          user2_score?: number
          week_id: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["matchup_status"]
          updated_at?: string
          user1_id?: string
          user1_score?: number
          user2_id?: string
          user2_score?: number
          week_id?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matchups_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      powerups: {
        Row: {
          created_at: string
          id: string
          is_used: boolean
          modifier_value: number
          powerup_type: string
          task_instance_id: string | null
          used_at: string | null
          user_id: string
          week_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_used?: boolean
          modifier_value?: number
          powerup_type: string
          task_instance_id?: string | null
          used_at?: string | null
          user_id: string
          week_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_used?: boolean
          modifier_value?: number
          powerup_type?: string
          task_instance_id?: string | null
          used_at?: string | null
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "powerups_task_instance_id_fkey"
            columns: ["task_instance_id"]
            isOneToOne: false
            referencedRelation: "task_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "powerups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "powerups_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      punishments: {
        Row: {
          badge_name: string | null
          created_at: string
          id: string
          league_id: string
          metadata: Json | null
          punishment_type: string
          user_id: string
          week_id: string
        }
        Insert: {
          badge_name?: string | null
          created_at?: string
          id?: string
          league_id: string
          metadata?: Json | null
          punishment_type?: string
          user_id: string
          week_id: string
        }
        Update: {
          badge_name?: string | null
          created_at?: string
          id?: string
          league_id?: string
          metadata?: Json | null
          punishment_type?: string
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "punishments_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punishments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punishments_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_events: {
        Row: {
          config_snapshot: Json
          created_at: string
          daily_checkin_id: string
          derived_values: Json | null
          id: string
          is_reversed: boolean | null
          league_id: string | null
          points_awarded: number
          points_before_cap: number
          powerup_applied: Json | null
          raw_value: number
          rule_applied: string
          scoring_type: Database["public"]["Enums"]["scoring_type"]
          season_id: string | null
          task_instance_id: string | null
          user_id: string | null
          week_id: string | null
        }
        Insert: {
          config_snapshot: Json
          created_at?: string
          daily_checkin_id: string
          derived_values?: Json | null
          id?: string
          is_reversed?: boolean | null
          league_id?: string | null
          points_awarded: number
          points_before_cap: number
          powerup_applied?: Json | null
          raw_value: number
          rule_applied: string
          scoring_type: Database["public"]["Enums"]["scoring_type"]
          season_id?: string | null
          task_instance_id?: string | null
          user_id?: string | null
          week_id?: string | null
        }
        Update: {
          config_snapshot?: Json
          created_at?: string
          daily_checkin_id?: string
          derived_values?: Json | null
          id?: string
          is_reversed?: boolean | null
          league_id?: string | null
          points_awarded?: number
          points_before_cap?: number
          powerup_applied?: Json | null
          raw_value?: number
          rule_applied?: string
          scoring_type?: Database["public"]["Enums"]["scoring_type"]
          season_id?: string | null
          task_instance_id?: string | null
          user_id?: string | null
          week_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scoring_events_daily_checkin_id_fkey"
            columns: ["daily_checkin_id"]
            isOneToOne: false
            referencedRelation: "daily_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_events_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_events_task_instance_id_fkey"
            columns: ["task_instance_id"]
            isOneToOne: false
            referencedRelation: "task_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_events_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      season_standings: {
        Row: {
          current_rank: number | null
          current_streak: number
          highest_weekly_score: number | null
          id: string
          losses: number
          lowest_weekly_score: number | null
          points_against: number
          points_for: number
          season_id: string
          streak_type: string | null
          ties: number
          total_points: number
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          current_rank?: number | null
          current_streak?: number
          highest_weekly_score?: number | null
          id?: string
          losses?: number
          lowest_weekly_score?: number | null
          points_against?: number
          points_for?: number
          season_id: string
          streak_type?: string | null
          ties?: number
          total_points?: number
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          current_rank?: number | null
          current_streak?: number
          highest_weekly_score?: number | null
          id?: string
          losses?: number
          lowest_weekly_score?: number | null
          points_against?: number
          points_for?: number
          season_id?: string
          streak_type?: string | null
          ties?: number
          total_points?: number
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "season_standings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_standings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          end_date: string
          id: string
          league_id: string
          name: string
          season_number: number
          start_date: string
          status: Database["public"]["Enums"]["season_status"]
          updated_at: string
          weeks_count: number
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          league_id: string
          name: string
          season_number: number
          start_date: string
          status?: Database["public"]["Enums"]["season_status"]
          updated_at?: string
          weeks_count?: number
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          league_id?: string
          name?: string
          season_number?: number
          start_date?: string
          status?: Database["public"]["Enums"]["season_status"]
          updated_at?: string
          weeks_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "seasons_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      task_instances: {
        Row: {
          config: Json
          created_at: string
          id: string
          input_type: Database["public"]["Enums"]["input_type"]
          league_task_config_id: string | null
          scoring_type: Database["public"]["Enums"]["scoring_type"]
          season_id: string
          task_name: string
          user_custom_task_id: string | null
        }
        Insert: {
          config: Json
          created_at?: string
          id?: string
          input_type: Database["public"]["Enums"]["input_type"]
          league_task_config_id?: string | null
          scoring_type: Database["public"]["Enums"]["scoring_type"]
          season_id: string
          task_name: string
          user_custom_task_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          input_type?: Database["public"]["Enums"]["input_type"]
          league_task_config_id?: string | null
          scoring_type?: Database["public"]["Enums"]["scoring_type"]
          season_id?: string
          task_name?: string
          user_custom_task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_instances_league_task_config_id_fkey"
            columns: ["league_task_config_id"]
            isOneToOne: false
            referencedRelation: "league_task_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_user_custom_task_id_fkey"
            columns: ["user_custom_task_id"]
            isOneToOne: false
            referencedRelation: "user_custom_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          allowed_data_sources: string[]
          category: Database["public"]["Enums"]["task_category"]
          created_at: string
          default_config: Json
          description: string | null
          icon: string | null
          id: string
          input_type: Database["public"]["Enums"]["input_type"]
          is_active: boolean
          is_premium: boolean
          max_value: number | null
          min_value: number | null
          name: string
          scoring_type: Database["public"]["Enums"]["scoring_type"]
          supports_integration: boolean
          unit: Database["public"]["Enums"]["unit_type"]
          updated_at: string
          version: number
        }
        Insert: {
          allowed_data_sources?: string[]
          category?: Database["public"]["Enums"]["task_category"]
          created_at?: string
          default_config?: Json
          description?: string | null
          icon?: string | null
          id?: string
          input_type: Database["public"]["Enums"]["input_type"]
          is_active?: boolean
          is_premium?: boolean
          max_value?: number | null
          min_value?: number | null
          name: string
          scoring_type: Database["public"]["Enums"]["scoring_type"]
          supports_integration?: boolean
          unit: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
          version?: number
        }
        Update: {
          allowed_data_sources?: string[]
          category?: Database["public"]["Enums"]["task_category"]
          created_at?: string
          default_config?: Json
          description?: string | null
          icon?: string | null
          id?: string
          input_type?: Database["public"]["Enums"]["input_type"]
          is_active?: boolean
          is_premium?: boolean
          max_value?: number | null
          min_value?: number | null
          name?: string
          scoring_type?: Database["public"]["Enums"]["scoring_type"]
          supports_integration?: boolean
          unit?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      user_custom_tasks: {
        Row: {
          approved_by: string | null
          config: Json
          created_at: string
          description: string | null
          id: string
          input_type: Database["public"]["Enums"]["input_type"]
          is_active: boolean
          is_approved: boolean
          name: string
          scoring_type: Database["public"]["Enums"]["scoring_type"]
          season_id: string
          unit: Database["public"]["Enums"]["unit_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          input_type?: Database["public"]["Enums"]["input_type"]
          is_active?: boolean
          is_approved?: boolean
          name: string
          scoring_type?: Database["public"]["Enums"]["scoring_type"]
          season_id: string
          unit?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_by?: string | null
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          input_type?: Database["public"]["Enums"]["input_type"]
          is_active?: boolean
          is_approved?: boolean
          name?: string
          scoring_type?: Database["public"]["Enums"]["scoring_type"]
          season_id?: string
          unit?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_tasks_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_custom_tasks_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_custom_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_scores: {
        Row: {
          id: string
          perfect_days: number
          points_by_task: Json | null
          tasks_completed: number
          total_points: number
          updated_at: string
          user_id: string
          week_id: string
        }
        Insert: {
          id?: string
          perfect_days?: number
          points_by_task?: Json | null
          tasks_completed?: number
          total_points?: number
          updated_at?: string
          user_id: string
          week_id: string
        }
        Update: {
          id?: string
          perfect_days?: number
          points_by_task?: Json | null
          tasks_completed?: number
          total_points?: number
          updated_at?: string
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_scores_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      weeks: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_locked: boolean
          season_id: string
          start_date: string
          week_number: number
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_locked?: boolean
          season_id: string
          start_date: string
          week_number: number
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_locked?: boolean
          season_id?: string
          start_date?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "weeks_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_powerups: {
        Args: {
          _base_points: number
          _is_binary_missed?: boolean
          _task_instance_id: string
          _user_id: string
          _week_id: string
        }
        Returns: {
          final_points: number
          powerup_applied: Json
        }[]
      }
      assign_weekly_punishments: { Args: { _week_id: string }; Returns: number }
      calc_score_binary_yesno: {
        Args: { _boolean_value: boolean; _config: Json }
        Returns: number
      }
      calc_score_diminishing: {
        Args: { _config: Json; _numeric_value: number }
        Returns: number
      }
      calc_score_linear_per_unit: {
        Args: { _config: Json; _numeric_value: number }
        Returns: Record<string, unknown>
      }
      calc_score_threshold: {
        Args: { _config: Json; _numeric_value: number }
        Returns: number
      }
      calc_score_tiered: {
        Args: { _config: Json; _numeric_value: number }
        Returns: number
      }
      calc_score_time_after: {
        Args: { _config: Json; _time_value: string }
        Returns: number
      }
      calc_score_time_before: {
        Args: { _config: Json; _time_value: string }
        Returns: number
      }
      calculate_checkin_score: {
        Args: {
          _checkin: Record<string, unknown>
          _task_instance: Record<string, unknown>
        }
        Returns: {
          derived_values: Json
          points_awarded: number
          points_before_cap: number
          rule_applied: string
        }[]
      }
      can_access_checkin: {
        Args: { _task_instance_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_matchup: {
        Args: { _matchup_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_weekly_score: {
        Args: { _user_id: string; _week_id: string }
        Returns: boolean
      }
      get_week_for_date: {
        Args: { _date: string; _season_id: string }
        Returns: string
      }
      is_league_admin: {
        Args: { _league_id: string; _user_id: string }
        Returns: boolean
      }
      is_league_member: {
        Args: { _league_id: string; _user_id: string }
        Returns: boolean
      }
      is_season_member: {
        Args: { _season_id: string; _user_id: string }
        Returns: boolean
      }
      update_season_standing: {
        Args: { _season_id: string; _user_id: string }
        Returns: undefined
      }
      update_weekly_score: {
        Args: { _user_id: string; _week_id: string }
        Returns: undefined
      }
    }
    Enums: {
      input_type: "binary" | "numeric" | "time" | "duration"
      league_role: "owner" | "admin" | "member"
      matchup_status: "scheduled" | "in_progress" | "completed"
      scoring_type:
        | "binary_yesno"
        | "linear_per_unit"
        | "threshold"
        | "time_before"
        | "time_after"
        | "tiered"
        | "diminishing"
      season_status: "draft" | "active" | "completed" | "archived"
      task_category:
        | "fitness"
        | "wellness"
        | "learning"
        | "productivity"
        | "sleep"
        | "nutrition"
        | "mindfulness"
        | "social"
        | "custom"
      unit_type:
        | "steps"
        | "minutes"
        | "hours"
        | "pages"
        | "count"
        | "bedtime_time"
        | "waketime_time"
        | "boolean"
        | "words"
        | "miles"
        | "calories"
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
      input_type: ["binary", "numeric", "time", "duration"],
      league_role: ["owner", "admin", "member"],
      matchup_status: ["scheduled", "in_progress", "completed"],
      scoring_type: [
        "binary_yesno",
        "linear_per_unit",
        "threshold",
        "time_before",
        "time_after",
        "tiered",
        "diminishing",
      ],
      season_status: ["draft", "active", "completed", "archived"],
      task_category: [
        "fitness",
        "wellness",
        "learning",
        "productivity",
        "sleep",
        "nutrition",
        "mindfulness",
        "social",
        "custom",
      ],
      unit_type: [
        "steps",
        "minutes",
        "hours",
        "pages",
        "count",
        "bedtime_time",
        "waketime_time",
        "boolean",
        "words",
        "miles",
        "calories",
      ],
    },
  },
} as const
