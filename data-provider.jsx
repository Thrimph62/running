// Data context — provides runs/goals/plan and mutation fns to the rest of the app.
// Prefers Supabase if configured, otherwise falls back to seed data.

const DataCtx = React.createContext(null);

// Error boundary so a render crash shows a message instead of a black page
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error("UI crash:", err, info); }
  render() {
    if (this.state.err) {
      return React.createElement("div", {
        style: { padding: 32, color: "#ff9c88", fontFamily: "JetBrains Mono, monospace", maxWidth: 640, margin: "40px auto" }
      },
        React.createElement("div", { style: { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "#888" } }, "Something crashed"),
        React.createElement("h2", { style: { fontSize: 22, margin: "8px 0 16px", color: "#fff" } }, "The app hit an error"),
        React.createElement("pre", { style: { background: "#1a1a1a", padding: 16, borderRadius: 8, fontSize: 12, overflow: "auto", color: "#ff9c88", whiteSpace: "pre-wrap" } }, String(this.state.err?.stack || this.state.err)),
        React.createElement("button", {
          onClick: () => { this.setState({ err: null }); location.reload(); },
          style: { marginTop: 16, padding: "10px 20px", background: "#d4ff3a", color: "#000", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }
        }, "Reload page")
      );
    }
    return this.props.children;
  }
}

function useData() {
  return React.useContext(DataCtx);
}

function DataProvider({ children }) {
  const [mode, setMode] = React.useState("loading"); // loading | supabase | unconfigured
  const [runs, setRuns] = React.useState([]);
  const [goals, setGoals] = React.useState([]);
  const [plan, setPlan] = React.useState([]);
  const [profile, setProfile] = React.useState({
    name: "", tagline: "", pr5k: "", pr10k: "", prHalf: "", memberSince: "", customAchs: [],
  });
  const [configOpen, setConfigOpen] = React.useState(false);

  const reload = React.useCallback(async () => {
    const ok = await initSupabase();
    if (!ok) {
      setMode("unconfigured");
      setRuns([]); setGoals([]); setPlan([]);
      setProfile({ name: "", tagline: "", pr5k: "", pr10k: "", prHalf: "", memberSince: "", customAchs: [] });
      return;
    }
    const [r, g, p, pr] = await Promise.all([fetchRuns(), fetchGoals(), fetchPlan(), fetchProfile()]);
    setRuns(r || []);
    setGoals(g || []);
    setPlan(p || []);
    if (pr) setProfile(pr);
    setMode("supabase");
  }, []);

  const saveProfile = async (p) => {
    setProfile(p); // optimistic local update
    if (mode === "supabase") {
      try {
        await updateProfile(p);
        // Re-fetch to confirm what was actually stored
        const fresh = await fetchProfile();
        if (fresh) setProfile(fresh);
      } catch (err) {
        console.error("Could not save profile:", err);
        alert("Could not save profile: " + (err?.message || err));
      }
    }
  };

  React.useEffect(() => { reload(); }, [reload]);

  const addRun = async (run) => {
    if (mode !== "supabase") return;
    await insertRun(run);
    const fresh = await fetchRuns();
    if (fresh) setRuns(fresh);
  };

  const editRun = async (id, run) => {
    if (mode !== "supabase") return;
    await updateRun(id, run);
    const fresh = await fetchRuns();
    if (fresh) setRuns(fresh);
  };

  const removeRun = async (id) => {
    if (mode !== "supabase") return;
    await deleteRun(id);
    const fresh = await fetchRuns();
    if (fresh) setRuns(fresh);
  };

  const toggleGoal = async (id) => {
    if (mode !== "supabase") return;
    const g = goals.find((x) => x.id === id);
    if (!g) return;
    setGoals((gs) => gs.map((x) => x.id === id ? { ...x, done: !x.done } : x));
    await updateGoalDone(id, !g.done);
  };

  const addGoal = async (g) => {
    if (mode !== "supabase") return;
    await insertGoal(g);
    const fresh = await fetchGoals();
    if (fresh) setGoals(fresh);
  };

  const editGoal = async (id, g) => {
    if (mode !== "supabase") return;
    await updateGoal(id, g);
    const fresh = await fetchGoals();
    if (fresh) setGoals(fresh);
  };

  const removeGoal = async (id) => {
    if (mode !== "supabase") return;
    await deleteGoal(id);
    const fresh = await fetchGoals();
    if (fresh) setGoals(fresh);
  };

  const togglePlan = async (id) => {
    if (mode !== "supabase") return;
    const p = plan.find((x) => x.id === id);
    if (!p) return;
    setPlan((ps) => ps.map((x) => x.id === id ? { ...x, done: !x.done } : x));
    await updatePlanDone(id, !p.done);
  };

  const addPlan = async (p) => {
    if (mode !== "supabase") return;
    await insertPlan(p);
    const fresh = await fetchPlan();
    if (fresh) setPlan(fresh);
  };

  const editPlan = async (id, p) => {
    if (mode !== "supabase") return;
    await updatePlan(id, p);
    const fresh = await fetchPlan();
    if (fresh) setPlan(fresh);
  };

  const removePlan = async (id) => {
    if (mode !== "supabase") return;
    await deletePlan(id);
    const fresh = await fetchPlan();
    if (fresh) setPlan(fresh);
  };

  const resetAll = async () => {
    await wipeAllData();
    setRuns([]); setGoals([]); setPlan([]);
    setProfile({ name: "", tagline: "", pr5k: "", pr10k: "", prHalf: "", memberSince: "", customAchs: [] });
  };

  return (
    <DataCtx.Provider value={{
      mode, runs, goals, plan, profile, saveProfile,
      addRun, editRun, removeRun,
      toggleGoal, addGoal, editGoal, removeGoal,
      togglePlan, addPlan, editPlan, removePlan,
      reload, resetAll, configOpen, setConfigOpen,
    }}>
      {children}
    </DataCtx.Provider>
  );
}

// --- Config panel: paste Supabase URL + anon key ---
function ConfigPanel({ open, onClose, onSaved }) {
  const { resetAll } = useData();
  const initial = getSupabaseConfig();
  const [url, setUrl] = React.useState(initial.url);
  const [key, setKey] = React.useState(initial.key);
  const [status, setStatus] = React.useState("");
  const [wiping, setWiping] = React.useState(false);

  if (!open) return null;

  const save = async () => {
    setStatus("Connecting...");
    saveSupabaseConfig(url.trim(), key.trim());
    const ok = await initSupabase();
    if (ok) {
      setStatus("Connected ✓");
      setTimeout(() => { onSaved(); onClose(); }, 400);
    } else {
      setStatus("Could not connect. Check the URL and key.");
    }
  };

  const handleWipe = async () => {
    const msg = "Erase ALL runs, goals, plan items, and profile info?\n\nThis cannot be undone. If you're connected to Supabase, rows will be deleted there too.";
    if (!confirm(msg)) return;
    setWiping(true);
    setStatus("Erasing everything…");
    await resetAll();
    setStatus("All data cleared. Starting fresh.");
    setWiping(false);
    setTimeout(() => { onClose(); }, 600);
  };

  const disconnect = () => {
    clearSupabaseConfig();
    setUrl(""); setKey("");
    setStatus("Disconnected — connect to sync.");
    setTimeout(() => { onSaved(); onClose(); }, 400);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 300,
    }} onClick={onClose}>
      <div style={{
        width: 540, maxWidth: "92vw",
        background: "var(--bg-1)", border: "1px solid var(--line)",
        borderRadius: 16, padding: 32,
      }} onClick={(e) => e.stopPropagation()}>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Sync settings
        </div>
        <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 26, letterSpacing: "-0.03em", margin: "6px 0 8px" }}>
          Connect to Supabase
        </h2>
        <p style={{ color: "var(--text-2)", fontSize: 13, lineHeight: 1.5, marginTop: 0 }}>
          Paste your project URL and anon key from <span className="mono" style={{ color: "var(--text)" }}>supabase.com → Settings → API</span>.
          Stored locally on this device only. Do this once per device.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
          <label>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Project URL</div>
            <input value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xxxxx.supabase.co"
              style={inputStyle} />
          </label>
          <label>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Anon public key</div>
            <input value={key} onChange={(e) => setKey(e.target.value)}
              placeholder="eyJhbGci..."
              style={inputStyle} />
          </label>
        </div>

        {status && (
          <div className="mono" style={{ fontSize: 12, color: "var(--text-2)", marginTop: 12 }}>{status}</div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn ghost" style={{ color: "var(--danger)" }} onClick={handleWipe} disabled={wiping}>
            {wiping ? "Erasing…" : "Start fresh — erase all data"}
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn ghost" onClick={disconnect}>Disconnect</button>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn" onClick={save}>Save & connect</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "var(--bg-2)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "var(--text)",
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 13,
  outline: "none",
};

// --- Segment helpers ---
function parseDurationStr(s) {
  if (!s) return 0;
  const parts = String(s).trim().split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 1) return parts[0]; // seconds
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function formatDurationStr(sec) {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function segmentTotals(segments) {
  let dist = 0, dur = 0;
  for (const s of segments) {
    const d = parseFloat(s.distance) || 0;
    const t = parseDurationStr(s.duration);
    dist += d; dur += t;
  }
  return {
    distance: +dist.toFixed(2),
    duration: dur,
    pace: dist > 0 ? Math.round(dur / dist) : 0,
  };
}

function paceToSpeed(paceSecPerKm) {
  if (!paceSecPerKm) return 0;
  return +(3600 / paceSecPerKm).toFixed(1);
}

// Compute the missing field from the other two.
// mode: "distance" = compute distance from duration + speed
//       "duration" = compute duration from distance + speed
//       "speed"    = compute speed from distance + duration (default, display only)
// Returns { distance, duration, speed } as strings ready for inputs.
function deriveFromTwo(form, mode) {
  const d = parseFloat(form.distance);
  const t = parseDurationStr(form.duration);
  const s = parseFloat(form.speed);
  if (mode === "distance" && t > 0 && s > 0) {
    const dist = s * (t / 3600);
    return { ...form, distance: dist.toFixed(2) };
  }
  if (mode === "duration" && d > 0 && s > 0) {
    const dur = Math.round((d / s) * 3600);
    return { ...form, duration: formatDurationStr(dur) };
  }
  if (mode === "speed" && d > 0 && t > 0) {
    const spd = d / (t / 3600);
    return { ...form, speed: spd.toFixed(2) };
  }
  return form;
}

// After the user edited `editedKey`, pick the right computeMode based on which
// two fields now have values. Rule: auto-compute the field that is still empty,
// or the field the user is NOT currently editing if all three have values.
function chooseMode(next, editedKey) {
  const filled = {
    distance: parseFloat(next.distance) > 0,
    duration: parseDurationStr(next.duration) > 0,
    speed: parseFloat(next.speed) > 0,
  };
  const keys = ["distance", "duration", "speed"];
  const empty = keys.filter((k) => !filled[k]);
  if (empty.length === 1) return empty[0];
  if (empty.length === 0) {
    // All three filled — auto-compute whichever isn't the edited one and isn't
    // the current mode, falling back to "speed".
    const candidate = keys.find((k) => k !== editedKey && k !== next.computeMode) || "speed";
    return candidate;
  }
  // 2+ empty → keep current mode (nothing to derive yet)
  return next.computeMode;
}

// High-level helper: apply an edit to a {distance, duration, speed, computeMode}
// object, picking the right mode automatically and deriving the missing field.
function applyEdit(obj, key, value) {
  const next = { ...obj, [key]: value };
  if (key !== "distance" && key !== "duration" && key !== "speed") return next;
  const mode = chooseMode(next, key);
  next.computeMode = mode;
  return deriveFromTwo(next, mode);
}

// --- Add/edit run form ---
function AddRunModal({ open, onClose, onAdd, onEdit, onDelete, editing }) {
  const isEdit = !!editing;
  const [form, setForm] = React.useState({
    date: new Date().toISOString().slice(0, 10),
    type: "Easy",
    routeName: "",
    distance: "",
    duration: "",
    speed: "",
    computeMode: "speed", // which field is auto-derived
    elevation: "",
    hr: "",
    cadence: "",
    feel: 3,
    segments: [],
  });

  React.useEffect(() => {
    if (editing) {
      setForm({
        date: editing.date.toISOString().slice(0, 10),
        type: editing.type,
        routeName: editing.routeName,
        distance: String(editing.distance),
        duration: formatDurationStr(editing.duration),
        speed: editing.distance && editing.duration
          ? (editing.distance / (editing.duration / 3600)).toFixed(2) : "",
        computeMode: "speed",
        elevation: String(editing.elevation || ""),
        hr: String(editing.hr || ""),
        cadence: String(editing.cadence || ""),
        feel: editing.feel || 3,
        segments: (editing.segments || []).map((s) => ({
          distance: String(s.distance || ""),
          duration: formatDurationStr(s.duration || 0),
          speed: s.distance && s.duration
            ? (s.distance / (s.duration / 3600)).toFixed(2) : "",
          computeMode: "speed",
          note: s.note || "",
        })),
      });
    } else if (open) {
      setForm({
        date: new Date().toISOString().slice(0, 10),
        type: "Easy", routeName: "", distance: "", duration: "", speed: "",
        computeMode: "speed",
        elevation: "", hr: "", cadence: "", feel: 3, segments: [],
      });
    }
  }, [editing, open]);

  // Repeat block: user defines two "halves" (high + low) and a rep count.
  // Pressing Add appends `rep × [high, low]` segments.
  // NOTE: must be declared before the early return to satisfy the Rules of Hooks.
  const [repeat, setRepeat] = React.useState({
    reps: 5,
    high: { distance: "", duration: "", speed: "", computeMode: "speed", note: "work" },
    low:  { distance: "", duration: "", speed: "", computeMode: "speed", note: "rest" },
  });

  if (!open) return null;

  // Any edit to distance/duration/speed runs through applyEdit which picks the
  // right computeMode (fills in the empty field when possible) and derives it.
  const upd = (k, v) => setForm((f) => applyEdit(f, k, v));

  const setComputeMode = (mode) => setForm((f) => deriveFromTwo({ ...f, computeMode: mode }, mode));

  const hasSegments = form.segments.length > 0;
  const segTotals = hasSegments ? segmentTotals(form.segments) : null;

  const blankSeg = () => ({ distance: "", duration: "", speed: "", computeMode: "speed", note: "" });

  const addSegment = () => setForm((f) => ({ ...f, segments: [...f.segments, blankSeg()] }));
  const removeSegment = (i) => setForm((f) => ({
    ...f,
    segments: f.segments.filter((_, idx) => idx !== i),
  }));
  const updSegment = (i, k, v) => setForm((f) => ({
    ...f,
    segments: f.segments.map((s, idx) => idx === i ? applyEdit(s, k, v) : s),
  }));
  const setSegMode = (i, mode) => setForm((f) => ({
    ...f,
    segments: f.segments.map((s, idx) => idx === i ? deriveFromTwo({ ...s, computeMode: mode }, mode) : s),
  }));

  const updRepeat = (half, k, v) => setRepeat((r) => {
    if (k === "computeMode") {
      return { ...r, [half]: deriveFromTwo({ ...r[half], computeMode: v }, v) };
    }
    return { ...r, [half]: applyEdit(r[half], k, v) };
  });
  const addRepeatBlock = () => {
    const reps = Math.max(1, parseInt(repeat.reps) || 1);
    // Resolve each half (so speed-based entries become distance+duration in the list)
    const high = deriveFromTwo(repeat.high, repeat.high.computeMode);
    const low = deriveFromTwo(repeat.low, repeat.low.computeMode);
    const highOk = parseFloat(high.distance) > 0 && parseDurationStr(high.duration) > 0;
    const lowOk = parseFloat(low.distance) > 0 && parseDurationStr(low.duration) > 0;
    if (!highOk && !lowOk) return;
    const toAdd = [];
    for (let i = 0; i < reps; i++) {
      if (highOk) toAdd.push({ ...high });
      if (lowOk) toAdd.push({ ...low });
    }
    setForm((f) => ({ ...f, segments: [...f.segments, ...toAdd] }));
  };

  const submit = async (e) => {
    e.preventDefault();
    let dist, dur, segments = [];
    if (hasSegments) {
      segments = form.segments
        .map((s) => {
          // Ensure distance + duration are filled (resolve from speed if needed)
          const resolved = deriveFromTwo(s, s.computeMode);
          return {
            distance: parseFloat(resolved.distance) || 0,
            duration: parseDurationStr(resolved.duration),
            note: s.note || "",
          };
        })
        .filter((s) => s.distance > 0 && s.duration > 0)
        .map((s) => ({ ...s, pace: Math.round(s.duration / s.distance) }));
      if (segments.length === 0) return;
      const t = segmentTotals(segments.map((s) => ({ distance: s.distance, duration: s.duration })));
      dist = t.distance; dur = t.duration;
    } else {
      const resolved = deriveFromTwo(form, form.computeMode);
      dist = parseFloat(resolved.distance);
      dur = parseDurationStr(resolved.duration);
    }
    if (!dist || !dur || !form.routeName) return;
    const pace = Math.round(dur / dist);
    const run = {
      date: new Date(form.date),
      type: form.type,
      routeName: form.routeName,
      distance: +dist.toFixed(2),
      duration: dur,
      pace,
      elevation: parseInt(form.elevation) || 0,
      hr: parseInt(form.hr) || 0,
      cadence: parseInt(form.cadence) || 0,
      splits: editing?.splits || [],
      segments,
      feel: form.feel,
      vibe: editing?.vibe || "flat",
    };
    if (isEdit) await onEdit(editing.id, run);
    else {
      try { await onAdd(run); }
      catch (err) {
        console.error("Could not save run:", err);
        alert("Could not save: " + (err?.message || err));
        return;
      }
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm(`Delete "${editing.routeName}" on ${editing.date.toLocaleDateString()}?`)) return;
    try { await onDelete(editing.id); } catch (err) { alert("Could not delete: " + (err?.message || err)); return; }
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 300,
    }} onClick={onClose}>
      <form onSubmit={submit} style={{
        width: 640, maxWidth: "92vw", maxHeight: "90vh", overflow: "auto",
        background: "var(--bg-1)", border: "1px solid var(--line)",
        borderRadius: 16, padding: 32,
      }} onClick={(e) => e.stopPropagation()}>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          {isEdit ? "Edit run" : "New run"}
        </div>
        <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 26, letterSpacing: "-0.03em", margin: "6px 0 20px" }}>
          {isEdit ? "Edit run" : "Log a run"}
        </h2>

        <div className="grid g-2" style={{ gap: 12 }}>
          <Field label="Date">
            <input type="date" value={form.date} onChange={(e) => upd("date", e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={(e) => upd("type", e.target.value)} style={inputStyle}>
              {["Easy", "Tempo", "Long", "Intervals", "Recovery", "Race"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Route name" span>
            <input value={form.routeName} onChange={(e) => upd("routeName", e.target.value)} placeholder="Riverside Loop" style={inputStyle} />
          </Field>
          {!hasSegments && (
            <div style={{ gridColumn: "span 2" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
                Distance · Duration · Speed
                <span style={{ marginLeft: 10, color: "var(--text-2)", textTransform: "none", letterSpacing: 0, fontSize: 11 }}>
                  enter any two, third auto-fills
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <ComputeField
                  mode="distance" currentMode={form.computeMode} onPickMode={setComputeMode}
                  label="km" placeholder="5.2"
                  value={form.distance} onChange={(v) => upd("distance", v)} />
                <ComputeField
                  mode="duration" currentMode={form.computeMode} onPickMode={setComputeMode}
                  label="mm:ss" placeholder="26:30"
                  value={form.duration} onChange={(v) => upd("duration", v)} />
                <ComputeField
                  mode="speed" currentMode={form.computeMode} onPickMode={setComputeMode}
                  label="km/h" placeholder="11.8"
                  value={form.speed} onChange={(v) => upd("speed", v)} />
              </div>
            </div>
          )}
          <Field label="Elevation (m)">
            <input value={form.elevation} onChange={(e) => upd("elevation", e.target.value)} placeholder="34" style={inputStyle} />
          </Field>
          <Field label="Avg HR">
            <input value={form.hr} onChange={(e) => upd("hr", e.target.value)} placeholder="152" style={inputStyle} />
          </Field>
          <Field label="Cadence (spm)">
            <input value={form.cadence} onChange={(e) => upd("cadence", e.target.value)} placeholder="176" style={inputStyle} />
          </Field>
          <Field label="Feel (1-5)">
            <input type="number" min="1" max="5" value={form.feel} onChange={(e) => upd("feel", parseInt(e.target.value) || 3)} style={inputStyle} />
          </Field>
        </div>

        <div style={{
          marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line)",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Intervals
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                Break the run into segments — e.g. 1km @ 8 km/h, then 45s @ 10 km/h. Totals auto-compute.
              </div>
            </div>
            <button type="button" className="btn ghost" onClick={addSegment}>+ Add segment</button>
          </div>

          {hasSegments && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr 1fr 1fr 84px 1.1fr 28px",
                gap: 8, alignItems: "center",
                fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em",
                padding: "0 4px",
              }}>
                <div>#</div>
                <div>km</div>
                <div>mm:ss</div>
                <div>km/h</div>
                <div>Auto-fill</div>
                <div>Note</div>
                <div />
              </div>
              {form.segments.map((s, i) => (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr 1fr 1fr 84px 1.1fr 28px",
                  gap: 8, alignItems: "center",
                }}>
                  <div className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>{i + 1}</div>
                  <SegInput field="distance" seg={s} onChange={(v) => updSegment(i, "distance", v)} placeholder="1.0" />
                  <SegInput field="duration" seg={s} onChange={(v) => updSegment(i, "duration", v)} placeholder="7:30" />
                  <SegInput field="speed" seg={s} onChange={(v) => updSegment(i, "speed", v)} placeholder="8.0" />
                  <select value={s.computeMode} onChange={(e) => setSegMode(i, e.target.value)}
                    style={{ ...inputStyle, padding: "0 6px", fontSize: 11 }}>
                    <option value="distance">km</option>
                    <option value="duration">time</option>
                    <option value="speed">speed</option>
                  </select>
                  <input value={s.note} onChange={(e) => updSegment(i, "note", e.target.value)}
                    placeholder="warmup / tempo / rest" style={inputStyle} />
                  <button type="button" onClick={() => removeSegment(i)}
                    style={{
                      background: "transparent", border: "1px solid var(--line)", color: "var(--text-3)",
                      borderRadius: 6, height: 32, cursor: "pointer", padding: 0,
                    }}>×</button>
                </div>
              ))}
              <div style={{
                display: "flex", gap: 20, padding: "10px 4px 0",
                borderTop: "1px dashed var(--line)", marginTop: 4,
                fontFamily: "JetBrains Mono, monospace", fontSize: 12, flexWrap: "wrap",
              }}>
                <div><span style={{ color: "var(--text-3)" }}>TOTAL</span> {segTotals.distance}km</div>
                <div><span style={{ color: "var(--text-3)" }}>TIME</span> {formatDurationStr(segTotals.duration)}</div>
                <div><span style={{ color: "var(--text-3)" }}>AVG PACE</span> {segTotals.pace ? secondsToPace(segTotals.pace) + "/km" : "—"}</div>
                <div><span style={{ color: "var(--text-3)" }}>AVG SPEED</span> {segTotals.pace ? paceToSpeed(segTotals.pace) + " km/h" : "—"}</div>
              </div>
            </div>
          )}

          {/* Repeat block builder */}
          <div style={{
            marginTop: 16, padding: 14,
            background: "var(--bg-2)", border: "1px dashed var(--line)", borderRadius: 10,
          }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Repeat block
                </div>
                <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>
                  e.g. 5× (400m @ 16 km/h · 60s @ 10 km/h). Leave one half empty for unpaired intervals.
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" min="1" max="50"
                  value={repeat.reps}
                  onChange={(e) => setRepeat((r) => ({ ...r, reps: e.target.value }))}
                  style={{ ...inputStyle, width: 64, textAlign: "center" }} />
                <div className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>×</div>
                <button type="button" className="btn" onClick={addRepeatBlock}>Append block</button>
              </div>
            </div>
            <RepeatHalf label="Fast / work" half="high" data={repeat.high} onChange={updRepeat} />
            <RepeatHalf label="Slow / rest" half="low" data={repeat.low} onChange={updRepeat} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "space-between" }}>
          {isEdit ? (
            <button type="button" className="btn ghost" style={{ color: "var(--danger)" }} onClick={handleDelete}>Delete run</button>
          ) : <div />}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn">{isEdit ? "Save changes" : "Save run"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

// --- Goal form ---
function GoalModal({ open, onClose, onAdd, onEdit, onDelete, editing }) {
  const isEdit = !!editing;
  const [form, setForm] = React.useState({
    title: "", target: "", current: "", unit: "km", due: "", done: false,
  });

  React.useEffect(() => {
    if (editing) setForm({
      title: editing.title, target: String(editing.target),
      current: String(editing.current), unit: editing.unit || "km",
      due: editing.due || "", done: !!editing.done,
    });
    else if (open) setForm({ title: "", target: "", current: "", unit: "km", due: "", done: false });
  }, [editing, open]);

  if (!open) return null;

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.target) return;
    const goal = {
      title: form.title,
      target: parseFloat(form.target) || 0,
      current: parseFloat(form.current) || 0,
      unit: form.unit,
      due: form.due,
      done: form.done,
    };
    if (isEdit) await onEdit(editing.id, goal);
    else await onAdd(goal);
    onClose();
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm(`Delete "${editing.title}"?`)) return;
    await onDelete(editing.id);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }} onClick={onClose}>
      <form onSubmit={submit} style={{
        width: 500, maxWidth: "92vw",
        background: "var(--bg-1)", border: "1px solid var(--line)",
        borderRadius: 16, padding: 32,
      }} onClick={(e) => e.stopPropagation()}>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          {isEdit ? "Edit goal" : "New goal"}
        </div>
        <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 26, letterSpacing: "-0.03em", margin: "6px 0 20px" }}>
          {isEdit ? "Edit goal" : "New goal"}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Title">
            <input value={form.title} onChange={(e) => upd("title", e.target.value)} placeholder="Run 150km this month" style={inputStyle} />
          </Field>
          <div className="grid g-3" style={{ gap: 12 }}>
            <Field label="Target">
              <input value={form.target} onChange={(e) => upd("target", e.target.value)} placeholder="150" style={inputStyle} />
            </Field>
            <Field label="Current">
              <input value={form.current} onChange={(e) => upd("current", e.target.value)} placeholder="0" style={inputStyle} />
            </Field>
            <Field label="Unit">
              <select value={form.unit} onChange={(e) => upd("unit", e.target.value)} style={inputStyle}>
                {["km", "min", "runs", "weeks", "days"].map((u) => <option key={u}>{u}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Due">
            <input value={form.due} onChange={(e) => upd("due", e.target.value)} placeholder="April 30" style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "space-between" }}>
          {isEdit ? (
            <button type="button" className="btn ghost" style={{ color: "var(--danger)" }} onClick={handleDelete}>Delete goal</button>
          ) : <div />}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn">{isEdit ? "Save changes" : "Add goal"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

// --- Plan item form ---
function PlanModal({ open, onClose, onAdd, onEdit, onDelete, editing, prefilDate }) {
  const isEdit = !!editing;
  const [form, setForm] = React.useState({
    date: new Date().toISOString().slice(0, 10),
    type: "Easy", distance: "", desc: "", done: false,
  });

  React.useEffect(() => {
    if (editing) setForm({
      date: editing.date.toISOString().slice(0, 10),
      type: editing.type, distance: String(editing.distance),
      desc: editing.desc || "", done: !!editing.done,
    });
    else if (open) setForm({
      date: (prefilDate || new Date()).toISOString().slice(0, 10),
      type: "Easy", distance: "", desc: "", done: false,
    });
  }, [editing, open, prefilDate]);

  if (!open) return null;

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.distance) return;
    const p = {
      date: new Date(form.date),
      type: form.type,
      distance: parseFloat(form.distance) || 0,
      desc: form.desc,
      done: form.done,
    };
    if (isEdit) await onEdit(editing.id, p);
    else await onAdd(p);
    onClose();
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm("Delete this planned workout?")) return;
    await onDelete(editing.id);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }} onClick={onClose}>
      <form onSubmit={submit} style={{
        width: 500, maxWidth: "92vw",
        background: "var(--bg-1)", border: "1px solid var(--line)",
        borderRadius: 16, padding: 32,
      }} onClick={(e) => e.stopPropagation()}>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          {isEdit ? "Edit planned workout" : "New planned workout"}
        </div>
        <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 26, letterSpacing: "-0.03em", margin: "6px 0 20px" }}>
          {isEdit ? "Edit workout" : "Plan workout"}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="grid g-2" style={{ gap: 12 }}>
            <Field label="Date">
              <input type="date" value={form.date} onChange={(e) => upd("date", e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Type">
              <select value={form.type} onChange={(e) => upd("type", e.target.value)} style={inputStyle}>
                {["Easy", "Tempo", "Long", "Intervals", "Recovery", "Race"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Distance (km)">
            <input value={form.distance} onChange={(e) => upd("distance", e.target.value)} placeholder="8" style={inputStyle} />
          </Field>
          <Field label="Description">
            <input value={form.desc} onChange={(e) => upd("desc", e.target.value)} placeholder="6×800m @ 5K pace" style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "space-between" }}>
          {isEdit ? (
            <button type="button" className="btn ghost" style={{ color: "var(--danger)" }} onClick={handleDelete}>Delete</button>
          ) : <div />}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn">{isEdit ? "Save changes" : "Add workout"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children, span }) {
  return (
    <label style={{ gridColumn: span ? "span 2" : undefined }}>
      <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

// One of {distance, duration, speed}. Shows a tiny badge + compute icon if it's the auto-filled one.
function ComputeField({ mode, currentMode, onPickMode, label, placeholder, value, onChange }) {
  const isComputed = mode === currentMode;
  return (
    <div style={{ position: "relative" }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          ...inputStyle,
          paddingRight: 42,
          color: isComputed ? "var(--accent)" : "var(--text)",
          borderColor: isComputed ? "var(--accent)" : "var(--line)",
          fontFamily: "JetBrains Mono, monospace",
        }}
      />
      <button type="button"
        title={isComputed ? "Auto-filled from the other two" : "Click to auto-fill this field"}
        onClick={() => onPickMode(mode)}
        style={{
          position: "absolute", right: 4, top: 4, bottom: 4, width: 34,
          background: isComputed ? "var(--accent)" : "transparent",
          color: isComputed ? "#0b0b0b" : "var(--text-3)",
          border: "none", borderRadius: 4, cursor: "pointer",
          fontFamily: "JetBrains Mono, monospace", fontSize: 9,
          textTransform: "uppercase", letterSpacing: "0.08em",
        }}>
        {isComputed ? "auto" : label}
      </button>
    </div>
  );
}

// Segment input: distance/duration/speed cell. Read-only appearance when it's the computed one for the row.
function SegInput({ field, seg, onChange, placeholder }) {
  const isComputed = seg.computeMode === field;
  return (
    <input
      value={seg[field] || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        ...inputStyle,
        color: isComputed ? "var(--accent)" : "var(--text)",
        borderColor: isComputed ? "var(--accent)" : "var(--line)",
        fontFamily: "JetBrains Mono, monospace",
      }}
    />
  );
}

// One "half" of a repeat block (e.g. the 'fast' row).
function RepeatHalf({ label, half, data, onChange }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "110px 1fr 1fr 1fr 84px 1.1fr",
      gap: 8, alignItems: "center", marginBottom: 8,
    }}>
      <div className="mono" style={{ fontSize: 10, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </div>
      <SegInput field="distance" seg={data} onChange={(v) => onChange(half, "distance", v)} placeholder="0.4" />
      <SegInput field="duration" seg={data} onChange={(v) => onChange(half, "duration", v)} placeholder="1:30" />
      <SegInput field="speed" seg={data} onChange={(v) => onChange(half, "speed", v)} placeholder="16" />
      <select value={data.computeMode} onChange={(e) => onChange(half, "computeMode", e.target.value)}
        style={{ ...inputStyle, padding: "0 6px", fontSize: 11 }}>
        <option value="distance">km</option>
        <option value="duration">time</option>
        <option value="speed">speed</option>
      </select>
      <input value={data.note} onChange={(e) => onChange(half, "note", e.target.value)}
        placeholder="note" style={inputStyle} />
    </div>
  );
}

Object.assign(window, { DataCtx, DataProvider, useData, ConfigPanel, AddRunModal, GoalModal, PlanModal, ErrorBoundary });
