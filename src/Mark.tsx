import { HARNESS_MARK_PATHS } from "./vendor/exawatt/harness-icons";
import { harnessMarkTone } from "./vendor/exawatt/harness-mark-tones";
export function Mark({ name, size = 20 }: { name: string; size?: number }) {
  const m = HARNESS_MARK_PATHS[name as keyof typeof HARNESS_MARK_PATHS];
  if (!m) return <span className="brain-glyph">✳</span>;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${m.viewBox} ${m.viewBox}`}
      aria-hidden
    >
      <g
        transform={
          m.translate ? `translate(${m.translate.join(" ")})` : undefined
        }
      >
        {m.parts.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill={
              p.stroke
                ? "none"
                : (harnessMarkTone(name, p.tone) ?? "currentColor")
            }
            stroke={
              p.stroke
                ? (harnessMarkTone(name, p.tone) ?? "currentColor")
                : undefined
            }
            strokeWidth={p.stroke}
            fillRule={m.fillRule}
          />
        ))}
      </g>
    </svg>
  );
}
