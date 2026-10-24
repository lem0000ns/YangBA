import axios from "axios";
import { apiBaseUrl } from "../apiConfig.ts";
import { resultsPath } from "../utilities.tsx";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  filterTeams,
  parseAwards,
  parseBorn,
  parseDraft,
  parseMeasure,
  parsePlace,
  parsePlain,
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
  const [info, setInfo] = useState<any>();

  useEffect(() => {
    setInfo(undefined);
    axios
      .get(
        `${apiBaseUrl}players?name=${name}`
      )
      .then((response) => {
        const playerData = response.data.player;
        setInfo(playerData ?? "We don't have information on this player.");
      })
      .catch((error) => {
        setInfo("We don't have information on this player.");
        console.log(error);
      });
  }, [name]);

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
  const teams = info.teams ? filterTeams(info.teams) : null;
  const awards = parseAwards(info.awards);

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

      {(teams || awards.length > 0) && (
        <div className="profile-columns">
          {teams && <ResultCard title="Teams">{teams}</ResultCard>}
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
