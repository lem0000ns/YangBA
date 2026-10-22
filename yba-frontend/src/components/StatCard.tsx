import { ReactNode } from "react";
import { useCountUp } from "../hooks";
import { TrendDown, TrendUp } from "./Icons";

interface Props {
  label: string;
  value: number | string;
  format?: (value: number) => string;
  unit?: string;
  sub?: ReactNode;
  trend?: "up" | "down";
  trendLabel?: string;
  size?: "md" | "xl";
  children?: ReactNode;
  delay?: number;
}

/** Metric display card with optional animation, trend, and chart slot. */
const StatCard = ({
  label,
  value,
  format = (v) => v.toString(),
  unit,
  sub,
  trend,
  trendLabel,
  size = "md",
  children,
  delay = 0,
}: Props) => {
  const numeric = typeof value == "number" ? value : undefined;
  const animated = useCountUp(numeric);
  const shown =
    numeric == undefined
      ? value
      : format(Number.isInteger(numeric) ? Math.round(animated) : animated);

  return (
    <div className={`stat-card stat-card-${size} reveal`} style={{ ["--d" as string]: `${delay}ms` }}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">
        <span className="tabular">{shown}</span>
        {unit && <span className="stat-card-unit">{unit}</span>}
      </div>
      {(trend || sub) && (
        <div className="stat-card-sub">
          {trend && (
            <span className={`trend trend-${trend}`}>
              {trend == "up" ? <TrendUp /> : <TrendDown />}
              {trendLabel}
            </span>
          )}
          {sub && <span>{sub}</span>}
        </div>
      )}
      {children && <div className="stat-card-chart">{children}</div>}
    </div>
  );
};

export default StatCard;
