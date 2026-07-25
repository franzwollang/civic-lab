import { useNavigate } from "react-router";
import type { CollectionRow } from "../../doc/types";

/**
 * Approximate marker positions on a 1000×500 equirectangular plane
 * (lon/lat → x = (lon+180)/360*1000, y = (90-lat)/180*500).
 */
const MARKERS: Array<{
  code: string;
  label: string;
  x: number;
  y: number;
}> = [
  { code: "US", label: "United States", x: 220, y: 170 },
  { code: "CA", label: "Canada", x: 230, y: 120 },
  { code: "MX", label: "Mexico", x: 210, y: 230 },
  { code: "GB", label: "United Kingdom", x: 480, y: 130 },
  { code: "DE", label: "Germany", x: 520, y: 140 },
  { code: "BR", label: "Brazil", x: 340, y: 320 },
  { code: "IN", label: "India", x: 700, y: 230 },
  { code: "JP", label: "Japan", x: 860, y: 180 },
  { code: "AU", label: "Australia", x: 850, y: 360 },
  { code: "ZA", label: "South Africa", x: 560, y: 370 },
];

type Props = {
  collections: CollectionRow[];
};

/**
 * Flat SVG map picker for Country Manuals (CONCEPT §1.2).
 * Seeded countries open their Collection; others show as planned.
 * Full 3D globe is deferred.
 */
export function ManualsMap({ collections }: Props) {
  const navigate = useNavigate();
  const byCode = new Map(
    collections
      .filter((c) => c.country_code)
      .map((c) => [c.country_code!.toUpperCase(), c]),
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-b from-sky-50 via-neutral-50 to-emerald-50/40">
      <div className="border-b border-neutral-200/80 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Map picker
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          Click a lit country to open its Manual Collection. Dim markers are
          planned.
        </p>
      </div>
      <div className="relative px-2 pb-2 pt-1 sm:px-4">
        <svg
          viewBox="0 0 1000 500"
          role="img"
          aria-label="World map of Country Manuals"
          className="h-auto w-full"
        >
          <defs>
            <linearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8f2f8" />
              <stop offset="100%" stopColor="#d7e8f0" />
            </linearGradient>
            <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="1"
                stdDeviation="2"
                floodColor="#0f172a"
                floodOpacity="0.12"
              />
            </filter>
          </defs>
          <rect width="1000" height="500" fill="url(#ocean)" rx="12" />
          {/* Stylized continents — decorative silhouette, not GIS-accurate */}
          <g fill="#c5d4c8" stroke="#a8b9ad" strokeWidth="1.5" opacity="0.95">
            <path d="M120 90c40-30 110-40 170-20 50 16 90 20 130 55 30 26 20 70-10 90-40 28-95 18-140 5-55-16-100-40-130-80-12-16-20-36-20-50z" />
            <path d="M280 250c35-10 70 5 85 40 12 28 5 70-20 95-30 30-75 35-105 15-28-18-40-55-30-90 6-22 35-50 70-60z" />
            <path d="M470 100c55-25 120-10 150 35 25 38 15 95-25 125-45 34-110 30-150-5-35-30-40-85-10-125 8-12 20-22 35-30z" />
            <path d="M530 280c25-5 50 15 55 45 6 35-10 70-40 85-32 16-70 5-85-25-14-28-5-70 25-90 12-8 28-13 45-15z" />
            <path d="M650 140c70-20 140 10 170 70 28 55 10 120-45 155-60 38-145 20-180-40-30-52-10-130 55-185z" />
            <path d="M820 320c40-15 80 5 95 40 12 28-5 60-40 70-38 12-80-5-90-40-8-28 10-55 35-70z" />
          </g>
          <g stroke="#94a3b8" strokeOpacity="0.2" strokeWidth="1">
            <line x1="0" y1="250" x2="1000" y2="250" />
            <line x1="500" y1="0" x2="500" y2="500" />
          </g>
          {MARKERS.map((m) => {
            const collection = byCode.get(m.code);
            const available = Boolean(collection);
            if (available && collection) {
              return (
                <g
                  key={m.code}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open ${collection.title} Manual`}
                  className="cursor-pointer outline-none"
                  onClick={() =>
                    navigate(`/collection/${collection.collection_id}`)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/collection/${collection.collection_id}`);
                    }
                  }}
                >
                  <title>{collection.title}</title>
                  <circle
                    cx={m.x}
                    cy={m.y}
                    r="18"
                    fill="#0f172a"
                    opacity="0.08"
                    className="animate-pulse"
                  />
                  <circle
                    cx={m.x}
                    cy={m.y}
                    r="9"
                    fill="#0f172a"
                    filter="url(#soft)"
                  />
                  <circle cx={m.x} cy={m.y} r="3.5" fill="#f8fafc" />
                  <text
                    x={m.x}
                    y={m.y + 28}
                    textAnchor="middle"
                    className="fill-neutral-800 text-[13px] font-semibold"
                  >
                    {m.code}
                  </text>
                </g>
              );
            }
            return (
              <g key={m.code} opacity="0.45">
                <title>{`${m.label} — Manual planned`}</title>
                <circle
                  cx={m.x}
                  cy={m.y}
                  r="7"
                  fill="#64748b"
                  stroke="#e2e8f0"
                  strokeWidth="2"
                />
                <text
                  x={m.x}
                  y={m.y + 24}
                  textAnchor="middle"
                  className="fill-neutral-500 text-[11px]"
                >
                  {m.code}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
