export type UserRole = 'EMPLOYEE' | 'HR'
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT'
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'DECLINED'

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { name?: string }
        Relationships: []
      }
      profiles: {
        Row: { id: string; company_id: string | null; email: string; full_name: string; role: UserRole; job_title: string | null; department: string | null; employment_status: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE'; created_at: string; updated_at: string }
        Insert: { id: string; company_id?: string | null; email: string; full_name: string; role?: UserRole; job_title?: string | null; department?: string | null; employment_status?: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE'; created_at?: string; updated_at?: string }
        Update: { company_id?: string | null; email?: string; full_name?: string; role?: UserRole; job_title?: string | null; department?: string | null; employment_status?: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE'; updated_at?: string }
        Relationships: []
      }
      shift_config: {
        Row: { company_id: string; shift_start: string; shift_end: string; grace_minutes: number; late_penalty_points: number; max_daily_base: number; time_zone: string; working_days: number[]; updated_at: string; updated_by: string | null }
        Insert: { company_id: string; shift_start?: string; shift_end?: string; grace_minutes?: number; late_penalty_points?: number; max_daily_base?: number; time_zone?: string; working_days?: number[]; updated_at?: string; updated_by?: string | null }
        Update: { shift_start?: string; shift_end?: string; grace_minutes?: number; late_penalty_points?: number; max_daily_base?: number; time_zone?: string; working_days?: number[]; updated_at?: string; updated_by?: string | null }
        Relationships: []
      }
      attendance_logs: {
        Row: { id: string; company_id: string; user_id: string; date: string; checked_in_at: string; checked_out_at: string | null; status: AttendanceStatus; late_minutes: number; penalty_points: number; sheets_synced_at: string | null; sheets_sync_attempts: number; sheets_last_error: string | null; created_at: string }
        Insert: { id?: string; company_id: string; user_id: string; date: string; checked_in_at: string; checked_out_at?: string | null; status: AttendanceStatus; late_minutes?: number; penalty_points?: number; sheets_synced_at?: string | null; sheets_sync_attempts?: number; sheets_last_error?: string | null; created_at?: string }
        Update: { checked_out_at?: string | null; sheets_synced_at?: string | null; sheets_sync_attempts?: number; sheets_last_error?: string | null }
        Relationships: []
      }
      leave_requests: {
        Row: { id: string; company_id: string; user_id: string; leave_type: string; start_date: string; end_date: string; working_days: number; reason: string; status: LeaveStatus; reviewed_by: string | null; reviewed_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; company_id: string; user_id: string; leave_type: string; start_date: string; end_date: string; working_days: number; reason: string; status?: LeaveStatus; reviewed_by?: string | null; reviewed_at?: string | null; created_at?: string; updated_at?: string }
        Update: { status?: LeaveStatus; reviewed_by?: string | null; reviewed_at?: string | null; updated_at?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_my_attendance_score: { Args: Record<PropertyKey, never>; Returns: { total_working_days: number; absences: number; penalty_points: number; score_percent: number }[] }
      get_company_attendance_leaderboard: { Args: { p_as_of?: string | null }; Returns: { user_id: string; full_name: string; department: string | null; job_title: string | null; check_in_status: AttendanceStatus; checked_in_at: string | null; penalty_points: number; score_percent: number }[] }
    }
    Enums: { user_role: UserRole; attendance_status: AttendanceStatus; leave_status: LeaveStatus }
    CompositeTypes: Record<string, never>
  }
}