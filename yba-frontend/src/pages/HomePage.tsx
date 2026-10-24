import { Link } from "react-router-dom";
import {
  ArrowRight,
  Button,
  PercentileBar,
  PlayerAvatar,
  SectionHeader,
  TrendUp,
} from "../components/All";
import { EspnCredit, FPTS_SCORING } from "../components/FptsInfo";
import { resultsPath } from "../utilities";
import statsImage from "../content/images/curry_giannis.png";
import gamesImage from "../content/images/dame_gw.jpg";
import rankImage from "../content/images/lebron_mj.png";

const paths = [
  {
    to: "/stats",
    label: "Stats",
    index: "01",
    title: "Look up a stat",
    description: "Totals, averages, and single-game highs or lows.",
    required: ["stat", "metric"],
    optional: ["player", "seasons", "filters"],
    image: statsImage,
  },
  {
    to: "/games",
    label: "Games",
    index: "02",
    title: "Find games",
    description: "Box scores that match your filters.",
    required: ["number of games"],
    optional: ["player", "seasons", "filters"],
    image: gamesImage,
  },
  {
    to: "/rank",
    label: "Rankings",
    index: "03",
    title: "Rank players",
    description: "Leaderboards by stat, team, season, and stage.",
    required: ["players", "stat", "metric", "order"],
    optional: ["team", "seasons", "stage", "filters"],
    image: rankImage,
  },
];

const specimenURL = resultsPath("stats", {
  name: "Stephen Curry",
  seasons: ["2017"],
  stat: "points",
  agg: "avg",
});
const fptsLeadersURL = resultsPath("rank", {
  filters: ["games>50"],
  limit: 10,
  stat: "fpts",
  agg: "avg",
  order: "Most",
});

/** Marketing landing page with tool paths and FPTS overview. */
const HomePage = () => {
  return (
    <div className="page page-home">
      <section className="home-hero">
        <div className="home-hero-text reveal">
          <div className="eyebrow">NBA stats since 2015–16</div>
          <h1 className="home-title">
            Basketball,
            <br />
            by the numbers.
          </h1>
          <p className="home-lede">
            Look up any stat, find specific games, or rank players across the league.
          </p>
          <div className="home-cta">
            <Button to="/stats" size="lg" arrow>
              Get started
            </Button>
            <Button to="/examples" size="lg" variant="secondary">
              See examples
            </Button>
          </div>
          <p className="home-hint">
            Press <kbd>/</kbd> to search for a player.
          </p>
        </div>

        <Link to={specimenURL} className="specimen reveal" style={{ ["--d" as string]: "120ms" }}>
          <div className="specimen-header">
            <PlayerAvatar name="Stephen Curry" size="md" />
            <div>
              <div className="specimen-name">Stephen Curry</div>
              <div className="specimen-meta">Golden State Warriors · 2016–17</div>
            </div>
            <span className="specimen-tag">Sample</span>
          </div>
          <div className="specimen-value">
            <span className="tabular">25.3</span>
            <span className="specimen-unit">PTS / game</span>
          </div>
          <div className="specimen-percentile">
            <span className="trend trend-up">
              <TrendUp /> 98.6th percentile
            </span>
            <PercentileBar value={0.986} />
          </div>
          <div className="specimen-footer">
            Open query <ArrowRight size={14} />
          </div>
        </Link>
      </section>

      <section className="home-section">
        <SectionHeader eyebrow="Tools" title="Three ways to search" />
        <div className="path-grid">
          {paths.map((path, i) => (
            <Link
              to={path.to}
              key={path.to}
              className="path-card reveal"
              style={{ ["--d" as string]: `${i * 80}ms` }}
            >
              <div className="path-card-media" style={{ backgroundImage: `url(${path.image})` }} />
              <div className="path-card-body">
                <div className="path-card-top">
                  <span className="path-card-label">{path.label}</span>
                  <span className="path-card-index tabular">{path.index}</span>
                </div>
                <h3>{path.title}</h3>
                <p>{path.description}</p>
                <div className="path-card-params">
                  {path.required.map((p) => (
                    <span key={p} className="param is-required">
                      {p}
                    </span>
                  ))}
                  {path.optional.map((p) => (
                    <span key={p} className="param">
                      {p}
                    </span>
                  ))}
                </div>
                <span className="path-card-cta">
                  Open {path.label} <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section fpts-feature reveal">
        <div className="fpts-feature-text">
          <div className="eyebrow">Fantasy points</div>
          <h2 className="section-title">FPTS</h2>
          <p>
            Every game gets a fantasy score. Use FPTS like any other stat, in any query.
          </p>
          <Button to={fptsLeadersURL} variant="secondary" arrow>
            Top FPTS per game
          </Button>
          <EspnCredit />
        </div>
        <dl className="fpts-table fpts-feature-visual">
          {FPTS_SCORING.map((row) => (
            <div key={row.stat}>
              <dt>{row.stat}</dt>
              <dd className="tabular">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="home-section inspiration-band reveal">
        <div>
          <h2 className="section-title">Need ideas?</h2>
          <p>Browse example queries.</p>
        </div>
        <Button to="/examples" arrow>
          See examples
        </Button>
      </section>
    </div>
  );
};

export default HomePage;
