interface Props {
  values: number[];
  width?: number;
  height?: number;
}

/** Mini line chart with fill and peak marker for a numeric series. */
const Sparkline = ({ values, width = 160, height = 40 }: Props) => {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pad = 3;
  const points = values.map((v, i) => [
    pad + (i / (values.length - 1)) * (width - pad * 2),
    pad + (1 - (v - min) / range) * (height - pad * 2),
  ]);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1][0]} ${height} L${points[0][0]} ${height} Z`;
  const peak = points[values.indexOf(max)];

  return (
    <svg className="sparkline" width="100%" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={area} className="sparkline-area" />
      <path d={line} className="sparkline-line" pathLength={1} />
      <circle cx={peak[0]} cy={peak[1]} r="2.6" className="sparkline-peak" />
    </svg>
  );
};

export default Sparkline;
