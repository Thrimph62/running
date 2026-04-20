// Supabase client + settings panel + data layer
// Loads Supabase UMD lazily; if not configured, app falls back to seed data.

const LS_URL = "pacelog-supabase-url";
const LS_KEY = "pacelog-supabase-key";

let supabase = null;
let supabaseReady = false;

function getSupabaseConfig() {
  // Priority: repo-level config.js (shared across devices) > localStorage (per-device override)
  const fileCfg = window.PACELOG_CONFIG || {};
  const fileUrl = (fileCfg.supabaseUrl || "").trim();
  const fileKey = (fileCfg.supabaseKey || "").trim();
  if (fileUrl && fileKey) {
    return { url: fileUrl, key: fileKey, source: "file" };
  }
  return {
    url: localStorage.getItem(LS_URL) || "",
    key: localStorage.getItem(LS_KEY) || "",
    source: "local",
  };
}

function saveSupabaseConfig(url, key) {
  localStorage.setItem(LS_URL, url);
  localStorage.setItem(LS_KEY, key);
}

function clearSupabaseConfig() {
  localStorage.removeItem(LS_URL);
  localStorage.removeItem(LS_KEY);
}

async function loadSupabaseLib() {
  if (window.supabase) return window.supabase;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.supabase;
}

async function initSupabase() {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    supabaseReady = false;
    return false;
  }
  try {
    const lib = await loadSupabaseLib();
    supabase = lib.createClient(url, key);
    supabaseReady = true;
    return true;
  } catch (e) {
    console.error("Supabase init failed", e);
    supabaseReady = false;
    return false;
  }
}

// ---- Data layer ----
// Shape expected by the app:
// runs: { id, date (Date), type, routeName, distance, duration, pace, paceStr, elevation, hr, cadence, splits, feel, vibe }
// goals: { id, title, target, current, unit, due, done }
// plan:  { id, date (Date), type, distance, desc, done }

async function fetchRuns() {
  if (!supabaseReady) return null;
  const { data, error } = await supabase.from("runs").select("*").order("date", { ascending: false });
  if (error) { console.error(error); return null; }
  return data.map((r) => ({
    id: r.id,
    date: new Date(r.date),
    type: r.type,
    routeName: r.route_name,
    vibe: r.vibe || "flat",
    distance: Number(r.distance),
    duration: r.duration,
    pace: r.pace,
    paceStr: secondsToPace(r.pace),
    elevation: r.elevation || 0,
    hr: r.hr || 0,
    cadence: r.cadence || 0,
    splits: r.splits || [],
    segments: r.segments || [],
    feel: r.feel || 3,
  }));
}

async function insertRun(run) {
  if (!supabaseReady) throw new Error("Supabase not configured");
  const payload = {
    date: run.date.toISOString(),
    type: run.type,
    route_name: run.routeName,
    distance: run.distance,
    duration: run.duration,
    pace: run.pace,
    elevation: run.elevation || 0,
    hr: run.hr || 0,
    cadence: run.cadence || 0,
    splits: run.splits || [],
    segments: run.segments || [],
    feel: run.feel || 3,
    vibe: run.vibe || "flat",
  };
  const { data, error } = await supabase.from("runs").insert(payload).select().single();
  if (error) throw error;
  return data;
}

async function updateRun(id, run) {
  if (!supabaseReady) return;
  await supabase.from("runs").update({
    date: run.date.toISOString(),
    type: run.type,
    route_name: run.routeName,
    distance: run.distance,
    duration: run.duration,
    pace: run.pace,
    elevation: run.elevation || 0,
    hr: run.hr || 0,
    cadence: run.cadence || 0,
    segments: run.segments || [],
    feel: run.feel || 3,
  }).eq("id", id);
}

async function deleteRun(id) {
  if (!supabaseReady) return;
  await supabase.from("runs").delete().eq("id", id);
}

async function fetchGoals() {
  if (!supabaseReady) return null;
  const { data, error } = await supabase.from("goals").select("*").order("created_at");
  if (error) { console.error(error); return null; }
  return data.map((g) => ({
    id: g.id,
    title: g.title,
    target: Number(g.target),
    current: Number(g.current),
    unit: g.unit,
    due: g.due || "",
    done: g.done,
  }));
}

async function updateGoalDone(id, done) {
  if (!supabaseReady) return;
  await supabase.from("goals").update({ done }).eq("id", id);
}

async function insertGoal(g) {
  if (!supabaseReady) throw new Error("Supabase not configured");
  const { data, error } = await supabase.from("goals").insert({
    title: g.title, target: g.target, current: g.current || 0,
    unit: g.unit || "km", due: g.due || "", done: !!g.done,
  }).select().single();
  if (error) throw error;
  return data;
}

async function updateGoal(id, g) {
  if (!supabaseReady) return;
  await supabase.from("goals").update({
    title: g.title, target: g.target, current: g.current,
    unit: g.unit, due: g.due, done: g.done,
  }).eq("id", id);
}

async function deleteGoal(id) {
  if (!supabaseReady) return;
  await supabase.from("goals").delete().eq("id", id);
}

async function fetchPlan() {
  if (!supabaseReady) return null;
  const { data, error } = await supabase.from("plan").select("*").order("date");
  if (error) { console.error(error); return null; }
  return data.map((p) => ({
    id: p.id,
    date: new Date(p.date),
    type: p.type,
    distance: Number(p.distance),
    desc: p.description || "",
    done: p.done,
  }));
}

async function updatePlanDone(id, done) {
  if (!supabaseReady) return;
  await supabase.from("plan").update({ done }).eq("id", id);
}

async function insertPlan(p) {
  if (!supabaseReady) throw new Error("Supabase not configured");
  const { data, error } = await supabase.from("plan").insert({
    date: p.date.toISOString(), type: p.type,
    distance: p.distance, description: p.desc || "", done: !!p.done,
  }).select().single();
  if (error) throw error;
  return data;
}

async function updatePlan(id, p) {
  if (!supabaseReady) return;
  await supabase.from("plan").update({
    date: p.date.toISOString(), type: p.type,
    distance: p.distance, description: p.desc, done: p.done,
  }).eq("id", id);
}

async function deletePlan(id) {
  if (!supabaseReady) return;
  await supabase.from("plan").delete().eq("id", id);
}

async function wipeAllData() {
  // Clear local caches
  try {
    ["pacelog-profile", "pacelog-tab", "pacelog-config-dismissed"].forEach((k) => localStorage.removeItem(k));
  } catch {}
  if (!supabaseReady) return true;
  // neq with an impossible UUID matches all rows
  const all = "00000000-0000-0000-0000-000000000000";
  await supabase.from("runs").delete().neq("id", all);
  await supabase.from("goals").delete().neq("id", all);
  await supabase.from("plan").delete().neq("id", all);
  await supabase.from("profile").update({
    name: "", tagline: "",
    pr_5k: null, pr_10k: null, pr_half: null,
  }).eq("id", 1);
  return true;
}

async function fetchProfile() {
  if (!supabaseReady) return null;
  const { data, error } = await supabase.from("profile").select("*").eq("id", 1).single();
  if (error) { console.error(error); return null; }
  return {
    name: data.name || "",
    tagline: data.tagline || "",
    pr5k: data.pr_5k || "",
    pr10k: data.pr_10k || "",
    prHalf: data.pr_half || "",
    memberSince: data.member_since || "",
  };
}

async function updateProfile(p) {
  if (!supabaseReady) return;
  await supabase.from("profile").update({
    name: p.name,
    tagline: p.tagline,
    pr_5k: p.pr5k,
    pr_10k: p.pr10k,
    pr_half: p.prHalf,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
}

Object.assign(window, {
  initSupabase, getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig,
  fetchRuns, insertRun, updateRun, deleteRun,
  fetchGoals, updateGoalDone, insertGoal, updateGoal, deleteGoal,
  fetchPlan, updatePlanDone, insertPlan, updatePlan, deletePlan,
  fetchProfile, updateProfile,
  wipeAllData,
  get supabaseReady() { return supabaseReady; },
});
