const { useState: uSS, useEffect: uEE } = React;

const TABS = [
  { id: "home",    label: "Home",            key: "1" },
  { id: "history", label: "History",          key: "2" },
  { id: "stats",   label: "Stats & trends",   key: "3" },
  { id: "records", label: "Personal records", key: "4" },
  { id: "profile", label: "Profile",          key: "5" },
];

const ACCENT_PRESETS = [
  { name: "Lime", hex: "#d4ff3a", ink: "#0a0a0a" },
  { name: "Orange", hex: "#ff5a1f", ink: "#0a0a0a" },
  { name: "Cyan", hex: "#6ee7ff", ink: "#0a0a0a" },
  { name: "Pink", hex: "#ff3d7f", ink: "#0a0a0a" },
  { name: "Violet", hex: "#a78bfa", ink: "#0a0a0a" },
  { name: "White", hex: "#ffffff", ink: "#0a0a0a" },
];

function Rail({ tab, setTab, onConfig }) {
  const { mode, profile } = useData();
  const initials = (profile?.name || "??")
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "??";
  return (
    <aside className="rail">
      <div className="rail-brand">
        <div className="dot" />
        <div className="name">PACELOG</div>
        <div className="ver">v2.3</div>
      </div>
      <div className="rail-section">Track</div>
      {TABS.slice(0, 3).map((t) => (
        <button key={t.id}
          className={`rail-item ${tab === t.id ? "active" : ""}`}
          onClick={() => setTab(t.id)}>
          {t.label}
          <span className="shortcut">{t.key}</span>
        </button>
      ))}
      <div className="rail-section">You</div>
      {TABS.slice(3).map((t) => (
        <button key={t.id}
          className={`rail-item ${tab === t.id ? "active" : ""}`}
          onClick={() => setTab(t.id)}>
          {t.label}
          <span className="shortcut">{t.key}</span>
        </button>
      ))}
      <div className="rail-spacer" />
      <button className="rail-item" onClick={onConfig} style={{ marginBottom: 4 }}>
        Sync settings
        <span className="shortcut" style={{
          background: mode === "supabase" ? "color-mix(in oklab, var(--accent) 30%, transparent)" : undefined,
          color: mode === "supabase" ? "var(--accent)" : undefined,
        }}>
          {mode === "supabase" ? "ON" : mode === "unconfigured" ? "OFF" : "..."}
        </span>
      </button>
      <div className="rail-profile">
        <div className="avatar">{initials}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{profile?.name || "Not connected"}</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>
            {mode === "supabase" ? "synced · cloud" : mode === "unconfigured" ? "connect to sync" : "loading…"}
          </div>
        </div>
      </div>
    </aside>
  );
}

function Tweaks({ accent, setAccent, visible }) {
  if (!visible) return null;
  return (
    <div className="tweaks">
      <h4>Tweaks · Accent</h4>
      <div className="swatches">
        {ACCENT_PRESETS.map((p) => (
          <div key={p.name}
            className={`swatch ${accent.hex === p.hex ? "active" : ""}`}
            style={{ background: p.hex }}
            onClick={() => setAccent(p)}
            title={p.name} />
        ))}
      </div>
      <div style={{
        marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)",
        fontFamily: "JetBrains Mono, monospace", fontSize: 10,
        color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em",
      }}>
        {accent.name} · {accent.hex}
      </div>
    </div>
  );
}

function Shell() {
  const { addRun, editRun, removeRun, reload, configOpen, setConfigOpen, mode } = useData();
  const savedTab = typeof localStorage !== "undefined" ? localStorage.getItem("pacelog-tab") : null;
  const [tab, setTab] = uSS(savedTab || "home");
  const [openRun, setOpenRun] = uSS(null);
  const [addOpen, setAddOpen] = uSS(false);
  const [editingRun, setEditingRun] = uSS(null);
  const [tweaksVisible, setTweaksVisible] = uSS(false);
  const [accent, setAccent] = uSS(ACCENT_PRESETS[0]);

  uEE(() => { localStorage.setItem("pacelog-tab", tab); }, [tab]);

  uEE(() => {
    document.documentElement.style.setProperty("--accent", accent.hex);
    document.documentElement.style.setProperty("--accent-ink", accent.ink);
  }, [accent]);

  uEE(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (e.key === "Escape") { setOpenRun(null); setAddOpen(false); setConfigOpen(false); }
      const t = TABS.find((x) => x.key === e.key);
      if (t) setTab(t.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  uEE(() => {
    const onMsg = (ev) => {
      if (ev.data?.type === "__activate_edit_mode") setTweaksVisible(true);
      if (ev.data?.type === "__deactivate_edit_mode") setTweaksVisible(false);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // On first load, auto-open config if Supabase not connected
  uEE(() => {
    if (mode === "unconfigured") setConfigOpen(true);
  }, [mode]);

  const current = TABS.find((t) => t.id === tab);

  let content;
  if (mode === "loading") {
    content = (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div className="mono" style={{ color: "var(--text-3)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>Loading…</div>
      </div>
    );
  } else if (mode === "unconfigured") {
    content = (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center", maxWidth: 440 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Not connected</div>
          <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 28, letterSpacing: "-0.03em", margin: "8px 0 12px" }}>
            Connect to Supabase to get started
          </h2>
          <p style={{ color: "var(--text-2)", fontSize: 14, lineHeight: 1.5, margin: "0 0 20px" }}>
            All your runs, goals, plan and profile live in your Supabase project — nothing is stored locally or hardcoded.
          </p>
          <button className="btn" onClick={() => setConfigOpen(true)}>Open sync settings</button>
        </div>
      </div>
    );
  }
  else if (tab === "home") content = <Home onOpenRun={setOpenRun} onAddRun={() => setAddOpen(true)} />;
  else if (tab === "history") content = <History onOpenRun={setOpenRun} />;
  else if (tab === "stats") content = <Stats />;
  else if (tab === "records") content = <PersonalRecords />;
  else if (tab === "profile") content = <Profile />;

  return (
    <div className="app" data-screen-label={current?.label}>
      <Rail tab={tab} setTab={setTab} onConfig={() => setConfigOpen(true)} />
      <main className="main" key={tab}>
        {content}
      </main>
      <RunDetail run={openRun} onClose={() => setOpenRun(null)}
        onEdit={(r) => { setOpenRun(null); setEditingRun(r); setAddOpen(true); }} />
      <AddRunModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setEditingRun(null); }}
        onAdd={addRun}
        onEdit={editRun}
        onDelete={removeRun}
        editing={editingRun}
      />
      <ConfigPanel
        open={configOpen}
        onClose={() => { setConfigOpen(false); localStorage.setItem("pacelog-config-dismissed", "1"); }}
        onSaved={reload}
      />
      <Tweaks accent={accent} setAccent={setAccent} visible={tweaksVisible} />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <DataProvider>
        <ErrorBoundary>
          <Shell />
        </ErrorBoundary>
      </DataProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
