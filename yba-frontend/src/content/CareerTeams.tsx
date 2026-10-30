import { useMemo, useState } from "react";
import { ChevronDown } from "../components/Icons.tsx";
import { careerSections, defaultOpenSection, type CareerGame } from "./careerSplits.ts";
import type { TeamStint } from "./filter.tsx";

const COLUMNS = [
  { key: "gp", label: "GP" },
  { key: "ppg", label: "PPG" },
  { key: "rpg", label: "RPG" },
  { key: "apg", label: "APG" },
  { key: "spg", label: "SPG" },
  { key: "bpg", label: "BPG" },
  { key: "fg", label: "FG%" },
  { key: "tp", label: "3P%" },
  { key: "ft", label: "FT%" },
] as const;

interface Props {
  stints: TeamStint[];
  games: CareerGame[];
}

/** Career stops, newest first, each one opening its own season table. */
const CareerTeams = ({ stints, games }: Props) => {
  const sections = useMemo(() => careerSections(stints, games), [stints, games]);
  const [open, setOpen] = useState<Set<string>>(() => {
    const id = defaultOpenSection(careerSections(stints, games));
    return new Set(id ? [id] : []);
  });

  if (!sections.length) return null;

  const toggle = (id: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="career-teams">
      {sections.map((section) => {
        const expanded = open.has(section.id);
        const className = [
          section.affiliate ? "is-affiliate" : "",
          section.current ? "is-current" : "",
          expanded ? "is-open" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const heading = (
          <>
            <span className="team-toggle-copy">
              <span className="team-toggle-name">{section.name}</span>
              {section.years && <span className="team-toggle-years tabular">{section.years}</span>}
            </span>
            {section.seasons.length > 0 && (
              <ChevronDown className={`team-chevron ${expanded ? "is-open" : ""}`} />
            )}
          </>
        );
        return (
          <div className={`career-team ${className}`} key={section.id}>
            {section.seasons.length > 0 ? (
              <button
                type="button"
                className="team-toggle"
                aria-expanded={expanded}
                aria-controls={`${section.id}-panel`}
                onClick={() => toggle(section.id)}
              >
                {heading}
              </button>
            ) : (
              <div className="team-toggle is-static">{heading}</div>
            )}
            {section.seasons.length > 0 && (
              <div
                className={`career-panel ${expanded ? "is-open" : ""}`}
                id={`${section.id}-panel`}
                aria-hidden={expanded ? undefined : true}
              >
                <div className="career-panel-inner">
                  <div className="career-scroll">
                    <table className="career-table" aria-label={`${section.name} regular season`}>
                      <thead>
                        <tr>
                          <th scope="col" className="align-left">Season</th>
                          {COLUMNS.map((column) => (
                            <th
                              scope="col"
                              key={column.key}
                              className={`align-right${column.key == "ppg" ? " is-emphasis" : ""}`}
                            >
                              {column.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.seasons.map((row) => (
                          <tr key={row.seasonStart}>
                            <th scope="row" className="align-left">{row.season}</th>
                            {COLUMNS.map((column) => (
                              <td
                                key={column.key}
                                className={`align-right${column.key == "ppg" ? " is-emphasis" : ""}`}
                              >
                                {row[column.key]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CareerTeams;
