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
    feel: run.feel || 3,
    vibe: run.vibe || "flat",
  };
  const { data, error } = await supabase.from("runs").insert(payload).select().single();
  if (error) throw error;
  return data;
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

Object.assign(window, {
  initSupabase, getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig,
  fetchRuns, insertRun, fetchGoals, updateGoalDone, fetchPlan, updatePlanDone,
  get supabaseReady() { return supabaseReady; },
});
