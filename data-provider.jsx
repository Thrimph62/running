// Data context — provides runs/goals/plan and mutation fns to the rest of the app.
// Prefers Supabase if configured, otherwise falls back to seed data.

const DataCtx = React.createContext(null);

function useData() {
  return React.useContext(DataCtx);
}

function DataProvider({ children }) {
  const [mode, setMode] = React.useState("loading"); // loading | supabase | seed
  const [runs, setRuns] = React.useState([]);
  const [goals, setGoals] = React.useState(GOALS);
  const [plan, setPlan] = React.useState(PLAN);
  const [configOpen, setConfigOpen] = React.useState(false);

  const reload = React.useCallback(async () => {
    const ok = await initSupabase();
    if (!ok) {
      setMode("seed");
      setRuns(RUNS);
      setGoals(GOALS);
      setPlan(PLAN);
      return;
    }
    const [r, g, p] = await Promise.all([fetchRuns(), fetchGoals(), fetchPlan()]);
    setRuns(r && r.length ? r : RUNS);
    setGoals(g && g.length ? g : GOALS);
    setPlan(p && p.length ? p : PLAN);
    setMode("supabase");
  }, []);

  React.useEffect(() => { reload(); }, [reload]);

  const addRun = async (run) => {
    if (mode === "supabase") {
      await insertRun(run);
      const fresh = await fetchRuns();
      if (fresh) setRuns(fresh);
    } else {
      setRuns((rs) => [{ ...run, id: `local-${Date.now()}`, paceStr: secondsToPace(run.pace) }, ...rs]);
    }
  };

  const toggleGoal = async (id) => {
    setGoals((gs) => gs.map((x) => x.id === id ? { ...x, done: !x.done } : x));
    if (mode === "supabase") {
      const g = goals.find((x) => x.id === id);
      if (g) await updateGoalDone(id, !g.done);
    }
  };

  const togglePlan = async (id) => {
    setPlan((ps) => ps.map((x) => x.id === id ? { ...x, done: !x.done } : x));
    if (mode === "supabase") {
      const p = plan.find((x) => x.id === id);
      if (p) await updatePlanDone(id, !p.done);
    }
  };

  return (
    <DataCtx.Provider value={{ mode, runs, goals, plan, addRun, toggleGoal, togglePlan, reload, configOpen, setConfigOpen }}>
      {children}
    </DataCtx.Provider>
  );
}

// --- Config panel: paste Supabase URL + anon key ---
function ConfigPanel({ open, onClose, onSaved }) {
  const initial = getSupabaseConfig();
  const [url, setUrl] = React.useState(initial.url);
  const [key, setKey] = React.useState(initial.key);
  const [status, setStatus] = React.useState("");

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

  const disconnect = () => {
    clearSupabaseConfig();
    setUrl(""); setKey("");
    setStatus("Disconnected — using seed data.");
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

        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={disconnect}>Disconnect</button>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Save & connect</button>
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

// --- Add run form ---
function AddRunModal({ open, onClose, onAdd }) {
  const [form, setForm] = React.useState({
    date: new Date().toISOString().slice(0, 10),
    type: "Easy",
    routeName: "",
    distance: "",
    duration: "",
    elevation: "",
    hr: "",
    cadence: "",
    feel: 3,
  });

  if (!open) return null;

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const dist = parseFloat(form.distance);
    // Parse mm:ss or hh:mm:ss
    const parts = form.duration.split(":").map(Number);
    let dur = 0;
    if (parts.length === 2) dur = parts[0] * 60 + parts[1];
    else if (parts.length === 3) dur = parts[0] * 3600 + parts[1] * 60 + parts[2];
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
      splits: [],
      feel: form.feel,
      vibe: "flat",
    };
    await onAdd(run);
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 300,
    }} onClick={onClose}>
      <form onSubmit={submit} style={{
        width: 560, maxWidth: "92vw",
        background: "var(--bg-1)", border: "1px solid var(--line)",
        borderRadius: 16, padding: 32,
      }} onClick={(e) => e.stopPropagation()}>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>New run</div>
        <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 26, letterSpacing: "-0.03em", margin: "6px 0 20px" }}>
          Log a run
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
          <Field label="Distance (km)">
            <input value={form.distance} onChange={(e) => upd("distance", e.target.value)} placeholder="5.2" style={inputStyle} />
          </Field>
          <Field label="Duration (mm:ss)">
            <input value={form.duration} onChange={(e) => upd("duration", e.target.value)} placeholder="26:30" style={inputStyle} />
          </Field>
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

        <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn">Save run</button>
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

Object.assign(window, { DataCtx, DataProvider, useData, ConfigPanel, AddRunModal });
