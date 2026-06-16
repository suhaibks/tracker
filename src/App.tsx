import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, LineChart, Line } from "recharts";

// ─── Storage ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "weightpath-v2";
const DEFAULT = { entries: [], goal: null, goalDate: null, unit: "kg", height: null, startWeight: null };

const load = () => { try { const r = localStorage.getItem(STORAGE_KEY); return r ? { ...DEFAULT, ...JSON.parse(r) } : DEFAULT; } catch { return DEFAULT; } };
const save = (d) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} };

// ─── Helpers ───────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];
const fmtDate = (s) => new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtDateShort = (s) => new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

function rollingAvg(entries, window = 7) {
  return entries.map((e, i) => {
    const slice = entries.slice(Math.max(0, i - window + 1), i + 1);
    const avg = slice.reduce((s, x) => s + x.weight, 0) / slice.length;
    return { ...e, avg: parseFloat(avg.toFixed(2)) };
  });
}

function calcStreak(entries) {
  if (!entries.length) return 0;
  const dates = new Set(entries.map(e => e.date));
  let streak = 0, d = new Date();
  d.setHours(0, 0, 0, 0);
  // allow today or yesterday to start
  const todayISO = d.toISOString().split("T")[0];
  const yd = new Date(d); yd.setDate(yd.getDate() - 1);
  const yISO = yd.toISOString().split("T")[0];
  if (!dates.has(todayISO) && !dates.has(yISO)) return 0;
  let cur = dates.has(todayISO) ? new Date(d) : new Date(yd);
  while (true) {
    const iso = cur.toISOString().split("T")[0];
    if (!dates.has(iso)) break;
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

function calcProjection(entries, goal) {
  if (entries.length < 3 || !goal) return null;
  const last7 = entries.slice(-7);
  const days = daysBetween(last7[0].date, last7.at(-1).date) || 1;
  const change = last7.at(-1).weight - last7[0].weight;
  const ratePerDay = change / days; // negative = losing
  if (ratePerDay >= 0) return null; // not losing
  const remaining = entries.at(-1).weight - goal;
  const daysNeeded = Math.ceil(remaining / Math.abs(ratePerDay));
  const projDate = new Date();
  projDate.setDate(projDate.getDate() + daysNeeded);
  return { date: projDate.toISOString().split("T")[0], days: daysNeeded, ratePerWeek: (ratePerDay * 7).toFixed(2) };
}

function getBMI(wKg, hCm) { if (!wKg || !hCm) return null; const m = hCm / 100; return (wKg / m / m).toFixed(1); }
function bmiLabel(b) {
  if (b < 18.5) return { label: "Underweight", color: "#60a5fa" };
  if (b < 25) return { label: "Healthy", color: "#34d399" };
  if (b < 30) return { label: "Overweight", color: "#fbbf24" };
  return { label: "Obese", color: "#f87171" };
}

function getMilestones(start, goal, current) {
  if (!start || !goal) return [];
  const total = start - goal;
  if (total <= 0) return [];
  const done = start - current;
  return [25, 50, 75, 100].map(pct => ({
    pct,
    weight: parseFloat((start - total * pct / 100).toFixed(1)),
    reached: done >= total * pct / 100,
  }));
}

// ─── Sub-components ────────────────────────────────────────────────────────
const C = {
  bg: "#0a0a14",
  surface: "#12121f",
  card: "#181828",
  border: "#232338",
  muted: "#3a3a58",
  dim: "#6b6b8f",
  text: "#e2e4f0",
  purple: "#818cf8",
  green: "#34d399",
  amber: "#fbbf24",
  red: "#f87171",
  blue: "#60a5fa",
};

const inputStyle = {
  width: "100%", background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 10, padding: "11px 14px", color: C.text, fontSize: 15,
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const labelStyle = { display: "block", fontSize: 11, color: C.dim, marginBottom: 5, textTransform: "uppercase", letterSpacing: 1 };
const cardStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 14 };

function PrimaryBtn({ children, onClick, color = C.purple, style = {} }) {
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%", padding: "12px", background: color,
      border: "none", borderRadius: 10, color: "#fff", fontSize: 14,
      fontWeight: 700, cursor: "pointer", fontFamily: "inherit", ...style,
    }}>{children}</button>
  );
}

// Arc progress component
function GoalArc({ pct, current, goal, unit, daysLeft, projDate }) {
  const r = 72, cx = 90, cy = 88;
  const circumference = Math.PI * r; // half circle
  const maxAngle = Math.PI;
  const filled = Math.min(pct / 100, 1) * circumference;
  const gap = circumference - filled;

  // Convert arc to SVG path for half-circle gauge
  const startX = cx - r, startY = cy;
  const endX = cx + r, endY = cy;

  const progress = Math.min(pct / 100, 1);
  const angle = progress * Math.PI; // 0 to PI
  const px = cx - r * Math.cos(angle);
  const py = cy - r * Math.sin(angle);

  return (
    <div style={{ textAlign: "center", padding: "8px 0 0" }}>
      <svg width="180" height="106" viewBox="0 0 180 106">
        {/* Track */}
        <path d={`M ${startX},${cy} A ${r},${r} 0 0,1 ${endX},${cy}`}
          fill="none" stroke={C.border} strokeWidth={14} strokeLinecap="round" />
        {/* Fill */}
        {pct > 0 && (
          <path d={`M ${startX},${cy} A ${r},${r} 0 0,1 ${endX},${cy}`}
            fill="none"
            stroke={pct >= 100 ? C.green : C.purple}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${gap}`}
            style={{ filter: `drop-shadow(0 0 6px ${pct >= 100 ? C.green : C.purple}88)` }}
          />
        )}
        {/* Dot at tip */}
        {pct > 2 && pct < 100 && (
          <circle cx={px} cy={py} r={7} fill={C.purple} stroke={C.bg} strokeWidth={2}
            style={{ filter: `drop-shadow(0 0 5px ${C.purple})` }} />
        )}
        {/* Center text */}
        <text x={cx} y={cy - 18} textAnchor="middle" fill={C.text} fontSize={28} fontWeight={800} fontFamily="Inter, system-ui">
          {pct >= 100 ? "🎉" : `${Math.round(pct)}%`}
        </text>
        <text x={cx} y={cy + 4} textAnchor="middle" fill={C.dim} fontSize={11} fontFamily="Inter, system-ui">
          {pct >= 100 ? "Goal reached!" : "to goal"}
        </text>
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px", marginTop: -4 }}>
        <span style={{ fontSize: 11, color: C.dim }}>{current} {unit}</span>
        <span style={{ fontSize: 11, color: C.dim }}>{goal} {unit}</span>
      </div>
      {projDate && daysLeft > 0 && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 12, color: C.dim }}>At current pace, you'll reach your goal </span>
          <span style={{ fontSize: 12, color: C.amber, fontWeight: 700 }}>
            {daysLeft <= 7 ? `in ${daysLeft} days` : `by ${fmtDateShort(projDate)}`}
          </span>
        </div>
      )}
    </div>
  );
}

function StreakBadge({ streak }) {
  if (streak === 0) return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 18 }}>💤</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>No active streak</div>
        <div style={{ fontSize: 11, color: C.dim }}>Log today to start one</div>
      </div>
    </div>
  );
  const fire = streak >= 14 ? "🔥🔥" : streak >= 7 ? "🔥" : "⚡";
  const msg = streak >= 30 ? "Unstoppable!" : streak >= 14 ? "On fire!" : streak >= 7 ? "Great consistency!" : "Keep it up!";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: C.surface, borderRadius: 10, border: `1px solid ${C.amber}44` }}>
      <span style={{ fontSize: 20 }}>{fire}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>{streak}-day streak</div>
        <div style={{ fontSize: 11, color: C.dim }}>{msg}</div>
      </div>
    </div>
  );
}

function MilestoneRow({ milestones, unit }) {
  if (!milestones.length) return null;
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {milestones.map(m => (
        <div key={m.pct} style={{
          flex: 1, textAlign: "center", padding: "10px 6px",
          background: m.reached ? "#1a2a1a" : C.surface,
          border: `1px solid ${m.reached ? C.green + "66" : C.border}`,
          borderRadius: 10,
          opacity: m.reached ? 1 : 0.55,
        }}>
          <div style={{ fontSize: 16 }}>{m.reached ? "✅" : "○"}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: m.reached ? C.green : C.dim, marginTop: 2 }}>{m.pct}%</div>
          <div style={{ fontSize: 10, color: C.dim }}>{m.weight} {unit}</div>
        </div>
      ))}
    </div>
  );
}

function PaceIndicator({ entries, unit }) {
  if (entries.length < 2) return null;
  const last = entries.at(-1);
  const weekAgo = entries.filter(e => daysBetween(e.date, last.date) <= 7);
  if (weekAgo.length < 2) return null;
  const weekChange = last.weight - weekAgo[0].weight;
  const safe = unit === "kg" ? 0.5 : 1.1;
  let icon, msg, color;
  if (weekChange >= 0) { icon = "↗"; msg = "Gaining this week"; color = C.red; }
  else if (Math.abs(weekChange) < safe * 0.5) { icon = "→"; msg = "Slow pace this week"; color = C.amber; }
  else if (Math.abs(weekChange) <= safe * 1.5) { icon = "✓"; msg = "Healthy pace"; color = C.green; }
  else { icon = "⚡"; msg = "Fast loss — check nutrition"; color = C.amber; }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 20, color, fontWeight: 900 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color }}>{msg}</div>
        <div style={{ fontSize: 11, color: C.dim }}>
          {weekChange > 0 ? "+" : ""}{weekChange.toFixed(1)} {unit} this week
          {" · "}{safe} {unit}/wk is the healthy target
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
      <div style={{ color: C.dim, marginBottom: 4 }}>{fmtDate(label)}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 700 }}>
          {p.name === "avg" ? "Trend: " : ""}{p.value} <span style={{ color: C.dim, fontWeight: 400, fontSize: 11 }}>{unit}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main App ──────────────────────────────────────────────────────────────
export default function WeightPath() {
  const [data, setData] = useState(load);
  const [weightInput, setWeightInput] = useState("");
  const [dateInput, setDateInput] = useState(todayStr());
  const [noteInput, setNoteInput] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [view, setView] = useState("home");
  const [toast, setToast] = useState("");
  const [setupStep, setSetupStep] = useState(0); // 0=done, 1=goal, 2=height

  useEffect(() => { save(data); }, [data]);
  useEffect(() => {
    if (!data.goal) setSetupStep(1);
  }, []);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  const addEntry = () => {
    const w = parseFloat(weightInput);
    if (!w || w <= 0 || w > 999) return;
    const entry = { id: Date.now(), date: dateInput, weight: w, note: noteInput.trim() };
    const updated = [...data.entries.filter(e => e.date !== dateInput), entry]
      .sort((a, b) => a.date.localeCompare(b.date));
    setData(p => ({ ...p, entries: updated, startWeight: p.startWeight ?? w }));
    setWeightInput(""); setNoteInput(""); setDateInput(todayStr());
    flash("Entry saved ✓");
  };

  const latest = data.entries.at(-1);
  const first = data.entries[0];
  const streak = calcStreak(data.entries);
  const projection = calcProjection(data.entries, data.goal);
  const withAvg = rollingAvg(data.entries);

  const totalLost = latest && first ? (first.weight - latest.weight) : 0;
  const totalToLose = first && data.goal ? (first.weight - data.goal) : 0;
  const goalPct = totalToLose > 0 ? Math.max(0, (totalLost / totalToLose) * 100) : 0;

  const milestones = getMilestones(first?.weight, data.goal, latest?.weight);

  const bmiVal = latest && data.height
    ? getBMI(data.unit === "lbs" ? latest.weight * 0.453592 : latest.weight, data.height)
    : null;
  const bmiInfo = bmiVal ? bmiLabel(parseFloat(bmiVal)) : null;

  const chartMin = withAvg.length ? Math.floor(Math.min(...withAvg.map(d => d.weight)) - 2) : 50;
  const chartMax = withAvg.length ? Math.ceil(Math.max(...withAvg.map(d => d.weight)) + 2) : 100;

  // ── Setup overlay ─────────────────────────────────────────────────────────
  if (setupStep === 1) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", justifyContent: "center", padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 420, margin: "0 auto", width: "100%" }}>
        <div style={{ fontSize: 40, marginBottom: 16, textAlign: "center" }}>🎯</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: "0 0 8px", textAlign: "center" }}>Set your goal</h1>
        <p style={{ color: C.dim, textAlign: "center", marginBottom: 28, fontSize: 14 }}>
          What weight do you want to reach? This drives your progress arc, projections, and milestones.
        </p>
        <label style={labelStyle}>My goal weight ({data.unit})</label>
        <input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && goalInput && (setData(p => ({ ...p, goal: parseFloat(goalInput) })), setSetupStep(2))}
          placeholder="e.g. 70" style={{ ...inputStyle, marginBottom: 12 }} autoFocus />
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {["kg", "lbs"].map(u => (
            <button key={u} onClick={() => setData(p => ({ ...p, unit: u }))} style={{
              flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${data.unit === u ? C.purple : C.border}`,
              background: data.unit === u ? "#1e1e3f" : C.surface, color: data.unit === u ? C.purple : C.dim,
              fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
            }}>{u}</button>
          ))}
        </div>
        <PrimaryBtn onClick={() => { const g = parseFloat(goalInput); if (g) { setData(p => ({ ...p, goal: g })); setSetupStep(2); } }}>
          Set goal →
        </PrimaryBtn>
        <button onClick={() => setSetupStep(0)} style={{ marginTop: 10, width: "100%", background: "none", border: "none", color: C.dim, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          Skip for now
        </button>
      </div>
    </div>
  );

  if (setupStep === 2) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", justifyContent: "center", padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 420, margin: "0 auto", width: "100%" }}>
        <div style={{ fontSize: 40, marginBottom: 16, textAlign: "center" }}>📏</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: "0 0 8px", textAlign: "center" }}>Your height?</h1>
        <p style={{ color: C.dim, textAlign: "center", marginBottom: 28, fontSize: 14 }}>Optional — used to calculate your BMI.</p>
        <label style={labelStyle}>Height (cm)</label>
        <input type="number" value={heightInput} onChange={e => setHeightInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (setData(p => ({ ...p, height: parseFloat(heightInput) || p.height })), setSetupStep(0))}
          placeholder="e.g. 175" style={{ ...inputStyle, marginBottom: 16 }} autoFocus />
        <PrimaryBtn onClick={() => { const h = parseFloat(heightInput); setData(p => ({ ...p, height: h || p.height })); setSetupStep(0); }}>
          Save & start tracking
        </PrimaryBtn>
        <button onClick={() => setSetupStep(0)} style={{ marginTop: 10, width: "100%", background: "none", border: "none", color: C.dim, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          Skip
        </button>
      </div>
    </div>
  );

  // ── Main App ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif", paddingBottom: 80 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 100,
          background: "#1a2a1a", border: `1px solid ${C.green}`, borderRadius: 10,
          padding: "10px 20px", fontSize: 13, color: C.green, fontWeight: 600, whiteSpace: "nowrap",
        }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "18px 20px 0" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px" }}>WeightPath</h1>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: C.dim }}>Track · project · reach</p>
            </div>
            <StreakBadge streak={streak} />
          </div>
          {/* Nav */}
          <div style={{ display: "flex" }}>
            {[["home", "Dashboard"], ["log", "Log"], ["chart", "Progress"], ["settings", "Settings"]].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)} style={{
                flex: 1, background: "none", border: "none", padding: "9px 4px",
                fontSize: 12, fontWeight: view === v ? 700 : 400,
                color: view === v ? C.purple : C.dim,
                borderBottom: `2px solid ${view === v ? C.purple : "transparent"}`,
                cursor: "pointer", fontFamily: "inherit",
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "20px 16px 0" }}>

        {/* ── HOME ─────────────────────────────────────────── */}
        {view === "home" && (
          <>
            {/* Goal arc */}
            {data.goal && latest ? (
              <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Goal progress</span>
                  <button onClick={() => setSetupStep(1)} style={{ background: "none", border: "none", color: C.dim, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                    Edit goal
                  </button>
                </div>
                <GoalArc
                  pct={goalPct}
                  current={latest.weight}
                  goal={data.goal}
                  unit={data.unit}
                  daysLeft={projection?.days}
                  projDate={projection?.date}
                />
              </div>
            ) : !data.goal ? (
              <div style={{ ...cardStyle, textAlign: "center", padding: "24px 20px" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
                <div style={{ fontSize: 14, color: C.dim, marginBottom: 12 }}>Set a goal weight to unlock your progress arc and projections</div>
                <PrimaryBtn onClick={() => setSetupStep(1)} style={{ width: "auto", display: "inline-block", padding: "10px 24px" }}>
                  Set my goal
                </PrimaryBtn>
              </div>
            ) : (
              <div style={{ ...cardStyle, textAlign: "center", padding: "24px 20px" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⚖️</div>
                <div style={{ fontSize: 14, color: C.dim, marginBottom: 12 }}>Log your first weigh-in to see your progress arc</div>
                <PrimaryBtn onClick={() => setView("log")} style={{ width: "auto", display: "inline-block", padding: "10px 24px" }}>
                  Log first entry
                </PrimaryBtn>
              </div>
            )}

            {/* Milestones */}
            {milestones.length > 0 && (
              <div style={cardStyle}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Milestones</div>
                <MilestoneRow milestones={milestones} unit={data.unit} />
              </div>
            )}

            {/* Quick stats */}
            {latest && (
              <div style={cardStyle}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>This week</div>
                <PaceIndicator entries={data.entries} unit={data.unit} />
                {bmiVal && (
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", padding: "10px 14px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 12, color: C.dim }}>BMI</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: bmiInfo.color }}>{bmiVal} · {bmiInfo.label}</span>
                  </div>
                )}
                {projection && (
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", padding: "10px 14px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 12, color: C.dim }}>Rate (7-day)</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{projection.ratePerWeek} {data.unit}/wk</span>
                  </div>
                )}
              </div>
            )}

            {/* Quick log */}
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Quick log</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" value={weightInput} onChange={e => setWeightInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addEntry()}
                  placeholder={latest ? `Last: ${latest.weight}` : `Weight (${data.unit})`}
                  style={{ ...inputStyle, flex: 1 }} />
                <PrimaryBtn onClick={addEntry} style={{ width: "auto", padding: "0 20px", flex: "none" }}>
                  Log
                </PrimaryBtn>
              </div>
            </div>
          </>
        )}

        {/* ── LOG ──────────────────────────────────────────── */}
        {view === "log" && (
          <>
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Add entry</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Weight ({data.unit})</label>
                  <input type="number" value={weightInput} onChange={e => setWeightInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addEntry()}
                    placeholder={latest ? String(latest.weight) : "0.0"} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Note (optional)</label>
                <input type="text" value={noteInput} onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addEntry()}
                  placeholder="e.g. After morning run" style={inputStyle} />
              </div>
              <PrimaryBtn onClick={addEntry}>Save entry</PrimaryBtn>
            </div>

            {data.entries.length > 0 ? (
              <div style={cardStyle}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>History</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[...data.entries].reverse().map((e) => {
                    const idx = data.entries.findIndex(x => x.id === e.id);
                    const prev = data.entries[idx - 1];
                    const diff = prev ? (e.weight - prev.weight).toFixed(1) : null;
                    return (
                      <div key={e.id} style={{ display: "flex", alignItems: "center", background: C.surface, borderRadius: 10, padding: "11px 14px", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: C.dim }}>{fmtDate(e.date)}</div>
                          {e.note && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{e.note}</div>}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontWeight: 700 }}>{e.weight}</span>
                          <span style={{ fontSize: 11, color: C.dim, marginLeft: 3 }}>{data.unit}</span>
                          {diff !== null && (
                            <div style={{ fontSize: 11, color: parseFloat(diff) < 0 ? C.green : parseFloat(diff) > 0 ? C.red : C.dim, marginTop: 1 }}>
                              {parseFloat(diff) > 0 ? "+" : ""}{diff}
                            </div>
                          )}
                        </div>
                        <button onClick={() => setData(p => ({ ...p, entries: p.entries.filter(x => x.id !== e.id) }))}
                          style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 0 0 4px" }}>×</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "48px 0", color: C.muted }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>⚖️</div>
                <div>Log your first entry above to get started</div>
              </div>
            )}
          </>
        )}

        {/* ── CHART ────────────────────────────────────────── */}
        {view === "chart" && (
          <>
            {withAvg.length >= 2 ? (
              <>
                <div style={cardStyle}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Weight & trend (7-day avg)</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={withAvg} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}>
                      <defs>
                        <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.purple} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={C.purple} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                      <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: C.dim, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[chartMin, chartMax]} tick={{ fill: C.dim, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip unit={data.unit} />} />
                      {data.goal && (
                        <ReferenceLine y={data.goal} stroke={C.amber} strokeDasharray="4 3"
                          label={{ value: "Goal", position: "insideTopRight", fill: C.amber, fontSize: 10 }} />
                      )}
                      <Area type="monotone" dataKey="weight" name="weight" stroke={C.purple} strokeWidth={2}
                        fill="url(#wGrad)" dot={{ r: 3, fill: C.purple, stroke: C.bg, strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
                      {withAvg.length >= 4 && (
                        <Line type="monotone" dataKey="avg" name="avg" stroke={C.green} strokeWidth={2}
                          dot={false} strokeDasharray="0" />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 16, marginTop: 8, justifyContent: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.dim }}>
                      <div style={{ width: 12, height: 3, background: C.purple, borderRadius: 2 }} />Daily
                    </div>
                    {withAvg.length >= 4 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.dim }}>
                        <div style={{ width: 12, height: 3, background: C.green, borderRadius: 2 }} />7-day trend
                      </div>
                    )}
                    {data.goal && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.dim }}>
                        <div style={{ width: 12, height: 2, background: C.amber, borderRadius: 2, opacity: 0.7 }} />Goal
                      </div>
                    )}
                  </div>
                </div>

                <div style={cardStyle}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Stats</div>
                  {[
                    ["Start", `${first.weight} ${data.unit}`, null],
                    ["Current", `${latest.weight} ${data.unit}`, null],
                    ["Total lost", `${totalLost > 0 ? totalLost.toFixed(1) : (0).toFixed(1)} ${data.unit}`, totalLost > 0 ? C.green : null],
                    data.goal ? ["To goal", `${Math.max(0, latest.weight - data.goal).toFixed(1)} ${data.unit}`, C.amber] : null,
                    projection ? ["Projected arrival", fmtDateShort(projection.date), C.amber] : null,
                    projection ? ["Current pace", `${projection.ratePerWeek} ${data.unit}/wk`, C.green] : null,
                    bmiVal ? ["BMI", `${bmiVal} · ${bmiInfo.label}`, bmiInfo.color] : null,
                    ["Entries logged", data.entries.length, null],
                    ["Tracking since", fmtDateShort(first.date), null],
                  ].filter(Boolean).map(([label, value, color]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                      <span style={{ color: C.dim }}>{label}</span>
                      <span style={{ color: color || C.text, fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "64px 0", color: C.muted }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📈</div>
                <div>Log at least 2 entries to see your chart</div>
              </div>
            )}
          </>
        )}

        {/* ── SETTINGS ─────────────────────────────────────── */}
        {view === "settings" && (
          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Settings</div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Unit</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["kg", "lbs"].map(u => (
                  <button key={u} onClick={() => setData(p => ({ ...p, unit: u }))} style={{
                    flex: 1, padding: "10px", borderRadius: 10,
                    border: `1px solid ${data.unit === u ? C.purple : C.border}`,
                    background: data.unit === u ? "#1e1e3f" : C.surface,
                    color: data.unit === u ? C.purple : C.dim,
                    fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                  }}>{u}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Goal weight ({data.unit})</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" placeholder={data.goal ? String(data.goal) : "e.g. 70"}
                  value={goalInput} onChange={e => setGoalInput(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <PrimaryBtn onClick={() => { const g = parseFloat(goalInput); if (g) { setData(p => ({ ...p, goal: g })); setGoalInput(""); flash("Goal updated ✓"); } }}
                  style={{ width: "auto", padding: "0 18px", flex: "none" }}>Save</PrimaryBtn>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Height (cm) — for BMI</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" placeholder={data.height ? String(data.height) : "e.g. 175"}
                  value={heightInput} onChange={e => setHeightInput(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <PrimaryBtn onClick={() => { const h = parseFloat(heightInput); if (h) { setData(p => ({ ...p, height: h })); setHeightInput(""); flash("Height saved ✓"); } }}
                  style={{ width: "auto", padding: "0 18px", flex: "none" }}>Save</PrimaryBtn>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <label style={{ ...labelStyle, color: C.red }}>Danger zone</label>
              <button onClick={() => {
                if (window.confirm("Delete all entries and settings?")) {
                  setData(DEFAULT); localStorage.removeItem(STORAGE_KEY); flash("Data cleared");
                }
              }} style={{
                marginTop: 8, width: "100%", padding: "12px",
                background: "#1a0d0d", border: `1px solid ${C.red}`,
                borderRadius: 10, color: C.red, fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}>Clear all data</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
