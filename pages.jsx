// Pages

const { useState: uS, useMemo: uM, useEffect: uE } = React;

function formatDate(d, fmt = "short") {
  if (fmt === "dow") return d.toLocaleDateString("en", { weekday: "short" }).toUpperCase();
  if (fmt === "day") return d.getDate();
  if (fmt === "month") return d.toLocaleDateString("en", { month: "short" }).toUpperCase();
  if (fmt === "full") return d.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" });
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function RunRow({ run, onClick }) {
  return (
    <div className="run-row" onClick={onClick}>
      <div className="date">
        <div className="d">{formatDate(run.date, "day")}</div>
        <div>{formatDate(run.date, "month")} · {formatDate(run.date, "dow")}</div>
      </div>
      <div className="name">
        <div>{run.routeName}</div>
        <div className="sub">
          <span className={`type-badge ${run.type}`}>{run.type}</span>
          {" · "}cadence {run.cadence}spm · hr {run.hr}
        </div>
      </div>
      <div className="metric">{run.distance}<span className="u">km</span></div>
      <div className="metric">{formatDuration(run.duration)}</div>
      <div className="metric">
        <div>{(3600 / run.pace).toFixed(1)}<span className="u">km/h</span></div>
        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{run.paceStr}/km</div>
      </div>
      <div style={{ width: 80, height: 40 }}>
        <Sparkline values={run.splits} />
      </div>
    </div>
  );
}

// Helpers used by pages to compute weekly stats on demand from live runs.
function computeWeekly(runs) {
  const weeks = {};
  for (const r of runs) {
    const d = new Date(r.date);
    const dow = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((dow + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString().slice(0, 10);
    if (!weeks[key]) weeks[key] = { date: monday, distance: 0, duration: 0, runs: 0, paces: [] };
    weeks[key].distance += r.distance;
    weeks[key].duration += r.duration;
    weeks[key].runs += 1;
    weeks[key].paces.push(r.pace);
  }
  return Object.values(weeks)
    .map((w) => ({
      ...w,
      distance: +w.distance.toFixed(1),
      avgPace: Math.round(w.paces.reduce((a, b) => a + b, 0) / Math.max(1, w.paces.length)),
    }))
    .sort((a, b) => a.date - b.date);
}

function computeTotals(runs) {
  if (!runs.length) return { runs: 0, distance: 0, duration: 0, elevation: 0, avgPace: 0 };
  return {
    runs: runs.length,
    distance: +runs.reduce((a, r) => a + r.distance, 0).toFixed(1),
    duration: runs.reduce((a, r) => a + r.duration, 0),
    elevation: runs.reduce((a, r) => a + r.elevation, 0),
    avgPace: Math.round(runs.reduce((a, r) => a + r.pace, 0) / runs.length),
  };
}

// --- Home ---
function Home({ onOpenRun, onAddRun }) {
  const { runs, profile } = useData();
  const weekly = uM(() => computeWeekly(runs), [runs]);
  const recent = runs.slice(0, 5);

  // Current Mon–Sun week
  const now = new Date();
  const weekStart = uM(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const prevWeekStart = uM(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    return d;
  }, [weekStart]);

  const thisWeekRuns = uM(() => runs.filter((r) => r.date >= weekStart), [runs, weekStart]);
  const lastWeekRuns = uM(() => runs.filter((r) => r.date >= prevWeekStart && r.date < weekStart), [runs, prevWeekStart, weekStart]);

  const thisWeek = uM(() => ({
    distance: +thisWeekRuns.reduce((a, r) => a + r.distance, 0).toFixed(1),
    runs: thisWeekRuns.length,
    avgPace: thisWeekRuns.length ? Math.round(thisWeekRuns.reduce((a, r) => a + r.pace, 0) / thisWeekRuns.length) : 0,
  }), [thisWeekRuns]);

  const lastWeek = uM(() => ({
    distance: +lastWeekRuns.reduce((a, r) => a + r.distance, 0).toFixed(1),
    avgPace: lastWeekRuns.length ? Math.round(lastWeekRuns.reduce((a, r) => a + r.pace, 0) / lastWeekRuns.length) : 0,
  }), [lastWeekRuns]);

  const deltaDist = +(thisWeek.distance - lastWeek.distance).toFixed(1);
  const deltaSpeed = thisWeek.avgPace && lastWeek.avgPace
    ? +((3600 / thisWeek.avgPace) - (3600 / lastWeek.avgPace)).toFixed(1) : 0;

  const monthDist = runs
    .filter((r) => r.date.getMonth() === now.getMonth() && r.date.getFullYear() === now.getFullYear())
    .reduce((a, r) => a + r.distance, 0);

  // Streak: consecutive weeks (ending this week) with ≥ 2 runs
  const streak = uM(() => {
    let s = 0;
    for (let i = weekly.length - 1; i >= 0; i--) {
      if (weekly[i].runs >= 2) s++;
      else break;
    }
    return s;
  }, [weekly]);

  const hour = now.getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (profile?.name || "").trim().split(/\s+/)[0] || "";
  const todayStr = now.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" }).toUpperCase();

  const thisSpeed = thisWeek.avgPace ? (3600 / thisWeek.avgPace).toFixed(1) : "—";

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{greet}{firstName ? `, ${firstName}` : ""}.</h1>
          <div className="sub">{todayStr} · {streak}-WEEK STREAK</div>
        </div>
        <div className="right">
          <button className="btn" onClick={onAddRun}>+ Log run</button>
        </div>
      </div>

      <div className="grid g-4" style={{ marginBottom: 24 }}>
        <div className="stat hero">
          <div className="label">This week</div>
          <div className="big">{thisWeek.distance}<span className="unit">km</span></div>
          <div className="delta">
            {deltaDist >= 0 ? "↑" : "↓"} {Math.abs(deltaDist)}km vs last week
          </div>
        </div>
        <div className="stat">
          <div className="label">Avg speed · week</div>
          <div className="big">{thisSpeed}<span className="unit">km/h</span></div>
          <div className={`delta ${deltaSpeed > 0 ? "up" : deltaSpeed < 0 ? "down" : ""}`}>
            {deltaSpeed > 0 ? "↑" : deltaSpeed < 0 ? "↓" : "—"} {Math.abs(deltaSpeed)} km/h vs last week
          </div>
        </div>
        <div className="stat">
          <div className="label">This month</div>
          <div className="big">{monthDist.toFixed(1)}<span className="unit">km</span></div>
        </div>
        <div className="stat">
          <div className="label">Runs this week</div>
          <div className="big">{thisWeek.runs}</div>
          <div className="delta">{runs.length} total logged</div>
        </div>
      </div>

      <div className="grid g-12">
        <div className="card">
          <div className="sect-title" style={{ margin: "0 0 16px" }}>
            <h2>12-week volume</h2>
            <div className="meta">WEEKLY DISTANCE · KM</div>
          </div>
          <LineChart data={weekly} valueKey="distance" unit="km" label="Distance" />
        </div>
        <div className="card">
          <div className="sect-title" style={{ margin: "0 0 16px" }}>
            <h2>Pace trend</h2>
            <div className="meta">AVG · SEC/KM</div>
          </div>
          <LineChart data={weekly} valueKey="avgPace" unit="s" label="Pace" height={220} />
        </div>
      </div>

      <div className="sect-title">
        <h2>Recent runs</h2>
        <div className="meta">LAST 5</div>
      </div>
      <div className="card" style={{ padding: "4px 0" }}>
        {recent.map((r) => <RunRow key={r.id} run={r} onClick={() => onOpenRun(r)} />)}
      </div>
    </div>
  );
}

// --- History ---
function History({ onOpenRun }) {
  const { runs } = useData();
  const totals = uM(() => computeTotals(runs), [runs]);
  const [filter, setFilter] = uS("All");
  const types = ["All", "Easy", "Tempo", "Long", "Intervals", "Recovery"];
  const filtered = filter === "All" ? runs : runs.filter((r) => r.type === filter);
  const [sort, setSort] = uS("date");

  const sorted = uM(() => {
    const copy = [...filtered];
    if (sort === "distance") copy.sort((a, b) => b.distance - a.distance);
    else if (sort === "pace") copy.sort((a, b) => a.pace - b.pace);
    else copy.sort((a, b) => b.date - a.date);
    return copy;
  }, [filtered, sort]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>History</h1>
          <div className="sub">{runs.length} RUNS · {totals.distance}km · {formatDuration(totals.duration)}</div>
        </div>
        <div className="right">
          <button className="btn ghost">Export CSV</button>
        </div>
      </div>

      <div className="filter-bar">
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginRight: 8 }}>Type</div>
        {types.map((t) => (
          <button key={t} className={`chip ${filter === t ? "active" : ""}`} onClick={() => setFilter(t)}>{t}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginRight: 8 }}>Sort</div>
        {[["date", "Date"], ["distance", "Distance"], ["pace", "Pace"]].map(([k, l]) => (
          <button key={k} className={`chip ${sort === k ? "active" : ""}`} onClick={() => setSort(k)}>{l}</button>
        ))}
      </div>

      <div className="card" style={{ padding: "4px 0" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "80px 1fr 100px 100px 100px 80px",
          gap: 16,
          padding: "12px 16px",
          borderBottom: "1px solid var(--line)",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--text-3)",
        }}>
          <div>Date</div><div>Route</div><div>Distance</div><div>Duration</div><div>Speed / Pace</div><div>Splits</div>
        </div>
        {sorted.map((r) => <RunRow key={r.id} run={r} onClick={() => onOpenRun(r)} />)}
      </div>
    </div>
  );
}

// --- Stats ---
function Stats() {
  const { runs } = useData();
  const weekly = uM(() => computeWeekly(runs), [runs]);
  const totals = uM(() => computeTotals(runs), [runs]);
  // heatmap: 84 days × distance
  const today = new Date();
  const days = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const run = runs.find((r) => r.date.toDateString() === d.toDateString());
    days.push({ date: d, distance: run?.distance || 0 });
  }
  const maxD = Math.max(...days.map((d) => d.distance), 1);

  const byType = {};
  runs.forEach((r) => {
    byType[r.type] = (byType[r.type] || 0) + r.distance;
  });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Stats & trends</h1>
          <div className="sub">12 WEEKS · {totals.runs} RUNS · {totals.distance}km</div>
        </div>
        <div className="right">
          <button className="chip active">12W</button>
          <button className="chip">6M</button>
          <button className="chip">1Y</button>
          <button className="chip">ALL</button>
        </div>
      </div>

      <div className="grid g-4" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="label">Total distance</div>
          <div className="big">{totals.distance}<span className="unit">km</span></div>
          <div className="delta">across {totals.runs} runs</div>
        </div>
        <div className="stat">
          <div className="label">Avg pace</div>
          <div className="big">{secondsToPace(totals.avgPace)}<span className="unit">/km</span></div>
          <div className="delta up">↑ 14s since January</div>
        </div>
        <div className="stat">
          <div className="label">Total time</div>
          <div className="big">{Math.round(totals.duration / 3600)}<span className="unit">h</span></div>
          <div className="delta">{formatDuration(totals.duration)}</div>
        </div>
        <div className="stat">
          <div className="label">Elevation</div>
          <div className="big">{(totals.elevation / 1000).toFixed(1)}<span className="unit">km</span></div>
          <div className="delta">climbed total</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sect-title" style={{ margin: "0 0 20px" }}>
          <h2>Weekly volume</h2>
          <div className="meta">12 WEEKS · KM</div>
        </div>
        <BarChart data={weekly} valueKey="distance" unit="km" height={220} />
      </div>

      <div className="grid g-2">
        <div className="card">
          <div className="sect-title" style={{ margin: "0 0 16px" }}>
            <h2>Pace distribution</h2>
            <div className="meta">MIN/KM</div>
          </div>
          <PaceDistribution runs={runs} />
        </div>
        <div className="card">
          <div className="sect-title" style={{ margin: "0 0 16px" }}>
            <h2>Mix by type</h2>
            <div className="meta">KM PER WORKOUT TYPE</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
            {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, km]) => {
              const max = Math.max(...Object.values(byType));
              return (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 90 }}>
                    <span className={`type-badge ${t}`}>{t}</span>
                  </div>
                  <div style={{ flex: 1, height: 24, background: "var(--bg-3)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      width: `${(km / max) * 100}%`,
                      height: "100%",
                      background: "var(--accent)",
                      borderRadius: 4,
                      transition: "width 600ms cubic-bezier(.2,.8,.2,1)",
                    }} />
                  </div>
                  <div className="mono" style={{ width: 70, textAlign: "right", fontWeight: 600, fontSize: 13 }}>
                    {km.toFixed(1)}km
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="sect-title" style={{ margin: "0 0 16px" }}>
          <h2>Activity heatmap</h2>
          <div className="meta">LAST 12 WEEKS · DAILY DISTANCE</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 18 }}>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div key={i} style={{
                height: 20,
                display: "flex", alignItems: "center",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 9,
                color: "var(--text-3)",
              }}>{d}</div>
            ))}
          </div>
          <div className="heatmap" style={{ flex: 1 }}>
            {Array.from({ length: 12 }).map((_, week) => (
              <div key={week} className="hm-week">
                {Array.from({ length: 7 }).map((_, dow) => {
                  const idx = week * 7 + dow;
                  const d = days[idx];
                  if (!d) return <div key={dow} className="hm-day" style={{ opacity: 0 }} />;
                  const intensity = d.distance / (maxD || 1);
                  const bg = d.distance === 0
                    ? "var(--bg-3)"
                    : `color-mix(in oklab, var(--accent) ${20 + intensity * 80}%, var(--bg-3))`;
                  return (
                    <div key={dow} className="hm-day" style={{ background: bg }}
                      title={`${d.date.toDateString()}: ${d.distance}km`} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div style={{
          display: "flex", gap: 8, alignItems: "center", marginTop: 16,
          fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-3)",
        }}>
          <span>LESS</span>
          {[0, 0.25, 0.5, 0.75, 1].map((i) => (
            <div key={i} style={{
              width: 16, height: 16, borderRadius: 3,
              background: i === 0 ? "var(--bg-3)" : `color-mix(in oklab, var(--accent) ${20 + i * 80}%, var(--bg-3))`,
            }} />
          ))}
          <span>MORE</span>
        </div>
      </div>
    </div>
  );
}

// --- Personal Records ---
const PR_CATEGORIES = ["5K", "10K", "Half Marathon", "Marathon", "Other"];

function PRModal({ open, onClose, onSave, onDelete, editing }) {
  const isEdit = !!editing;
  const empty = { event: "5K", result: "", date: "", notes: "" };
  const [form, setForm] = uS(empty);

  uE(() => {
    if (editing) setForm({ event: editing.event, result: editing.result, date: editing.date || "", notes: editing.notes || "" });
    else if (open) setForm(empty);
  }, [editing, open]);

  if (!open) return null;

  const s = {
    width: "100%", background: "var(--bg-2)", border: "1px solid var(--line)",
    borderRadius: 8, padding: "10px 12px", color: "var(--text)",
    fontFamily: "JetBrains Mono, monospace", fontSize: 13, outline: "none",
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.result.trim()) return;
    onSave({ event: form.event, result: form.result.trim(), date: form.date, notes: form.notes.trim() });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}
      onClick={onClose}>
      <form onSubmit={submit} style={{
        width: 460, maxWidth: "92vw", background: "var(--bg-1)",
        border: "1px solid var(--line)", borderRadius: 16, padding: 32,
      }} onClick={(e) => e.stopPropagation()}>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          {isEdit ? "Edit record" : "New record"}
        </div>
        <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 24, letterSpacing: "-0.03em", margin: "6px 0 20px" }}>
          {isEdit ? "Edit PR" : "Add PR"}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="grid g-2" style={{ gap: 12 }}>
            <label>
              <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Event</div>
              <select value={form.event} onChange={(e) => setForm((f) => ({ ...f, event: e.target.value }))} style={s}>
                {PR_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>
              <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Result</div>
              <input value={form.result} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}
                placeholder="22:45 or 42.2km" style={s} autoFocus />
            </label>
          </div>
          <label>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Date</div>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={s} />
          </label>
          <label>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Notes</div>
            <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Paris Marathon, hot day…" style={s} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "space-between" }}>
          {isEdit ? (
            <button type="button" className="btn ghost" style={{ color: "var(--danger)" }}
              onClick={() => { onDelete(editing.id); onClose(); }}>Delete</button>
          ) : <div />}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn">{isEdit ? "Save" : "Add"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function PersonalRecords() {
  const { profile, saveProfile } = useData();
  const [modalOpen, setModalOpen] = uS(false);
  const [editing, setEditing] = uS(null);

  const records = profile.personalRecords || [];

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r) => { setEditing(r); setModalOpen(true); };

  const saveRecord = async (rec) => {
    let updated;
    if (editing) {
      updated = records.map((r) => r.id === editing.id ? { ...r, ...rec } : r);
    } else {
      updated = [...records, { ...rec, id: `pr-${Date.now()}` }];
    }
    await saveProfile({ ...profile, personalRecords: updated });
  };

  const deleteRecord = async (id) => {
    await saveProfile({ ...profile, personalRecords: records.filter((r) => r.id !== id) });
  };

  // Group by event category
  const grouped = PR_CATEGORIES.reduce((acc, cat) => {
    const catRecords = records.filter((r) => r.event === cat);
    if (catRecords.length) acc[cat] = catRecords;
    return acc;
  }, {});
  const otherRecords = records.filter((r) => !PR_CATEGORIES.includes(r.event));
  if (otherRecords.length) grouped["Other"] = (grouped["Other"] || []).concat(otherRecords);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Personal Records</h1>
          <div className="sub">{records.length} ENTR{records.length === 1 ? "Y" : "IES"}</div>
        </div>
        <div className="right">
          <button className="btn" onClick={openNew}>+ Add record</button>
        </div>
      </div>

      {records.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>No records yet</div>
          <p style={{ color: "var(--text-2)", fontSize: 14, margin: "0 0 20px" }}>Log your race times, distance bests, or any personal milestone.</p>
          <button className="btn" onClick={openNew}>+ Add first record</button>
        </div>
      )}

      {Object.entries(grouped).map(([cat, catRecords]) => (
        <div key={cat}>
          <div className="sect-title">
            <h2>{cat}</h2>
            <div className="meta">{catRecords.length} RECORD{catRecords.length > 1 ? "S" : ""}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {catRecords
              .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
              .map((r) => (
              <div key={r.id}
                className="card"
                style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px 20px", cursor: "pointer" }}
                onClick={() => openEdit(r)}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", color: "var(--accent)" }}>
                    {r.result}
                  </div>
                  {r.notes && <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>{r.notes}</div>}
                </div>
                {r.date && (
                  <div className="mono" style={{ fontSize: 12, color: "var(--text-3)", textAlign: "right" }}>
                    {new Date(r.date).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                )}
                <div className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>✎</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <PRModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={saveRecord}
        onDelete={deleteRecord}
        editing={editing}
      />
    </div>
  );
}

// --- Custom achievement modal ---
function CustomAchModal({ open, onClose, onSave, onDelete, editing }) {
  const isEdit = !!editing;
  const [form, setForm] = uS({ icon: "🏅", title: "", sub: "", earned: true });

  uE(() => {
    if (editing) setForm({ icon: editing.icon || "🏅", title: editing.title, sub: editing.sub || "", earned: !!editing.earned });
    else if (open) setForm({ icon: "🏅", title: "", sub: "", earned: true });
  }, [editing, open]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({ icon: form.icon || "🏅", title: form.title.trim(), sub: form.sub.trim(), earned: form.earned });
    onClose();
  };

  const achInputStyle = {
    width: "100%", background: "var(--bg-2)", border: "1px solid var(--line)",
    borderRadius: 8, padding: "10px 12px", color: "var(--text)",
    fontFamily: "JetBrains Mono, monospace", fontSize: 13, outline: "none",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}
      onClick={onClose}>
      <form onSubmit={submit} style={{
        width: 440, maxWidth: "92vw", background: "var(--bg-1)",
        border: "1px solid var(--line)", borderRadius: 16, padding: 32,
      }} onClick={(e) => e.stopPropagation()}>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          {isEdit ? "Edit achievement" : "New achievement"}
        </div>
        <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 24, letterSpacing: "-0.03em", margin: "6px 0 20px" }}>
          {isEdit ? "Edit" : "Add achievement"}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 12 }}>
            <label>
              <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Icon</div>
              <input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                placeholder="🏅" style={{ ...achInputStyle, textAlign: "center", fontSize: 20 }} />
            </label>
            <label>
              <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Title</div>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Paris Marathon 2024" style={achInputStyle} autoFocus />
            </label>
          </div>
          <label>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Description</div>
            <input value={form.sub} onChange={(e) => setForm((f) => ({ ...f, sub: e.target.value }))}
              placeholder="Finished in 3:52:14" style={achInputStyle} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={form.earned} onChange={(e) => setForm((f) => ({ ...f, earned: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer" }} />
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>Mark as earned</span>
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "space-between" }}>
          {isEdit ? (
            <button type="button" className="btn ghost" style={{ color: "var(--danger)" }}
              onClick={() => { onDelete(editing.id); onClose(); }}>Delete</button>
          ) : <div />}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn">{isEdit ? "Save" : "Add"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

// --- Profile ---
function Profile() {
  const { runs, profile, saveProfile } = useData();
  const totals = uM(() => computeTotals(runs), [runs]);
  const [editing, setEditing] = uS(false);
  const [form, setForm] = uS(profile);
  uE(() => { setForm(profile); }, [profile]);

  // Derive achievements from real runs
  const achs = uM(() => {
    const longest = runs.reduce((m, r) => Math.max(m, r.distance), 0);
    const fastest5k = runs.filter((r) => r.distance >= 4.8 && r.distance <= 5.5)
      .reduce((m, r) => Math.min(m, r.pace), Infinity);
    const fastest10k = runs.filter((r) => r.distance >= 9.8 && r.distance <= 10.5)
      .reduce((m, r) => Math.min(m, r.pace), Infinity);
    const byMonth = {};
    for (const r of runs) {
      const k = `${r.date.getFullYear()}-${r.date.getMonth()}`;
      byMonth[k] = (byMonth[k] || 0) + r.distance;
    }
    const bestMonthKm = Math.max(0, ...Object.values(byMonth));
    const weekly = computeWeekly(runs);
    let curStreak = 0;
    for (let i = weekly.length - 1; i >= 0; i--) {
      if (weekly[i].runs >= 2) curStreak++; else break;
    }
    return [
      // — First steps —
      { id: "a0",  icon: "▶",   title: "First run",       sub: runs.length > 0 ? `${runs.length} runs logged` : "Log your very first run",     earned: runs.length > 0 },
      { id: "a1a", icon: "5K",  title: "First 5K",        sub: longest >= 5 ? "Done" : "Complete a 5km run",                                   earned: longest >= 5 },
      { id: "a1",  icon: "10K", title: "First 10K",       sub: longest >= 10 ? "Done" : "Complete a 10km run",                                 earned: longest >= 10 },
      { id: "a1b", icon: "20K", title: "First 20K",       sub: longest >= 20 ? "Done" : "Complete a 20km run",                                 earned: longest >= 20 },
      { id: "a5",  icon: "21K", title: "Half marathon",   sub: longest >= 21.0975 ? "Done" : "Complete 21.1km",                                earned: longest >= 21.0975 },
      { id: "a5b", icon: "42K", title: "Marathon",        sub: longest >= 42.195 ? "Done" : "Complete 42.2km",                                 earned: longest >= 42.195 },
      // — Volume —
      { id: "a6a", icon: "200", title: "200km total",     sub: totals.distance >= 200 ? "Done" : `${totals.distance}km / 200km`,               earned: totals.distance >= 200 },
      { id: "a6",  icon: "500", title: "500km total",     sub: totals.distance >= 500 ? "Done" : `${totals.distance}km / 500km`,               earned: totals.distance >= 500 },
      { id: "a6b", icon: "1K",  title: "1000km total",    sub: totals.distance >= 1000 ? "Done" : `${totals.distance}km / 1000km`,             earned: totals.distance >= 1000 },
      // — Run count —
      { id: "a8a", icon: "10",  title: "10 runs",         sub: totals.runs >= 10 ? `${totals.runs} logged` : `${totals.runs} / 10 runs`,        earned: totals.runs >= 10 },
      { id: "a8",  icon: "50",  title: "50 runs",         sub: totals.runs >= 50 ? `${totals.runs} logged` : `${totals.runs} / 50 runs`,        earned: totals.runs >= 50 },
      { id: "a8b", icon: "100×",title: "100 runs",        sub: totals.runs >= 100 ? `${totals.runs} logged` : `${totals.runs} / 100 runs`,      earned: totals.runs >= 100 },
      // — Pace —
      { id: "a2",  icon: "5:00",title: "Sub-5 5K pace",  sub: fastest5k < 300 && isFinite(fastest5k) ? `Best: ${secondsToPace(fastest5k)}/km` : "Run a 5K under 5:00/km", earned: fastest5k < 300 && isFinite(fastest5k) },
      { id: "a7",  icon: "45",  title: "Sub-45 10K",     sub: fastest10k < 2700 && isFinite(fastest10k) ? `Best: ${secondsToPace(fastest10k)}/km` : "Run a 10K under 45:00", earned: fastest10k < 2700 && isFinite(fastest10k) },
      // — Consistency —
      { id: "a3",  icon: "100", title: "100km month",    sub: bestMonthKm >= 100 ? `Best: ${bestMonthKm.toFixed(0)}km` : "Log 100km in one month",    earned: bestMonthKm >= 100 },
      { id: "a4",  icon: "4W",  title: "4-week streak",  sub: curStreak >= 4 ? `Current: ${curStreak} weeks` : "4 consecutive active weeks",          earned: curStreak >= 4 },
      { id: "a4b", icon: "8W",  title: "8-week streak",  sub: curStreak >= 8 ? `Current: ${curStreak} weeks` : "8 consecutive active weeks",          earned: curStreak >= 8 },
    ];
  }, [runs, totals]);

  const earned = achs.filter((a) => a.earned);
  const locked = achs.filter((a) => !a.earned);
  const customAchs = profile.customAchs || [];

  const [achModalOpen, setAchModalOpen] = uS(false);
  const [achEditing, setAchEditing] = uS(null);

  const openNewAch = () => { setAchEditing(null); setAchModalOpen(true); };
  const openEditAch = (a) => { setAchEditing(a); setAchModalOpen(true); };

  const saveCustomAch = async (ach) => {
    let updated;
    if (achEditing) {
      updated = customAchs.map((a) => a.id === achEditing.id ? { ...a, ...ach } : a);
    } else {
      updated = [...customAchs, { ...ach, id: `c-${Date.now()}` }];
    }
    await saveProfile({ ...profile, customAchs: updated });
  };

  const deleteCustomAch = async (id) => {
    if (!confirm("Delete this achievement?")) return;
    await saveProfile({ ...profile, customAchs: customAchs.filter((a) => a.id !== id) });
  };

  const initials = (profile.name || "").trim()
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "??";

  const save = async () => {
    await saveProfile(form);
    setEditing(false);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Profile</h1>
          <div className="sub">MEMBER SINCE {(profile.memberSince || "").toUpperCase()}</div>
        </div>
      </div>

      <div className="profile-head">
        <div className="avatar-xl">{initials}</div>
        <div style={{ flex: 1 }}>
          {editing ? (
            <>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your name"
                style={{ ...inlineInput, fontSize: 28, fontFamily: "JetBrains Mono, monospace", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 6 }} />
              <input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                placeholder="RUNNER · 10K · EAST COAST"
                style={{ ...inlineInput, fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.12em" }} />
              <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                <PRField label="5K PR" value={form.pr5k} onChange={(v) => setForm({ ...form, pr5k: v })} />
                <PRField label="10K PR" value={form.pr10k} onChange={(v) => setForm({ ...form, pr10k: v })} />
                <PRField label="HALF PR" value={form.prHalf} onChange={(v) => setForm({ ...form, prHalf: v })} />
              </div>
            </>
          ) : (
            <>
              <h2>{profile.name}</h2>
              <div className="sub">{profile.tagline}</div>
              <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                <PRDisplay label="5K PR" value={profile.pr5k} />
                <PRDisplay label="10K PR" value={profile.pr10k} />
                <PRDisplay label="HALF PR" value={profile.prHalf} />
              </div>
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {editing ? (
            <>
              <button className="btn ghost" onClick={() => { setForm(profile); setEditing(false); }}>Cancel</button>
              <button className="btn" onClick={save}>Save</button>
            </>
          ) : (
            <button className="btn ghost" onClick={() => setEditing(true)}>Edit profile</button>
          )}
        </div>
      </div>

      <div className="lifetime-grid" style={{ marginBottom: 24 }}>
        <div>
          <div className="big">{totals.runs}</div>
          <div className="label">Runs logged</div>
        </div>
        <div>
          <div className="big">{totals.distance}</div>
          <div className="label">Km run</div>
        </div>
        <div>
          <div className="big">{Math.round(totals.duration / 3600)}h</div>
          <div className="label">Time running</div>
        </div>
        <div>
          <div className="big">{totals.elevation}m</div>
          <div className="label">Elevation gained</div>
        </div>
      </div>

      <div className="sect-title">
        <h2>Achievements</h2>
        <div className="meta">{earned.length} / {achs.length} EARNED · {customAchs.length} CUSTOM</div>
      </div>
      <div className="ach-grid">
        {[...earned, ...locked].map((a) => (
          <div key={a.id} className={`ach ${!a.earned ? "locked" : ""}`}>
            <div className="ach-icon">{a.icon}</div>
            <div>
              <div className="title">{a.title}</div>
              <div className="sub">{a.sub}</div>
            </div>
          </div>
        ))}
        {customAchs.map((a) => (
          <div key={a.id} className={`ach ${!a.earned ? "locked" : ""}`}
            style={{ cursor: "pointer", position: "relative" }}
            onClick={() => openEditAch(a)}>
            <div className="ach-icon">{a.icon || "★"}</div>
            <div style={{ flex: 1 }}>
              <div className="title">{a.title}</div>
              <div className="sub">{a.sub}</div>
            </div>
            <div className="mono" style={{ fontSize: 9, color: "var(--text-3)", alignSelf: "flex-start", paddingTop: 2 }}>CUSTOM</div>
          </div>
        ))}
        <div className="ach locked" style={{ cursor: "pointer", border: "1px dashed var(--line)" }}
          onClick={openNewAch}>
          <div className="ach-icon" style={{ fontSize: 20 }}>+</div>
          <div>
            <div className="title">Add achievement</div>
            <div className="sub">Log a race, milestone, or any personal win</div>
          </div>
        </div>
      </div>

      <CustomAchModal
        open={achModalOpen}
        onClose={() => { setAchModalOpen(false); setAchEditing(null); }}
        onSave={saveCustomAch}
        onDelete={deleteCustomAch}
        editing={achEditing}
      />
    </div>
  );
}

// --- Run detail modal ---
function RunDetail({ run, onClose, onEdit }) {
  if (!run) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, animation: "fadein 200ms",
    }} onClick={onClose}>
      <div style={{
        width: 720, maxWidth: "92vw", maxHeight: "86vh", overflow: "auto",
        background: "var(--bg-1)", border: "1px solid var(--line)",
        borderRadius: 16, padding: 32,
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              {formatDate(run.date, "full").toUpperCase()}
            </div>
            <h2 style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 28, letterSpacing: "-0.03em", margin: "6px 0 8px" }}>
              {run.routeName}
            </h2>
            <span className={`type-badge ${run.type}`}>{run.type}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {onEdit && <button className="chip" onClick={() => onEdit(run)}>✎ Edit</button>}
            <button className="chip" onClick={onClose}>ESC ✕</button>
          </div>
        </div>

        <div style={{ aspectRatio: "2.5", marginBottom: 20, borderRadius: 10, overflow: "hidden", background: "var(--bg-2)" }}>
          <RunMiniMap seed={parseInt(run.id.replace(/\D/g, "")) || 1} />
        </div>

        <div className="grid g-4" style={{ marginBottom: 24 }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Distance</div>
            <div className="display" style={{ fontSize: 28, marginTop: 4 }}>{run.distance}<span style={{ fontSize: 14, color: "var(--text-3)" }}>km</span></div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Duration</div>
            <div className="display" style={{ fontSize: 28, marginTop: 4 }}>{formatDuration(run.duration)}</div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Avg pace</div>
            <div className="display" style={{ fontSize: 28, marginTop: 4 }}>{run.paceStr}<span style={{ fontSize: 14, color: "var(--text-3)" }}>/km</span></div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Elevation</div>
            <div className="display" style={{ fontSize: 28, marginTop: 4 }}>{run.elevation}<span style={{ fontSize: 14, color: "var(--text-3)" }}>m</span></div>
          </div>
        </div>

        {run.segments && run.segments.length > 0 && (
          <>
            <div className="sect-title" style={{ margin: "0 0 12px" }}>
              <h2>Intervals</h2>
              <div className="meta">{run.segments.length} SEGMENTS</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
              <div style={{
                display: "grid", gridTemplateColumns: "32px 1fr 1fr 1fr 2fr",
                gap: 12, padding: "8px 12px",
                fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em",
                borderBottom: "1px solid var(--line)",
              }}>
                <div>#</div><div>Distance</div><div>Duration</div><div>Speed / Pace</div><div>Note</div>
              </div>
              {run.segments.map((s, i) => {
                const speed = s.pace ? +(3600 / s.pace).toFixed(1) : 0;
                return (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "32px 1fr 1fr 1fr 2fr",
                    gap: 12, padding: "10px 12px",
                    background: "var(--bg-2)", borderRadius: 8,
                    fontFamily: "JetBrains Mono, monospace", fontSize: 13,
                  }}>
                    <div style={{ color: "var(--text-3)" }}>{i + 1}</div>
                    <div>{s.distance}<span style={{ color: "var(--text-3)" }}>km</span></div>
                    <div>{formatDuration(s.duration)}</div>
                    <div>{speed || "—"}<span style={{ color: "var(--text-3)", fontSize: 11 }}> km/h</span> <span style={{ color: "var(--text-3)" }}>· {secondsToPace(s.pace)}</span></div>
                    <div style={{ color: "var(--text-2)" }}>{s.note || "—"}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {run.splits && run.splits.length > 0 && (
          <>
            <div className="sect-title" style={{ margin: "0 0 12px" }}>
              <h2>Splits</h2>
              <div className="meta">{run.splits.length} KILOMETERS</div>
            </div>
            <SplitsChart splits={run.splits} />
          </>
        )}

        <div className="grid g-3" style={{ marginTop: 20 }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Avg HR</div>
            <div className="display" style={{ fontSize: 20, marginTop: 4 }}>{run.hr}<span style={{ fontSize: 12, color: "var(--text-3)" }}> bpm</span></div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Cadence</div>
            <div className="display" style={{ fontSize: 20, marginTop: 4 }}>{run.cadence}<span style={{ fontSize: 12, color: "var(--text-3)" }}> spm</span></div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Feel</div>
            <div className="display" style={{ fontSize: 20, marginTop: 4 }}>
              {"●".repeat(run.feel)}<span style={{ color: "var(--text-3)" }}>{"●".repeat(5 - run.feel)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const inlineInput = {
  background: "var(--bg-2)",
  border: "1px solid var(--line)",
  borderRadius: 6,
  padding: "6px 10px",
  color: "var(--text)",
  outline: "none",
  width: "100%",
  maxWidth: 380,
  display: "block",
};

function PRField({ label, value, onChange }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</div>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        style={{ ...inlineInput, fontFamily: "JetBrains Mono, monospace", fontSize: 18, fontWeight: 700, width: 90, marginTop: 4 }} />
    </div>
  );
}

function PRDisplay({ label, value }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</div>
      <div className="display" style={{ fontSize: 20, color: value ? "var(--text)" : "var(--text-3)" }}>{value || "—"}</div>
    </div>
  );
}

Object.assign(window, { Home, History, Stats, PersonalRecords, Profile, RunDetail });
