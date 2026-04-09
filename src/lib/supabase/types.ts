export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "doctor" | "staff" | "admin";
export type ConsultationStatus = "scheduled" | "active" | "completed" | "draft" | "cancelled";
export type DiagnosisConfidence = "high" | "medium" | "low" | "ai_suggested";
export type DiagnosisAddedBy = "ai" | "doctor";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          role: UserRole;
          name: string | null;
          specialization: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role?: UserRole;
          name?: string | null;
          specialization?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: UserRole;
          name?: string | null;
          specialization?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      patients: {
        Row: {
          id: string;
          name: string;
          dob: string | null;
          gender: string | null;
          blood_group: string | null;
          phone: string | null;
          abha_id: string | null;
          allergies: string[] | null;
          chronic_conditions: string[] | null;
          address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          dob?: string | null;
          gender?: string | null;
          blood_group?: string | null;
          phone?: string | null;
          abha_id?: string | null;
          allergies?: string[] | null;
          chronic_conditions?: string[] | null;
          address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          dob?: string | null;
          gender?: string | null;
          blood_group?: string | null;
          phone?: string | null;
          abha_id?: string | null;
          allergies?: string[] | null;
          chronic_conditions?: string[] | null;
          address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      consultations: {
        Row: {
          id: string;
          doctor_id: string;
          patient_id: string;
          type: string | null;
          status: ConsultationStatus;
          started_at: string | null;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          doctor_id: string;
          patient_id: string;
          type?: string | null;
          status?: ConsultationStatus;
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          doctor_id?: string;
          patient_id?: string;
          type?: string | null;
          status?: ConsultationStatus;
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      transcripts: {
        Row: {
          id: string;
          consultation_id: string;
          raw_text: string | null;
          segments: Json | null;
          processing_status: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          consultation_id: string;
          raw_text?: string | null;
          segments?: Json | null;
          processing_status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          consultation_id?: string;
          raw_text?: string | null;
          segments?: Json | null;
          processing_status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      emr_entries: {
        Row: {
          id: string;
          consultation_id: string;
          chief_complaint: string | null;
          symptoms: string[] | null;
          assessment: string | null;
          clinical_summary: string | null;
          requires_review: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          consultation_id: string;
          chief_complaint?: string | null;
          symptoms?: string[] | null;
          assessment?: string | null;
          clinical_summary?: string | null;
          requires_review?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          consultation_id?: string;
          chief_complaint?: string | null;
          symptoms?: string[] | null;
          assessment?: string | null;
          clinical_summary?: string | null;
          requires_review?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      emr_diagnoses: {
        Row: {
          id: string;
          emr_entry_id: string;
          icd_code_id: string | null;
          diagnosis_text: string | null;
          is_primary: boolean;
          confidence: DiagnosisConfidence;
          added_by: DiagnosisAddedBy;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          emr_entry_id: string;
          icd_code_id?: string | null;
          diagnosis_text?: string | null;
          is_primary?: boolean;
          confidence?: DiagnosisConfidence;
          added_by?: DiagnosisAddedBy;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          emr_entry_id?: string;
          icd_code_id?: string | null;
          diagnosis_text?: string | null;
          is_primary?: boolean;
          confidence?: DiagnosisConfidence;
          added_by?: DiagnosisAddedBy;
          created_at?: string;
          updated_at?: string;
        };
      };
      icd10_codes: {
        Row: {
          id: string;
          code: string;
          description: string;
          category: string | null;
          chapter: string | null;
          is_billable: boolean | null;
          parent_code: string | null;
          is_common: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          description: string;
          category?: string | null;
          chapter?: string | null;
          is_billable?: boolean | null;
          parent_code?: string | null;
          is_common?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          description?: string;
          category?: string | null;
          chapter?: string | null;
          is_billable?: boolean | null;
          parent_code?: string | null;
          is_common?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      prescriptions: {
        Row: {
          id: string;
          consultation_id: string;
          medications: Json | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          consultation_id: string;
          medications?: Json | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          consultation_id?: string;
          medications?: Json | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      safety_alerts: {
        Row: {
          id: string;
          consultation_id: string | null;
          alert_type: string;
          severity: string;
          message: string;
          acknowledged: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          consultation_id?: string | null;
          alert_type: string;
          severity: string;
          message: string;
          acknowledged?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          consultation_id?: string | null;
          alert_type?: string;
          severity?: string;
          message?: string;
          acknowledged?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      audit_log: {
        Row: {
          id: string;
          actor_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_icd10: {
        Args: {
          query_text: string;
          result_limit?: number;
        };
        Returns: {
          id: string;
          code: string;
          description: string;
          category: string | null;
          chapter: string | null;
          is_billable: boolean | null;
          parent_code: string | null;
          is_common: boolean;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
