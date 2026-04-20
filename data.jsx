// Seed data: 12 weeks of running, 3 runs/week
// Deterministic so charts look good and repeat renders are stable

const ROUTES = [
  { name: "Riverside Loop", dist: 5.2, elev: 34, vibe: "flat" },
  { name: "Hillcrest Out-and-Back", dist: 8.1, elev: 142, vibe: "hilly" },
  { name: "Park Circuit", dist: 3.8, elev: 18, vibe: "flat" },
  { name: "Bridge to Bridge", dist: 10.4, elev: 67, vibe: "rolling" },
  { name: "Forest Trail", dist: 6.5, elev: 98, vibe: "trail" },
  { name: "Harbor 5K", dist: 5.0, elev: 12, vibe: "flat" },
  { name: "Morning Tempo", dist: 7.2, elev: 45, vibe: "rolling" },
  { name: "Long Sunday", dist: 14.3, elev: 112, vibe: "rolling" },
  { name: "Track Intervals", dist: 8.0, elev: 0, vibe: "track" },
  { name: "Recovery Jog", dist: 4.2, elev: 22, vibe: "flat" },
];

const WORKOUT_TYPES = ["Easy", "Tempo", "Long", "Intervals", "Recovery", "Race"];

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paceToSeconds(paceStr) {
  const [m, s] = paceStr.split(":").map(Number);
  return m * 60 + s;
}

function secondsToPace(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function generateRuns() {
  const rand = mulberry32(42);
  const runs = [];
  // Today = April 19, 2026 (Sunday). Generate 12 weeks backwards.
  const today = new Date(2026, 3, 19);
  const weeks = 12;
  const dayOffsets = [
    [1, 3, 6], // Mon, Wed, Sat
    [0, 2, 5], // Sun, Tue, Fri
    [1, 3, 5], // Mon, Wed, Fri
  ];

  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (w * 7 + today.getDay()));
    const pattern = dayOffsets[w % 3];

    for (let i = 0; i < 3; i++) {
      const runDate = new Date(weekStart);
      runDate.setDate(weekStart.getDate() + pattern[i]);
      if (runDate > today) continue;

      // Vary workout type across the week
      let type, route, basePace;
      if (i === 0) {
        type = rand() > 0.5 ? "Easy" : "Recovery";
        route = ROUTES[Math.floor(rand() * 4)];
        basePace = 320 + rand() * 30; // 5:20-5:50
      } else if (i === 1) {
        type = rand() > 0.4 ? "Tempo" : "Intervals";
        route = type === "Intervals" ? ROUTES[8] : ROUTES[6];
        basePace = 270 + rand() * 20; // 4:30-4:50
      } else {
        type = "Long";
        route = ROUTES[7];
        basePace = 310 + rand() * 25;
      }

      // Progression: get faster over time
      const progression = ((weeks - w) / weeks) * 18; // up to 18s faster
      const pace = Math.max(240, basePace - progression + (rand() - 0.5) * 15);
      const dist = route.dist * (0.95 + rand() * 0.1);
      const duration = Math.round(pace * dist);

      // Heart rate and cadence
      const hr = Math.round(148 + (type === "Intervals" || type === "Tempo" ? 20 : 0) + rand() * 10);
      const cadence = Math.round(172 + rand() * 8);

      // Splits
      const splitCount = Math.floor(dist);
      const splits = [];
      for (let s = 0; s < splitCount; s++) {
        const splitPace = pace + (rand() - 0.5) * 25;
        splits.push(Math.round(splitPace));
      }

      runs.push({
        id: `run-${w}-${i}`,
        date: runDate,
        type,
        routeName: route.name,
        vibe: route.vibe,
        distance: +dist.toFixed(2),
        duration,
        pace: Math.round(pace),
        paceStr: secondsToPace(pace),
        elevation: Math.round(route.elev * (0.9 + rand() * 0.2)),
        hr,
        cadence,
        splits,
        feel: Math.round(2 + rand() * 3), // 2-5
      });
    }
  }

  return runs.sort((a, b) => b.date - a.date);
}

const RUNS = generateRuns();

// Aggregate weekly stats
function weeklyStats(runs) {
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
      avgPace: Math.round(w.paces.reduce((a, b) => a + b, 0) / w.paces.length),
    }))
    .sort((a, b) => a.date - b.date);
}

const WEEKLY = weeklyStats(RUNS);

// Totals
const TOTALS = {
  runs: RUNS.length,
  distance: +RUNS.reduce((a, r) => a + r.distance, 0).toFixed(1),
  duration: RUNS.reduce((a, r) => a + r.duration, 0),
  elevation: RUNS.reduce((a, r) => a + r.elevation, 0),
  avgPace: Math.round(RUNS.reduce((a, r) => a + r.pace, 0) / RUNS.length),
};

// Goals
const GOALS = [
  { id: "g1", title: "Run 150km this month", target: 150, current: 96.4, unit: "km", due: "April 30", done: false },
  { id: "g2", title: "Sub-22 5K time trial", target: 22, current: 22.8, unit: "min", due: "May 15", done: false },
  { id: "g3", title: "10 runs in April", target: 10, current: 8, unit: "runs", due: "April 30", done: false },
  { id: "g4", title: "Long run ≥ 15km", target: 15, current: 15.2, unit: "km", due: "Achieved", done: true },
  { id: "g5", title: "Keep streak ≥ 3 weeks", target: 3, current: 3, unit: "weeks", due: "Ongoing", done: true },
];

// Achievements
const ACHIEVEMENTS = [
  { id: "a1", title: "First 10K", sub: "Bridge to Bridge · Feb 8", earned: true, icon: "10K" },
  { id: "a2", title: "Sub-5 pace", sub: "Interval session · Mar 22", earned: true, icon: "5:00" },
  { id: "a3", title: "100km month", sub: "March 2026", earned: true, icon: "100" },
  { id: "a4", title: "30-day streak", sub: "Mar 1 → Mar 30", earned: true, icon: "30" },
  { id: "a5", title: "Half marathon", sub: "Complete 21.1km run", earned: false, icon: "21K" },
  { id: "a6", title: "500km total", sub: "Lifetime distance", earned: false, icon: "500" },
];

// Training plan — next 4 weeks
function generatePlan() {
  const plan = [];
  const today = new Date(2026, 3, 19);
  const plans = [
    { day: 1, type: "Easy", dist: 6, desc: "Zone 2 recovery" },
    { day: 3, type: "Intervals", dist: 8, desc: "6×800m @ 5K pace" },
    { day: 5, type: "Tempo", dist: 7, desc: "20min @ threshold" },
    { day: 6, type: "Long", dist: 16, desc: "Steady aerobic" },
  ];
  for (let w = 0; w < 4; w++) {
    for (const p of plans) {
      const d = new Date(today);
      d.setDate(today.getDate() + w * 7 + p.day);
      plan.push({
        id: `p-${w}-${p.day}`,
        date: d,
        type: p.type,
        distance: p.dist + (w * 0.5),
        desc: p.desc,
        done: false,
      });
    }
  }
  return plan;
}

const PLAN = generatePlan();

// Streak calculation
function calcStreak() {
  // consecutive weeks with ≥ 2 runs
  let streak = 0;
  for (let i = WEEKLY.length - 1; i >= 0; i--) {
    if (WEEKLY[i].runs >= 2) streak++;
    else break;
  }
  return streak;
}
const STREAK = calcStreak();

Object.assign(window, {
  RUNS, WEEKLY, TOTALS, GOALS, ACHIEVEMENTS, PLAN, STREAK,
  formatDuration, secondsToPace, paceToSeconds,
});
