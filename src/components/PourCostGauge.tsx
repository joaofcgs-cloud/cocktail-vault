import { pourCostColor, pourCostLabel } from "@/lib/format";

export function PourCostGauge({ percent }: { percent: number }) {
  const clamped = Math.min(Math.max(percent, 0), 40);
  const pos = (clamped / 40) * 100;
  const color = pourCostColor(percent);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pour cost
        </span>
        <span className="text-lg font-black" style={{ color }}>
          {percent.toFixed(1)}% · {pourCostLabel(percent)}
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, var(--green) 0%, var(--green) 45%, var(--orange) 45%, var(--orange) 70%, var(--red) 70%)",
          }}
        />
        <div
          className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-foreground shadow"
          style={{ left: `calc(${pos}% - 2px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0%</span>
        <span>18%</span>
        <span>28%</span>
        <span>40%+</span>
      </div>
    </div>
  );
}
