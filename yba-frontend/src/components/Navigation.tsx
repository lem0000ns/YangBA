import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import namesList from "../pages/allNames.txt?raw";
import { useSlidingIndicator } from "../hooks";
import Autocomplete from "./Autocomplete";
import { SearchIcon, CloseIcon } from "./Icons";
import Logo from "./Logo";
import { SheepMark } from "./Sheep";

const allNames = namesList.split("\n").map((n) => n.trim()).filter(Boolean);

const links = [
  { to: "/stats", label: "Stats" },
  { to: "/games", label: "Games" },
  { to: "/rank", label: "Rankings" },
];

/** Top navigation bar with links, player search, and scroll styling. */
const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const linksRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const active = links.find((l) => location.pathname.startsWith(l.to))?.to;
  const indicator = useSlidingIndicator(linksRef, active);

  useEffect(() => {
    /** Toggles compact nav styling after the user scrolls. */
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    /** Opens player search when "/" is pressed outside text fields. */
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA"].includes(target.tagName);
      if (e.key == "/" && !typing) {
        e.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setSearchOpen(false), [location.pathname]);

  /** Routes to a player profile or home when search completes. */
  const handleSearch = (name: string) => {
    if (name == "") navigate("/");
    else navigate(`/players/${encodeURIComponent(name)}`);
  };

  return (
    <header className={`nav ${scrolled ? "is-scrolled" : ""}`}>
      <div className="nav-inner">
        <Logo />

        <nav className="nav-links" ref={linksRef} aria-label="Primary">
          {indicator && (
            <span
              className="nav-indicator"
              style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
            />
          )}
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="nav-link"
              data-active={active == link.to}
              aria-current={active == link.to ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="nav-actions">
          <div className={`nav-search ${searchOpen ? "is-open" : ""}`}>
            <Autocomplete
              variant="search"
              possibleValues={allNames}
              onChange={handleSearch}
              onSubmitEmpty={() => navigate("/")}
              placeholder="Search players"
              inputRef={searchRef}
            />
          </div>
          <button
            type="button"
            className="nav-icon-button nav-search-toggle"
            onClick={() => {
              setSearchOpen((open) => !open);
              requestAnimationFrame(() => searchRef.current?.focus());
            }}
            aria-label={searchOpen ? "Close search" : "Search players"}
          >
            {searchOpen ? <CloseIcon size={16} /> : <SearchIcon size={17} />}
          </button>
          <Link
            to="/examples"
            className="nav-mascot"
            aria-label="Example queries"
            data-tip="Examples"
          >
            <SheepMark size={30} wool="var(--wool-ink)" face="var(--ink)" />
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Navigation;
