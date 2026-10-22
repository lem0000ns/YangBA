interface Props {
  value: number;
}

/** Visual bar for a percentile value between 0 and 1. */
const PercentileBar = ({ value }: Props) => {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="percentile-bar" aria-hidden="true">
      <div className="percentile-track">
        {[25, 50, 75].map((tick) => (
          <span key={tick} className="percentile-tick" style={{ left: `${tick}%` }} />
        ))}
        <div className="percentile-fill" style={{ width: `${pct}%` }} />
        <span className="percentile-marker" style={{ left: `${pct}%` }} />
      </div>
      <div className="percentile-scale">
        <span>0</span>
        <span>50th</span>
        <span>100th</span>
      </div>
    </div>
  );
};

export default PercentileBar;
