import { Link } from "react-router-dom";
import { GoatMark } from "./Sheep";

/** Site footer with branding, credits, and nav links. */
const Footer = () => (
  <footer className="footer">
    <div className="footer-inner">
      <div className="footer-brand">
        <GoatMark size={18} />
        <span>
          <strong>YangBA</strong>
        </span>
      </div>
      <p className="footer-glyph" title="yáng — sheep, goat">
        <span lang="zh">羊</span> <em>yáng</em>: sheep, goat.
      </p>
      <nav className="footer-links" aria-label="Footer">
        <Link to="/stats">Stats</Link>
        <Link to="/games">Games</Link>
        <Link to="/rank">Rankings</Link>
        <Link to="/examples">Examples</Link>
      </nav>
    </div>
  </footer>
);

export default Footer;
