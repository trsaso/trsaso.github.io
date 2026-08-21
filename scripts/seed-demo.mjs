/**
 * QuarryProof AI — DEMO SEED SCRIPT
 * ---------------------------------
 * Creates the clearly-labeled demo organization "Pelagonia Marble Demo"
 * with demo users, sites, areas, categories, an inspection template, and a
 * few sample reports/actions so dashboards have something to show.
 *
 * This is DEMO DATA ONLY. It never runs as part of the app; you invoke it
 * explicitly with a Supabase service-role key:
 *
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   npm run seed:demo
 *
 * Demo logins (password for all: QuarryDemo!2026):
 *   admin@pelagonia-demo.test      (Admin)
 *   supervisor@pelagonia-demo.test (Supervisor)
 *   worker@pelagonia-demo.test     (Worker)
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing env. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PASSWORD = "QuarryDemo!2026";
const DEMO_SLUG = "pelagonia-marble-demo";

async function ensureUser(email, fullName) {
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (!error) return created.user.id;
  // Already exists → look it up.
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email === email);
  if (!existing) throw error;
  return existing.id;
}

async function main() {
  console.log("Seeding Pelagonia Marble Demo…");

  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", DEMO_SLUG)
    .maybeSingle();
  if (existingOrg) {
    console.log("Demo organization already exists — nothing to do.");
    console.log("Delete it first if you want a fresh seed.");
    return;
  }

  const adminId = await ensureUser("admin@pelagonia-demo.test", "Ana Trajkovska");
  const supervisorId = await ensureUser(
    "supervisor@pelagonia-demo.test",
    "Goran Stojanov"
  );
  const workerId = await ensureUser("worker@pelagonia-demo.test", "Blagoj Petrov");

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({ name: "Pelagonia Marble Demo", slug: DEMO_SLUG, is_demo: true })
    .select("id")
    .single();
  if (orgErr) throw orgErr;
  const orgId = org.id;

  const { error: profErr } = await supabase.from("profiles").insert([
    { id: adminId, org_id: orgId, full_name: "Ana Trajkovska", role: "admin" },
    { id: supervisorId, org_id: orgId, full_name: "Goran Stojanov", role: "supervisor" },
    { id: workerId, org_id: orgId, full_name: "Blagoj Petrov", role: "worker" },
  ]);
  if (profErr) throw profErr;

  const { data: sites, error: siteErr } = await supabase
    .from("sites")
    .insert([
      {
        org_id: orgId,
        name: "Sivec White Marble Quarry",
        code: "SIVEC",
        description: "Open-pit dimension-stone quarry, benches 1–6",
      },
      {
        org_id: orgId,
        name: "Prilep Processing Plant",
        code: "PLANT",
        description: "Gang saws, polishing lines, slab yard",
      },
    ])
    .select("id, code");
  if (siteErr) throw siteErr;
  const quarry = sites.find((s) => s.code === "SIVEC");
  const plant = sites.find((s) => s.code === "PLANT");

  const { data: areas, error: areaErr } = await supabase
    .from("site_areas")
    .insert([
      { site_id: quarry.id, name: "Bench 3 — East Face", sort_order: 1 },
      { site_id: quarry.id, name: "Bench 5 — Wire Saw Station", sort_order: 2 },
      { site_id: quarry.id, name: "Haul Road A", sort_order: 3 },
      { site_id: quarry.id, name: "Block Yard", sort_order: 4 },
      { site_id: plant.id, name: "Gang Saw Hall", sort_order: 1 },
      { site_id: plant.id, name: "Polishing Line 2", sort_order: 2 },
      { site_id: plant.id, name: "Slab Yard & Gantry Crane", sort_order: 3 },
    ])
    .select("id, name");
  if (areaErr) throw areaErr;
  const areaByName = Object.fromEntries(areas.map((a) => [a.name, a.id]));

  const { data: cats, error: catErr } = await supabase
    .from("categories")
    .insert(
      [
        ["Highwall & Bench Stability", "Cracks, overhangs, loose blocks, bench crest damage", 1],
        ["Blasting & Explosives", "Misfires, flyrock, exclusion zone breaches", 2],
        ["Mobile Plant & Haulage", "Excavators, loaders, dumpers, haul road defects", 3],
        ["Fixed Plant & Crushers", "Crushers, screens, conveyors, gang saws, wire saws", 4],
        ["Electrical & Isolation", "Cables, switchgear, lock-out/tag-out issues", 5],
        ["Water & Slurry Management", "Sump pumps, settling ponds, slurry lines", 6],
        ["Dust & Ventilation", "Silica dust suppression, sprays, extraction", 7],
        ["PPE & Housekeeping", "Missing PPE, blocked walkways, spills, signage", 8],
        ["Lifting & Cranes", "Slings, block handling, overhead crane defects", 9],
        ["Other Hazard", "Anything not covered by another category", 99],
      ].map(([name, description, sort_order]) => ({
        org_id: orgId,
        name,
        description,
        sort_order,
      }))
    )
    .select("id, name");
  if (catErr) throw catErr;
  const catByName = Object.fromEntries(cats.map((c) => [c.name, c.id]));

  const { data: template, error: tplErr } = await supabase
    .from("inspection_templates")
    .insert({
      org_id: orgId,
      name: "Daily Quarry Start-of-Shift Inspection",
      description: "Walkaround before first blast/extraction of the shift",
      created_by: adminId,
    })
    .select("id")
    .single();
  if (tplErr) throw tplErr;

  const { error: tplItemsErr } = await supabase.from("inspection_template_items").insert(
    [
      ["Highwall and bench faces free of new cracks, overhangs, or loose blocks", 1],
      ["Haul roads graded, berms intact, no standing water in travel lanes", 2],
      ["Wire saw stations: guards fitted, water feed working, cable condition OK", 3],
      ["Mobile plant pre-start checks completed and logged", 4],
      ["Blast exclusion zone signage and barriers in place", 5],
      ["Dust suppression sprays operational at crusher and transfer points", 6],
      ["Emergency stops and isolation points accessible and tagged", 7],
      ["First-aid stations stocked and access routes clear", 8],
    ].map(([prompt, sort_order]) => ({
      template_id: template.id,
      prompt,
      sort_order,
      requires_photo_on_fail: true,
    }))
  );
  if (tplItemsErr) throw tplItemsErr;

  // Sample operational records so dashboards/lists are not empty. Demo only.
  const { data: reports, error: repErr } = await supabase
    .from("reports")
    .insert([
      {
        org_id: orgId,
        site_id: quarry.id,
        area_id: areaByName["Bench 3 — East Face"],
        reporter_id: workerId,
        status: "triage",
        title: "Fresh crack above Bench 3 east face",
        reporter_note:
          "Noticed a new hairline crack about 4 m above the working face after yesterday's rain.",
        severity: "high",
        category_id: catByName["Highwall & Bench Stability"],
        ai_assisted: false,
      },
      {
        org_id: orgId,
        site_id: plant.id,
        area_id: areaByName["Gang Saw Hall"],
        reporter_id: workerId,
        status: "converted",
        title: "Gang saw 2 blade tension warning light on",
        reporter_note: "Warning light stayed on through the whole cut.",
        severity: "medium",
        category_id: catByName["Fixed Plant & Crushers"],
        ai_assisted: false,
        reviewed_by: supervisorId,
        reviewed_at: new Date(Date.now() - 2 * 86400e3).toISOString(),
      },
    ])
    .select("id, title");
  if (repErr) throw repErr;

  const convertedReport = reports.find((r) => r.title.startsWith("Gang saw"));
  const { data: action, error: actErr } = await supabase
    .from("actions")
    .insert({
      org_id: orgId,
      site_id: plant.id,
      area_id: areaByName["Gang Saw Hall"],
      report_id: convertedReport.id,
      title: "Inspect and re-tension gang saw 2 blades",
      instructions:
        "Isolate gang saw 2 (LOTO), check blade tensioning hydraulics, re-tension to spec, test-run empty before releasing to production.",
      category_id: catByName["Fixed Plant & Crushers"],
      severity: "medium",
      priority: "high",
      status: "in_progress",
      assignee_id: workerId,
      created_by: supervisorId,
      due_date: new Date(Date.now() + 3 * 86400e3).toISOString().slice(0, 10),
      started_at: new Date(Date.now() - 1 * 86400e3).toISOString(),
    })
    .select("id")
    .single();
  if (actErr) throw actErr;

  const { error: auditErr } = await supabase.from("audit_events").insert([
    {
      org_id: orgId,
      entity_type: "organization",
      entity_id: orgId,
      actor_id: adminId,
      event_type: "organization_created",
      detail: { name: "Pelagonia Marble Demo", demo: true },
    },
    {
      org_id: orgId,
      entity_type: "report",
      entity_id: convertedReport.id,
      actor_id: supervisorId,
      event_type: "report_converted",
      from_status: "triage",
      to_status: "converted",
      detail: { action_id: action.id },
    },
    {
      org_id: orgId,
      entity_type: "action",
      entity_id: action.id,
      actor_id: workerId,
      event_type: "action_status_changed",
      from_status: "open",
      to_status: "in_progress",
    },
  ]);
  if (auditErr) throw auditErr;

  console.log("Done. Demo organization seeded.");
  console.log("Logins (password: %s):", DEMO_PASSWORD);
  console.log("  admin@pelagonia-demo.test");
  console.log("  supervisor@pelagonia-demo.test");
  console.log("  worker@pelagonia-demo.test");
}

main().catch((err) => {
  console.error("Seed failed:", err.message ?? err);
  process.exit(1);
});
