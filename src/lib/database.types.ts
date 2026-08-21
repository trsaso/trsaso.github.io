/**
 * Database types for the QuarryProof AI schema.
 * Kept in sync with supabase/migrations/*.sql by hand; if you change the
 * schema, update this file (or regenerate with `supabase gen types typescript`).
 */

export type UserRole = "worker" | "supervisor" | "admin";
export type ReportStatus = "triage" | "converted" | "dismissed" | "escalated";
export type SeverityLevel = "low" | "medium" | "high" | "critical";
export type ActionStatus =
  | "open"
  | "in_progress"
  | "ready_for_verification"
  | "closed"
  | "cancelled";
export type ActionPriority = "low" | "medium" | "high" | "critical";
export type EvidenceKind = "photo" | "voice_note" | "document";
export type EvidencePhase = "before" | "after" | "general";
export type InspectionRunStatus = "in_progress" | "completed";
export type InspectionItemResult = "pass" | "fail" | "not_applicable";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_demo: boolean;
  created_at: string;
}

type SiteRow = {
  id: string;
  org_id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  created_at: string;
}

type SiteAreaRow = {
  id: string;
  site_id: string;
  name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

type ProfileRow = {
  id: string;
  org_id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

type CategoryRow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

type ReportRow = {
  id: string;
  org_id: string;
  site_id: string;
  area_id: string | null;
  reporter_id: string;
  status: ReportStatus;
  title: string;
  description: string | null;
  reporter_note: string | null;
  severity: SeverityLevel;
  category_id: string | null;
  immediate_action: string | null;
  suggested_role: UserRole | null;
  ai_assisted: boolean;
  ai_payload: Json | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

type ActionRow = {
  id: string;
  org_id: string;
  site_id: string;
  area_id: string | null;
  report_id: string | null;
  title: string;
  instructions: string | null;
  category_id: string | null;
  severity: SeverityLevel;
  priority: ActionPriority;
  status: ActionStatus;
  assignee_id: string | null;
  created_by: string;
  due_date: string | null;
  started_at: string | null;
  submitted_at: string | null;
  verified_by: string | null;
  closed_at: string | null;
  completion_note: string | null;
  cost_amount: number | null;
  cost_currency: string;
  downtime_minutes: number | null;
  created_at: string;
  updated_at: string;
}

type EvidenceRow = {
  id: string;
  org_id: string;
  report_id: string | null;
  action_id: string | null;
  kind: EvidenceKind;
  phase: EvidencePhase;
  storage_path: string;
  caption: string | null;
  uploaded_by: string;
  created_at: string;
}

type InspectionTemplateRow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

type InspectionTemplateItemRow = {
  id: string;
  template_id: string;
  prompt: string;
  guidance: string | null;
  sort_order: number;
  requires_photo_on_fail: boolean;
  created_at: string;
}

type InspectionRunRow = {
  id: string;
  org_id: string;
  site_id: string;
  template_id: string;
  inspector_id: string;
  status: InspectionRunStatus;
  notes: string | null;
  started_at: string;
  completed_at: string | null;
}

type InspectionRunItemRow = {
  id: string;
  run_id: string;
  template_item_id: string;
  result: InspectionItemResult | null;
  note: string | null;
  created_at: string;
}

type AuditEventRow = {
  id: string;
  org_id: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  detail: Json | null;
  created_at: string;
}

/** Makes columns with database defaults / nullables optional for inserts. */
type InsertOf<Row, Required extends keyof Row> = Pick<Row, Required> &
  Partial<Omit<Row, Required>>;

type TableDef<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      organizations: TableDef<
        OrganizationRow,
        InsertOf<OrganizationRow, "name" | "slug">
      >;
      sites: TableDef<SiteRow, InsertOf<SiteRow, "org_id" | "name" | "code">>;
      site_areas: TableDef<SiteAreaRow, InsertOf<SiteAreaRow, "site_id" | "name">>;
      profiles: TableDef<
        ProfileRow,
        InsertOf<ProfileRow, "id" | "org_id" | "full_name">
      >;
      categories: TableDef<CategoryRow, InsertOf<CategoryRow, "org_id" | "name">>;
      reports: TableDef<
        ReportRow,
        InsertOf<ReportRow, "org_id" | "site_id" | "reporter_id" | "title">
      >;
      actions: TableDef<
        ActionRow,
        InsertOf<ActionRow, "org_id" | "site_id" | "created_by" | "title">
      >;
      evidence: TableDef<
        EvidenceRow,
        InsertOf<EvidenceRow, "org_id" | "storage_path" | "uploaded_by">
      >;
      inspection_templates: TableDef<
        InspectionTemplateRow,
        InsertOf<InspectionTemplateRow, "org_id" | "name">
      >;
      inspection_template_items: TableDef<
        InspectionTemplateItemRow,
        InsertOf<InspectionTemplateItemRow, "template_id" | "prompt">
      >;
      inspection_runs: TableDef<
        InspectionRunRow,
        InsertOf<
          InspectionRunRow,
          "org_id" | "site_id" | "template_id" | "inspector_id"
        >
      >;
      inspection_run_items: TableDef<
        InspectionRunItemRow,
        InsertOf<InspectionRunItemRow, "run_id" | "template_item_id">
      >;
      audit_events: TableDef<
        AuditEventRow,
        InsertOf<AuditEventRow, "org_id" | "entity_type" | "entity_id" | "event_type">
      >;
    };
    Views: Record<string, never>;
    Functions: {
      onboard_organization: {
        Args: {
          p_org_name: string;
          p_org_slug: string;
          p_full_name: string;
          p_site_name: string;
          p_site_code: string;
        };
        Returns: string;
      };
      current_org_id: { Args: Record<string, never>; Returns: string };
      current_user_role: { Args: Record<string, never>; Returns: UserRole };
      is_supervisor_or_admin: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      report_status: ReportStatus;
      severity_level: SeverityLevel;
      action_status: ActionStatus;
      action_priority: ActionPriority;
      evidence_kind: EvidenceKind;
      evidence_phase: EvidencePhase;
      inspection_run_status: InspectionRunStatus;
      inspection_item_result: InspectionItemResult;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Profile = Tables<"profiles">;
export type Organization = Tables<"organizations">;
export type Site = Tables<"sites">;
