import { resultsPath } from "../utilities.tsx";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CareerTeams from "./CareerTeams.tsx";
import type { CareerGame } from "./careerSplits.ts";
import { loadCareerGames, loadPlayer, readProfileCache, rememberProfile } from "./profileCache.ts";
import {
  parseAwards,
  parseBorn,
  parseDraft,
  parseMeasure,
  parsePlace,
  parsePlain,
  parseTeams,
  type FactLine,
} from "./filter.tsx";
import {
  Button,
  EmptyState,
  Loader,
  PlayerAvatar,
  ResultCard,
} from "../components/All.tsx";

const facts: { key: string; label: string; parse: (value: string | undefined) => FactLine[] }[] = [
  { key: "born", label: "Born", parse: parseBorn },
  { key: "height", label: "Height", parse: parseMeasure },
  { key: "weight", label: "Weight", parse: parseMeasure },
  { key: "draft", label: "Draft", parse: parseDraft },
  { key: "career", label: "Career", parse: parsePlain },
  { key: "high_school", label: "High school", parse: parsePlace },
  { key: "college", label: "College", parse: parsePlace },
];

/** Fetches and displays a player profile from the API. */
const PlayerInfo = () => {
  const { name } = useParams();
  const routeName = name ?? "";
  const saved = routeName ? readProfileCache(routeName) : null;
  const [shownName, setShownName] = useState(routeName);
  const [info, setInfo] = useState<any>(saved?.player);
  const [games, setGames] = useState<CareerGame[] | null | undefined>(saved ? saved.games : undefined);

  if (routeName != shownName) {
    const next = routeName ? readProfileCache(routeName) : null;
    setShownName(routeName);
    setInfo(next?.player);
    setGames(next ? next.games : undefined);
  }

  useEffect(() => {
    if (!routeName) return;
    if (readProfileCache(routeName)) return;
    let cancel = false;
    const playerRequest = loadPlayer(routeName);
    const gamesRequest = loadCareerGames(routeName);
    playerRequest
      .then((player) => {
        if (cancel) return;
        setInfo(player ?? "We don't have information on this player.");
      })
      .catch((error) => {
        if (cancel) return;
        setInfo("We don't have information on this player.");
        console.log(error);
      });
    gamesRequest
      .then((rows) => {
        if (!cancel) setGames(rows);
      })
      .catch((error) => {
        if (!cancel) setGames(null);
        console.log(error);
      });
    Promise.all([playerRequest, gamesRequest])
      .then(([player, rows]) => rememberProfile(routeName, player, rows))
      .catch(() => {
        // A failed half is left uncached so the next visit can try again.
      });
    return () => {
      cancel = true;
    };
  }, [routeName]);

  if (!info) {
    return (
      <div className="page">
        <Loader label="Loading player" />
      </div>
    );
  }

  if (typeof info == "string") {
    return (
      <div className="page">
        <EmptyState
          title="Player not found"
          message={info}
          action={<Button to="/" arrow>Back home</Button>}
        />
      </div>
    );
  }

  const pointsPerGame = resultsPath("stats", { name: info.name, stat: "points", agg: "avg" });
  const careerHigh = resultsPath("stats", { name: info.name, stat: "points", agg: "max" });
  const gameLog = resultsPath("games", { name: info.name, limit: 25 });
  const details = facts
    .map((fact) => ({ ...fact, lines: fact.parse(info[fact.key]) }))
    .filter((fact) => fact.lines.length > 0);
  const mainFacts = details.filter((fact) => fact.key != "high_school" && fact.key != "college");
  const schoolFacts = details.filter((fact) => fact.key == "high_school" || fact.key == "college");
  const stints = parseTeams(info.teams);
  const awards = parseAwards(info.awards);
  const showTeams = stints.length > 0 || games === undefined || (games != null && games.length > 0);

  return (
    <div className="page page-player">
      <section className="profile-hero reveal">
        <div className="profile-portrait">
          <PlayerAvatar name={info.name} size="xl" />
        </div>
        <div className="profile-heading">
          {info.pos && <div className="eyebrow">{info.pos}</div>}
          <h1 className="profile-name">{info.name}</h1>
          {info.intro && <p className="profile-intro">{info.intro}</p>}
          <div className="profile-actions">
            <Button to={pointsPerGame} size="sm" arrow>
              Career points per game
            </Button>
            <Button to={careerHigh} size="sm" variant="secondary">
              Career high
            </Button>
            <Button to={gameLog} size="sm" variant="ghost">
              Game log
            </Button>
          </div>
        </div>
      </section>

      {details.length > 0 && (
        <div className="profile-facts">
          {[mainFacts, schoolFacts].filter((row) => row.length > 0).map((row) => (
            <dl className="profile-facts-row" key={row[0].key} style={{ ["--cols" as string]: row.length }}>
              {row.map((fact) => (
                <div className="profile-fact" key={fact.key}>
                  <dt>{fact.label}</dt>
                  <dd>
                    {fact.lines.map((line, index) => (
                      <span className="profile-fact-line" key={index}>
                        <span className="profile-fact-primary">{line.primary}</span>
                        {line.secondary && <span className="profile-fact-secondary">{line.secondary}</span>}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
      )}

      {(showTeams || awards.length > 0) && (
        <div className="profile-lower">
          {showTeams && (
            <ResultCard title="Teams" className="profile-teams">
              {games === undefined ? (
                <Loader compact label="Loading season stats" />
              ) : (
                <CareerTeams key={info.name} stints={stints} games={games ?? []} />
              )}
            </ResultCard>
          )}
          {awards.length > 0 && (
            <ResultCard title="Awards">
              <ul className="awards">
                {awards.map((award, index) => (
                  <li key={`${award.name}-${index}`}>
                    <span className="award-name">{award.name}</span>
                    {award.years && <span className="award-years tabular">{award.years}</span>}
                  </li>
                ))}
              </ul>
            </ResultCard>
          )}
        </div>
      )}
    </div>
  );
};

export default PlayerInfo;
