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
      <div className="metric">{run.paceStr}<span className="u">/km</span></div>
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
  const { runs } = useData();
  const weekly = uM(() => computeWeekly(runs), [runs]);
  const recent = runs.slice(0, 5);
  const thisWeek = weekly[weekly.length - 1];
  const lastWeek = weekly[weekly.length - 2];
  const deltaDist = thisWeek && lastWeek ? +(thisWeek.distance - lastWeek.distance).toFixed(1) : 0;
  const deltaPace = thisWeek && lastWeek ? thisWeek.avgPace - lastWeek.avgPace : 0;

  const now = new Date();
  const monthDist = runs
    .filter((r) => r.date.getMonth() === now.getMonth() && r.date.getFullYear() === now.getFullYear())
    .reduce((a, r) => a + r.distance, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Good morning, Alex.</h1>
          <div className="sub">SUNDAY · APRIL 19, 2026 · {STREAK}-WEEK STREAK</div>
        </div>
        <div className="right">
          <button className="btn ghost" onClick={onAddRun}>+ Log run</button>
          <button className="btn" onClick={onAddRun}>Quick add</button>
        </div>
      </div>

      <div className="grid g-4" style={{ marginBottom: 24 }}>
        <div className="stat hero">
          <div className="label">This week</div>
          <div className="big">{thisWeek?.distance || 0}<span className="unit">km</span></div>
          <div className="delta">
            {deltaDist >= 0 ? "↑" : "↓"} {Math.abs(deltaDist)}km vs last week
          </div>
        </div>
        <div className="stat">
          <div className="label">Avg pace · week</div>
          <div className="big">{secondsToPace(thisWeek?.avgPace || 0)}<span className="unit">/km</span></div>
          <div className={`delta ${deltaPace < 0 ? "up" : "down"}`}>
            {deltaPace < 0 ? "↑" : "↓"} {Math.abs(deltaPace)}s vs last week
          </div>
        </div>
        <div className="stat">
          <div className="label">This month</div>
          <div className="big">{monthDist.toFixed(1)}<span className="unit">km</span></div>
          <div className="delta">Goal: 150km · {Math.round((monthDist / 150) * 100)}%</div>
        </div>
        <div className="stat">
          <div className="label">Runs this week</div>
          <div className="big">{thisWeek?.runs || 0}<span className="unit">/3</span></div>
          <div className="delta up">on schedule</div>
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
          <div>Date</div><div>Route</div><div>Distance</div><div>Duration</div><div>Pace</div><div>Splits</div>
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

// --- Goals ---
function Goals() {
  const { goals, toggleGoal } = useData();

  const active = goals.filter((g) => !g.done);
  const done = goals.filter((g) => g.done);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Goals & streaks</h1>
          <div className="sub">{active.length} ACTIVE · {done.length} COMPLETED</div>
        </div>
        <div className="right">
          <button className="btn">+ New goal</button>
        </div>
      </div>

      <div className="grid g-3" style={{ marginBottom: 24 }}>
        <div className="stat hero">
          <div className="label">Current streak</div>
          <div className="big">{STREAK}<span className="unit">weeks</span></div>
          <div className="delta">best ever — keep it going</div>
        </div>
        <div className="stat">
          <div className="label">Runs this month</div>
          <div className="big">8<span className="unit">/10</span></div>
          <div className="delta up">on pace for goal</div>
        </div>
        <div className="stat">
          <div className="label">Consistency</div>
          <div className="big">92<span className="unit">%</span></div>
          <div className="delta">vs your 3-run/week target</div>
        </div>
      </div>

      <div className="sect-title">
        <h2>Active goals</h2>
        <div className="meta">TAP TO MARK COMPLETE</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {active.map((g) => {
          const pct = Math.min(100, Math.round((g.current / g.target) * 100));
          return (
            <div key={g.id} className="goal">
              <div className="goal-check" onClick={() => toggleGoal(g.id)} />
              <div className="goal-body">
                <div className="goal-title">{g.title}</div>
                <div className="goal-bar">
                  <div className="fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="goal-meta">{g.current}{g.unit} of {g.target}{g.unit} · due {g.due}</div>
              </div>
              <div className="goal-pct">{pct}%</div>
            </div>
          );
        })}
      </div>

      {done.length > 0 && (
        <>
          <div className="sect-title">
            <h2>Completed</h2>
            <div className="meta">{done.length}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {done.map((g) => (
              <div key={g.id} className="goal done">
                <div className="goal-check done" onClick={() => toggleGoal(g.id)}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="goal-body">
                  <div className="goal-title">{g.title}</div>
                  <div className="goal-meta">{g.due}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Plan (calendar) ---
function Plan() {
  const { plan: planState, togglePlan: togglePlanItem, runs } = useData();
  const today = new Date();

  // Build a 4-week grid starting from this week's Monday
  const startMonday = new Date(today);
  startMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  const weeks = [];
  for (let w = 0; w < 4; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(startMonday);
      date.setDate(startMonday.getDate() + w * 7 + d);
      const planItem = planState.find((p) => p.date.toDateString() === date.toDateString());
      const completedRun = runs.find((r) => r.date.toDateString() === date.toDateString());
      week.push({ date, planItem, completedRun });
    }
    weeks.push(week);
  }

  const weekTotals = weeks.map((w) =>
    w.reduce((a, d) => a + (d.planItem?.distance || 0), 0)
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Training plan</h1>
          <div className="sub">4-WEEK BLOCK · 10K BUILD · MAY 17</div>
        </div>
        <div className="right">
          <button className="btn ghost">Edit plan</button>
        </div>
      </div>

      <div className="cal-grid" style={{ marginBottom: 6 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="cal-head">{d}</div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} style={{ marginBottom: 12 }}>
          <div className="cal-grid">
            {week.map((day, di) => {
              const isToday = day.date.toDateString() === today.toDateString();
              const isPast = day.date < today && !isToday;
              const hasWorkout = !!day.planItem;
              const isDone = day.planItem?.done || !!day.completedRun;
              return (
                <div key={di}
                  className={`cal-cell ${isPast ? "past" : ""} ${isToday ? "today" : ""} ${hasWorkout ? "has-workout" : ""} ${isDone ? "done" : ""}`}
                  onClick={() => day.planItem && togglePlanItem(day.planItem.id)}>
                  <div className="num">{day.date.getDate()}</div>
                  {isDone && <div className="dot" />}
                  {day.planItem && (
                    <div className="wk">
                      <span className={`type-badge ${day.planItem.type}`}>{day.planItem.type}</span>
                      <div className="d">{day.planItem.distance}km · {day.planItem.desc}</div>
                    </div>
                  )}
                  {day.completedRun && !day.planItem && (
                    <div className="wk">
                      <span className={`type-badge ${day.completedRun.type}`}>{day.completedRun.type}</span>
                      <div className="d">{day.completedRun.distance}km · done</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{
            display: "flex", justifyContent: "flex-end",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11, color: "var(--text-3)",
            padding: "6px 4px 0",
          }}>
            WEEK {wi + 1} · {weekTotals[wi].toFixed(1)}km planned
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Profile ---
function Profile() {
  const { runs } = useData();
  const totals = uM(() => computeTotals(runs), [runs]);
  const [achs, setAchs] = uS(ACHIEVEMENTS);
  const earned = achs.filter((a) => a.earned);
  const locked = achs.filter((a) => !a.earned);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Profile</h1>
          <div className="sub">MEMBER SINCE JAN 2024</div>
        </div>
      </div>

      <div className="profile-head">
        <div className="avatar-xl">AX</div>
        <div style={{ flex: 1 }}>
          <h2>Alex Chen</h2>
          <div className="sub">RUNNER · 10K SPECIALIST · EAST COAST</div>
          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            <div>
              <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>5K PR</div>
              <div className="display" style={{ fontSize: 20 }}>22:08</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>10K PR</div>
              <div className="display" style={{ fontSize: 20 }}>46:42</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>HALF PR</div>
              <div className="display" style={{ fontSize: 20, color: "var(--text-3)" }}>—</div>
            </div>
          </div>
        </div>
        <div>
          <button className="btn ghost">Edit profile</button>
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
        <div className="meta">{earned.length} / {achs.length} EARNED</div>
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
      </div>
    </div>
  );
}

// --- Run detail modal ---
function RunDetail({ run, onClose }) {
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
          <button className="chip" onClick={onClose}>ESC ✕</button>
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

        <div className="sect-title" style={{ margin: "0 0 12px" }}>
          <h2>Splits</h2>
          <div className="meta">{run.splits.length} KILOMETERS</div>
        </div>
        <SplitsChart splits={run.splits} />

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

Object.assign(window, { Home, History, Stats, Goals, Plan, Profile, RunDetail });
