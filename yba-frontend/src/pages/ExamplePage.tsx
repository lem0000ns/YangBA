import { useState } from "react";
import { ArrowRight, Button, FilterPill, Modal, SectionHeader } from "../components/All";
import { TEAMS, aggLabel, statLabel } from "../constants";
import { describeSeasons } from "./queryFields";

type Path = "stats" | "games" | "rank";

interface Example {
  id: string;
  sentence: string;
  path: Path;
  name?: string;
  stat?: string;
  agg?: string;
  seasons?: string[];
  filters?: string[];
  limit?: number;
  order?: "Most" | "Least";
  team?: string;
  stage?: string;
}

const pathLabels: Record<Path, string> = { stats: "Stats", games: "Games", rank: "Rankings" };

const keepSeasonsTogether = (text: string) => text.replace(/–(\d)/g, "–\u2060$1");

const join = (values: string[] | undefined, sep = "-") => (values?.length ? values.join(sep) : "na");

const resultsURL = (e: Example) => {
  const seasons = join(e.seasons);
  const filters = join(e.filters);
  if (e.path == "stats") return `/stats/results/${e.name ?? "na"}/${seasons}/${filters}/na/${e.stat}/${e.agg}/na/na/na`;
  if (e.path == "games") return `/games/results/${e.name ?? "na"}/${seasons}/${filters}/${e.limit}`;
  return `/rank/results/na/${seasons}/${filters}/${e.limit}/${e.stat}/${e.agg}/${e.order}/${e.team ?? "na"}/${e.stage ?? "na"}`;
};

const setupRows = (e: Example) => {
  const rows: { label: string; value: string }[] = [];
  if (e.path == "rank") rows.push({ label: "Order", value: e.order == "Most" ? "Top" : "Bottom" });
  if (e.limit) rows.push({ label: e.path == "rank" ? "Number of players" : "Number of games", value: String(e.limit) });
  if (e.path != "rank") rows.push({ label: "Player", value: e.name ?? "All players" });
  if (e.stat) rows.push({ label: "Stat", value: statLabel(e.stat) });
  if (e.agg) rows.push({ label: "Metric", value: aggLabel(e.agg) });
  if (e.path == "rank") rows.push({ label: "Team", value: e.team ? TEAMS[e.team] : "Any team" });
  rows.push({ label: "Season", value: e.seasons?.length ? describeSeasons(e.seasons) : "All seasons" });
  if (e.path == "rank") rows.push({ label: "Stage", value: e.stage ?? "All" });
  return rows;
};

const simpleExamples: Example[] = [
  { id: "lillard-assists", sentence: "Damian Lillard's total assists in 2015–16", path: "stats", name: "Damian Lillard", stat: "ast", agg: "sum", seasons: ["2016"] },
  { id: "sixty-points", sentence: "Games where a player scored more than 60 points", path: "games", limit: 30, filters: ["points>60"] },
  { id: "ingram-threes", sentence: "Brandon Ingram's career high in threes", path: "stats", name: "Brandon Ingram", stat: "3pm", agg: "max" },
  { id: "worst-ft", sentence: "Worst free throw shooters with at least 2 attempts per game", path: "rank", limit: 20, stat: "ftpct", agg: "avg", order: "Least", filters: ["fta>2"] },
  { id: "fpts-games", sentence: "Games with more than 80 fantasy points", path: "games", limit: 10, filters: ["fpts>80"] },
];

const specificExamples: Example[] = [
  { id: "three-pt", sentence: "Best three-point shooters from 2016–17 to 2020–21, at least 5 attempts per game", path: "rank", limit: 10, stat: "3pct", agg: "avg", order: "Most", seasons: ["2017", "2018", "2019", "2020", "2021"], filters: ["3pa>5"] },
  { id: "forty-thirteen", sentence: "Regular season games with more than 40 points and 13 assists", path: "games", limit: 15, filters: ["stage=2", "points>40", "ast>13"] },
  { id: "tatum-turnovers", sentence: "Jayson Tatum's turnovers per game when shooting below 40% in 2022–23", path: "stats", name: "Jayson Tatum", stat: "turnovers", agg: "avg", seasons: ["2023"], filters: ["fgpct<0.4"] },
  { id: "jazz-rebounds", sentence: "Jazz players with the highest single-game rebounds, more than 50 games played", path: "rank", limit: 13, stat: "reb", agg: "max", order: "Most", team: "UTA", filters: ["games>50"] },
  { id: "klay-threes", sentence: "Fewest threes Klay Thompson made in a game with more than 35 points", path: "stats", name: "Klay Thompson", stat: "3pm", agg: "min", filters: ["points>35"] },
];

interface CardProps {
  example: Example;
  index: number;
  onOpen: (example: Example) => void;
}

const ExampleCard = ({ example, index, onOpen }: CardProps) => (
  <button
    type="button"
    className="example-card reveal"
    style={{ ["--d" as string]: `${index * 50}ms` }}
    onClick={() => onOpen(example)}
  >
    <span className={`path-badge path-${example.path}`}>{pathLabels[example.path]}</span>
    <span className="example-card-sentence">{keepSeasonsTogether(example.sentence)}</span>
    {example.filters && (
      <span className="example-card-params">
        {example.filters.map((filter) => (
          <FilterPill key={filter} filter={filter} perGame={example.path == "rank"} />
        ))}
      </span>
    )}
    <span className="example-card-cta">
      View setup <ArrowRight size={14} />
    </span>
  </button>
);

const ExamplePage = () => {
  const [open, setOpen] = useState<Example | null>(null);

  return (
    <div className="page page-examples">
      <SectionHeader
        size="page"
        eyebrow="Examples"
        title="Example queries"
        description="Open one to see how it's set up."
      />

      <section className="example-group">
        <h2 className="example-group-title">Simple</h2>
        <div className="example-grid">
          {simpleExamples.map((example, i) => (
            <ExampleCard key={example.id} example={example} index={i} onOpen={setOpen} />
          ))}
        </div>
      </section>

      <section className="example-group">
        <h2 className="example-group-title">More specific</h2>
        <div className="example-grid">
          {specificExamples.map((example, i) => (
            <ExampleCard key={example.id} example={example} index={i} onOpen={setOpen} />
          ))}
        </div>
      </section>

      <Modal
        open={open != null}
        onClose={() => setOpen(null)}
        variant="drawer"
        eyebrow={open ? pathLabels[open.path] : undefined}
        title={open && keepSeasonsTogether(open.sentence)}
      >
        {open && (
          <>
            <dl className="param-table">
              {setupRows(open).map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
              <div className={open.filters ? "" : "is-empty"}>
                <dt>Filters</dt>
                <dd>
                  {open.filters ? (
                    <span className="param-filters">
                      {open.filters.map((filter) => (
                        <FilterPill key={filter} filter={filter} perGame={open.path == "rank"} />
                      ))}
                    </span>
                  ) : (
                    "None"
                  )}
                </dd>
              </div>
            </dl>
            <div className="drawer-actions">
              <Button to={resultsURL(open)} arrow onClick={() => setOpen(null)}>
                Run query
              </Button>
              <Button to={`/${open.path}`} variant="secondary" onClick={() => setOpen(null)}>
                Open {pathLabels[open.path]}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default ExamplePage;
