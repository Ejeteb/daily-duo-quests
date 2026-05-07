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
      daily_quests: {
        Row: {
          created_at: string
          quest_date: string
          quest_id: string
          used_quest_ids: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          quest_date: string
          quest_id: string
          used_quest_ids?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          quest_date?: string
          quest_id?: string
          used_quest_ids?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_quests_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          accent: string
          avatar_url: string | null
          created_at: string
          current_week_start: string | null
          display_name: string
          id: string
          last_completed_date: string | null
          lifetime_xp: number
          slot: string
          streak: number
          user_id: string
          weekly_xp: number
        }
        Insert: {
          accent?: string
          avatar_url?: string | null
          created_at?: string
          current_week_start?: string | null
          display_name: string
          id?: string
          last_completed_date?: string | null
          lifetime_xp?: number
          slot: string
          streak?: number
          user_id: string
          weekly_xp?: number
        }
        Update: {
          accent?: string
          avatar_url?: string | null
          created_at?: string
          current_week_start?: string | null
          display_name?: string
          id?: string
          last_completed_date?: string | null
          lifetime_xp?: number
          slot?: string
          streak?: number
          user_id?: string
          weekly_xp?: number
        }
        Relationships: []
      }
      quests: {
        Row: {
          accepts: string
          category: string
          id: string
          prompt: string
        }
        Insert: {
          accepts?: string
          category: string
          id?: string
          prompt: string
        }
        Update: {
          accepts?: string
          category?: string
          id?: string
          prompt?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          awarded_bonus: boolean
          awarded_solo: boolean
          created_at: string
          id: string
          media_type: string
          media_url: string
          quest_date: string
          slot: string
          user_id: string
        }
        Insert: {
          awarded_bonus?: boolean
          awarded_solo?: boolean
          created_at?: string
          id?: string
          media_type: string
          media_url: string
          quest_date: string
          slot: string
          user_id: string
        }
        Update: {
          awarded_bonus?: boolean
          awarded_solo?: boolean
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string
          quest_date?: string
          slot?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_winners: {
        Row: {
          a_xp: number
          b_xp: number
          user_id: string
          week_start: string
          winner_slot: string | null
        }
        Insert: {
          a_xp?: number
          b_xp?: number
          user_id: string
          week_start: string
          winner_slot?: string | null
        }
        Update: {
          a_xp?: number
          b_xp?: number
          user_id?: string
          week_start?: string
          winner_slot?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
