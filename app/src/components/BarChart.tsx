// Enkelt grupperat stapeldiagram i SVG (inga externa beroenden).
export function BarChart({
  data,
  aLabel,
  bLabel,
}: {
  data: { label: string; a: number; b: number }[];
  aLabel: string;
  bLabel: string;
}) {
  const W = 640;
  const H = 220;
  const pad = { l: 56, r: 8, t: 8, b: 24 };
  const max = Math.max(1000, ...data.flatMap((d) => [d.a, d.b]));
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const slot = iw / data.length;
  const bw = Math.min(14, slot / 3);
  const y = (v: number) => pad.t + ih - (Math.max(0, v) / top) * ih;
  const fmt = new Intl.NumberFormat("sv-SE", { notation: "compact" });

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${aLabel} och ${bLabel} per månad`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {fmt.format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + slot * i + slot / 2;
          return (
            <g key={i}>
              <rect x={cx - bw - 1} y={y(d.a)} width={bw} height={pad.t + ih - y(d.a)} rx="2" fill="var(--ink)">
                <title>{`${d.label}: ${aLabel} ${fmt.format(d.a)} kr`}</title>
              </rect>
              <rect x={cx + 1} y={y(d.b)} width={bw} height={pad.t + ih - y(d.b)} rx="2" fill="var(--chart-2)">
                <title>{`${d.label}: ${bLabel} ${fmt.format(d.b)} kr`}</title>
              </rect>
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">
                {d.label.replace(".", "")}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-ink" />{aLabel}</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--chart-2)" }} />{bLabel}</span>
      </div>
    </div>
  );
}

function niceStep(raw: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const f = raw / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}
