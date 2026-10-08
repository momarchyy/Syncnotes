export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type CollabRole = 'viewer' | 'commenter' | 'editor';

export type ActivityAction =
  | 'CREATE_NOTE'
  | 'EDIT_NOTE'
  | 'TRASH_NOTE'
  | 'RESTORE_NOTE'
  | 'DELETE_NOTE'
  | 'MOVE_NOTE'
  | 'SHARE_NOTE'
  | 'ADD_ATTACHMENT'
  | 'RESTORE_VERSION';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          created_at: string
        }
        Insert: {
          id: string
          display_name: string
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          created_at?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          user_id: string
          theme: 'light' | 'dark' | 'system'
          font_size: number
          default_note_color: string
          auto_save: boolean
        }
        Insert: {
          user_id: string
          theme?: 'light' | 'dark' | 'system'
          font_size?: number
          default_note_color?: string
          auto_save?: boolean
        }
        Update: {
          user_id?: string
          theme?: 'light' | 'dark' | 'system'
          font_size?: number
          default_note_color?: string
          auto_save?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      folders: {
        Row: {
          id: string
          owner_id: string
          parent_id: string | null
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          parent_id?: string | null
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          parent_id?: string | null
          name?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          }
        ]
      }
      notes: {
        Row: {
          id: string
          owner_id: string
          folder_id: string | null
          title: string
          content: Json
          content_text: string
          version: number
          is_pinned: boolean
          is_favorite: boolean
          is_archived: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
          search_vector: unknown
        }
        Insert: {
          id?: string
          owner_id: string
          folder_id?: string | null
          title?: string
          content?: Json
          content_text?: string
          version?: number
          is_pinned?: boolean
          is_favorite?: boolean
          is_archived?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          folder_id?: string | null
          title?: string
          content?: Json
          content_text?: string
          version?: number
          is_pinned?: boolean
          is_favorite?: boolean
          is_archived?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          }
        ]
      }
      note_versions: {
        Row: {
          note_id: string
          version_no: number
          title: string
          content: Json
          content_text: string
          saved_by: string | null
          created_at: string
        }
        Insert: {
          note_id: string
          version_no: number
          title: string
          content: Json
          content_text?: string
          saved_by?: string | null
          created_at?: string
        }
        Update: {
          note_id?: string
          version_no?: number
          title?: string
          content?: Json
          content_text?: string
          saved_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_versions_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_versions_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      tags: {
        Row: {
          id: string
          owner_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          color?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      note_tags: {
        Row: {
          note_id: string
          tag_id: string
        }
        Insert: {
          note_id: string
          tag_id: string
        }
        Update: {
          note_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_tags_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          }
        ]
      }
      attachments: {
        Row: {
          id: string
          note_id: string
          uploader_id: string
          storage_path: string
          file_name: string
          mime_type: string
          size_bytes: number
          created_at: string
        }
        Insert: {
          id?: string
          note_id: string
          uploader_id: string
          storage_path: string
          file_name: string
          mime_type: string
          size_bytes: number
          created_at?: string
        }
        Update: {
          id?: string
          note_id?: string
          uploader_id?: string
          storage_path?: string
          file_name?: string
          mime_type?: string
          size_bytes?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      drawings: {
        Row: {
          id: string
          note_id: string
          strokes: Json
          width: number
          height: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          note_id: string
          strokes?: Json
          width?: number
          height?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          note_id?: string
          strokes?: Json
          width?: number
          height?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drawings_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          }
        ]
      }
      note_collaborators: {
        Row: {
          note_id: string
          user_id: string
          role: CollabRole
          created_at: string
        }
        Insert: {
          note_id: string
          user_id: string
          role?: CollabRole
          created_at?: string
        }
        Update: {
          note_id?: string
          user_id?: string
          role?: CollabRole
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_collaborators_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_collaborators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      comments: {
        Row: {
          id: string
          note_id: string
          author_id: string
          body: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          note_id: string
          author_id: string
          body: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          note_id?: string
          author_id?: string
          body?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      note_links: {
        Row: {
          source_note_id: string
          target_note_id: string
          created_at: string
        }
        Insert: {
          source_note_id: string
          target_note_id: string
          created_at?: string
        }
        Update: {
          source_note_id?: string
          target_note_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_links_source_note_id_fkey"
            columns: ["source_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_links_target_note_id_fkey"
            columns: ["target_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          }
        ]
      }
      activity_log: {
        Row: {
          id: number
          user_id: string
          note_id: string | null
          action: ActivityAction
          details: Json
          created_at: string
        }
        Insert: {
          id?: never
          user_id: string
          note_id?: string | null
          action: ActivityAction
          details?: Json
          created_at?: string
        }
        Update: {
          id?: never
          user_id?: string
          note_id?: string | null
          action?: ActivityAction
          details?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      v_note_stats: {
        Row: {
          owner_id: string
          total_notes: number
          notes_this_month: number
          favorites: number
          archived: number
          in_trash: number
          total_words: number
        }
        Relationships: []
      }
      v_notes_per_month: {
        Row: {
          owner_id: string
          month: string
          notes_created: number
        }
        Relationships: []
      }
      v_top_tags: {
        Row: {
          owner_id: string
          tag_id: string
          name: string
          note_count: number
        }
        Relationships: []
      }
      v_activity_by_weekday: {
        Row: {
          user_id: string
          weekday: number
          actions: number
        }
        Relationships: []
      }
    }
    Functions: {
      save_note: {
        Args: {
          p_note_id: string
          p_expected_version: number
          p_title: string
          p_content: Json
          p_content_text: string
        }
        Returns: Database['public']['Tables']['notes']['Row']
      }
      restore_version: {
        Args: {
          p_note_id: string
          p_version_no: number
        }
        Returns: Database['public']['Tables']['notes']['Row']
      }
      share_note: {
        Args: {
          p_note_id: string
          p_email: string
          p_role: CollabRole
        }
        Returns: void
      }
      search_notes: {
        Args: {
          p_query: string
          p_limit?: number
        }
        Returns: {
          id: string
          title: string
          snippet: string
          score: number
          updated_at: string
        }[]
      }
      get_folder_path: {
        Args: {
          p_folder_id: string
        }
        Returns: {
          id: string
          name: string
          depth: number
        }[]
      }
      ping: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_note_owner: {
        Args: {
          p_note_id: string
        }
        Returns: boolean
      }
      has_note_access: {
        Args: {
          p_note_id: string
          p_min?: CollabRole
        }
        Returns: boolean
      }
    }
    Enums: {
      collab_role: CollabRole
    }
  }
}
