import { Link } from "react-router-dom";
import { GoatMark } from "./Sheep";

interface Props {
  compact?: boolean;
}

/** Home link with the YangBA logo mark and wordmark. */
const Logo = ({ compact = false }: Props) => (
  <Link to="/" className="logo" aria-label="YangBA home">
    <span className="logo-mark">
      <GoatMark size={compact ? 22 : 26} />
    </span>
    <span className="logo-word">
      Yang<span className="logo-word-accent">BA</span>
    </span>
  </Link>
);

export default Logo;
