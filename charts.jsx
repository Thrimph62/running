// Charts — hand-drawn SVG

const { useState, useMemo, useRef, useEffect } = React;

function LineChart({ data, valueKey = "distance", height = 220, unit = "km", label = "Distance" }) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const w = 800;
  const h = height;
  const padL = 40, padR = 16, padT = 16, padB = 28;

  const values = data.map((d) => d[valueKey]);
  const maxV = Math.max(...values) * 1.15;
  const minV = 0;

  const x = (i) => padL + ((w - padL - padR) * i) / Math.max(1, data.length - 1);
  const y = (v) => padT + (h - padT - padB) * (1 - (v - minV) / (maxV - minV));

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d[valueKey])}`).join(" ");
  const areaPath = `${linePath} L${x(data.length - 1)},${h - padB} L${x(0)},${h - padB} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={ref}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height, display: "block" }}
        onMouseMove={(e) => {
          const rect = ref.current.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * w;
          const idx = Math.round(((relX - padL) / (w - padL - padR)) * (data.length - 1));
          if (idx >= 0 && idx < data.length) {
            setHover({ idx, screenX: e.clientX - rect.left, screenY: e.clientY - rect.top });
          }
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines.map((g, i) => (
          <line
            key={i}
            x1={padL} x2={w - padR}
            y1={padT + (h - padT - padB) * g}
            y2={padT + (h - padT - padB) * g}
            stroke="var(--line)" strokeWidth="1"
          />
        ))}
        {gridLines.map((g, i) => {
          const val = maxV * (1 - g);
          return (
            <text key={`l-${i}`} x={padL - 8} y={padT + (h - padT - padB) * g + 4}
              textAnchor="end" fontSize="10" fill="var(--text-3)" fontFamily="JetBrains Mono">
              {Math.round(val)}
            </text>
          );
        })}
        <path d={areaPath} fill="url(#areaGrad)" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d[valueKey])} r={hover?.idx === i ? 5 : 0}
            fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />
        ))}
        {hover && (
          <line x1={x(hover.idx)} x2={x(hover.idx)} y1={padT} y2={h - padB}
            stroke="var(--line-2)" strokeWidth="1" strokeDasharray="3,3" />
        )}
        {/* X axis labels */}
        {data.map((d, i) => {
          if (i % Math.ceil(data.length / 6) !== 0) return null;
          const date = d.date;
          return (
            <text key={`x-${i}`} x={x(i)} y={h - 10} textAnchor="middle"
              fontSize="10" fill="var(--text-3)" fontFamily="JetBrains Mono">
              {date.toLocaleDateString("en", { month: "short", day: "numeric" })}
            </text>
          );
        })}
      </svg>
      {hover && data[hover.idx] && (
        <div className="tooltip" style={{ left: hover.screenX, top: hover.screenY }}>
          <div><span className="k">WEEK </span><span className="v">{data[hover.idx].date.toLocaleDateString("en", { month: "short", day: "numeric" })}</span></div>
          <div><span className="k">{label.toUpperCase()} </span><span className="v">{data[hover.idx][valueKey]}{unit}</span></div>
        </div>
      )}
    </div>
  );
}

function BarChart({ data, valueKey = "distance", height = 200, unit = "km" }) {
  const [hover, setHover] = useState(null);
  const w = 800;
  const h = height;
  const padL = 40, padR = 16, padT = 16, padB = 28;
  const values = data.map((d) => d[valueKey]);
  const maxV = Math.max(...values) * 1.15;
  const barW = (w - padL - padR) / data.length - 6;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
      {[0, 0.5, 1].map((g, i) => (
        <line key={i} x1={padL} x2={w - padR}
          y1={padT + (h - padT - padB) * g}
          y2={padT + (h - padT - padB) * g}
          stroke="var(--line)" strokeWidth="1" />
      ))}
      {data.map((d, i) => {
        const v = d[valueKey];
        const bh = ((h - padT - padB) * v) / maxV;
        const bx = padL + i * ((w - padL - padR) / data.length) + 3;
        const by = h - padB - bh;
        const isHover = hover === i;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={bx} y={padT} width={barW} height={h - padT - padB} fill="transparent" />
            <rect x={bx} y={by} width={barW} height={bh}
              fill={isHover ? "var(--accent)" : "color-mix(in oklab, var(--accent) 70%, transparent)"}
              rx="2" />
            {isHover && (
              <text x={bx + barW / 2} y={by - 6} textAnchor="middle"
                fontSize="11" fill="var(--accent)" fontFamily="JetBrains Mono" fontWeight="700">
                {v}{unit}
              </text>
            )}
          </g>
        );
      })}
      {data.map((d, i) => (
        <text key={`lbl-${i}`}
          x={padL + i * ((w - padL - padR) / data.length) + barW / 2 + 3}
          y={h - 10} textAnchor="middle"
          fontSize="10" fill="var(--text-3)" fontFamily="JetBrains Mono">
          W{i + 1}
        </text>
      ))}
    </svg>
  );
}

function Sparkline({ values, color = "var(--accent)", height = 40, width = 120 }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height * 0.9 - height * 0.05;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function PaceDistribution({ runs }) {
  // buckets of pace
  const buckets = {};
  const min = 4, max = 7;
  const step = 0.25;
  for (let p = min; p < max; p += step) {
    const key = p.toFixed(2);
    buckets[key] = 0;
  }
  runs.forEach((r) => {
    const pMin = r.pace / 60;
    const bucket = Math.floor(pMin / step) * step;
    const key = bucket.toFixed(2);
    if (buckets[key] !== undefined) buckets[key]++;
  });
  const entries = Object.entries(buckets);
  const maxCount = Math.max(...entries.map(([, c]) => c));
  const w = 800, h = 160;
  const padL = 40, padR = 16, padT = 16, padB = 28;
  const barW = (w - padL - padR) / entries.length - 4;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h, display: "block" }}>
      {entries.map(([p, count], i) => {
        const bh = maxCount ? ((h - padT - padB) * count) / maxCount : 0;
        const bx = padL + i * ((w - padL - padR) / entries.length) + 2;
        const by = h - padB - bh;
        return (
          <g key={p}>
            <rect x={bx} y={by} width={barW} height={bh}
              fill={count > 0 ? "var(--accent)" : "var(--bg-3)"}
              rx="2" />
            {i % 2 === 0 && (
              <text x={bx + barW / 2} y={h - 10} textAnchor="middle"
                fontSize="10" fill="var(--text-3)" fontFamily="JetBrains Mono">
                {p}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function RunMiniMap({ seed = 1, color = "var(--accent)" }) {
  // deterministic squiggle
  const rand = (n) => {
    let t = (seed * 9301 + n * 49297) % 233280;
    return t / 233280;
  };
  const pts = [];
  let x = 20, y = 60;
  for (let i = 0; i < 30; i++) {
    x += 3 + rand(i) * 4;
    y += (rand(i + 100) - 0.5) * 18;
    y = Math.max(15, Math.min(105, y));
    pts.push([x, y]);
  }
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  return (
    <svg viewBox="0 0 140 120" width="100%" height="100%" style={{ display: "block" }}>
      <rect width="140" height="120" fill="var(--bg-2)" rx="6" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[0][0]} cy={pts[0][1]} r="3" fill={color} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill="white" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function SplitsChart({ splits }) {
  const w = 600, h = 120;
  const padL = 30, padR = 10, padT = 16, padB = 24;
  const max = Math.max(...splits) * 1.1;
  const min = Math.min(...splits) * 0.9;
  const barW = (w - padL - padR) / splits.length - 4;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h, display: "block" }}>
      {splits.map((s, i) => {
        const norm = (s - min) / (max - min);
        const bh = (h - padT - padB) * norm;
        const bx = padL + i * ((w - padL - padR) / splits.length) + 2;
        const by = h - padB - bh;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={barW} height={bh}
              fill="var(--accent)" opacity={0.6 + i / splits.length * 0.4} rx="2" />
            <text x={bx + barW / 2} y={h - 8} textAnchor="middle"
              fontSize="9" fill="var(--text-3)" fontFamily="JetBrains Mono">
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

Object.assign(window, { LineChart, BarChart, Sparkline, PaceDistribution, RunMiniMap, SplitsChart });
