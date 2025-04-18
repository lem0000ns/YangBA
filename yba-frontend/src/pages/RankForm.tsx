import { useState } from "react";
import {
  Dropdown,
  MultiSelect,
  InputForm,
  Modal,
  Input_Tags,
} from "../components/All";

const teamAbbreviations = [
  "ATL",
  "BOS",
  "BKN",
  "CHA",
  "CHI",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GSW",
  "HOU",
  "IND",
  "LAC",
  "LAL",
  "MEM",
  "MIA",
  "MIL",
  "MIN",
  "NOP",
  "NYK",
  "OKC",
  "ORL",
  "PHI",
  "PHX",
  "POR",
  "SAC",
  "SAS",
  "TOR",
  "UTA",
  "WAS",
];

interface Props {
  onSubmit: (
    agg: string,
    stat: string,
    order: string,
    limit: number,
    team: string,
    seasons: string[],
    stage: string,
    filters: string[]
  ) => void;
}

const RankForm = ({ onSubmit }: Props) => {
  const [aggValue, setAggValue] = useState("Select a metric");
  const [statValue, setStatValue] = useState("Select a stat");
  const [order, setOrder] = useState("Select order");
  const [limit, setLimit] = useState(-1);
  const [team, setTeam] = useState("Select team (optional)");
  const [seasons, setSeasons] = useState<string[]>([]);
  const [stage, setStage] = useState("Select a stage (optional)");
  const [filters, setFilters] = useState<string[]>([]);
  const [error, setError] = useState("");

  const handleSubmit = (e: any) => {
    e.preventDefault();
    aggValue == "Select a metric" ||
    statValue == "Select a stat" ||
    order == "Select order" ||
    limit == -1
      ? setError(
          "'Number of players', 'Agg', 'Stat', and 'Order' are required fields"
        )
      : onSubmit(
          aggValue,
          statValue,
          order,
          limit,
          team,
          seasons,
          stage,
          filters
        );
  };

  return (
    <section className="rank-background">
      <form className="path_page" onSubmit={handleSubmit}>
        <InputForm
          inputType="number of players"
          helperText="determines how many players will be ranked"
          onChange={(value: string) => setLimit(Number(value))}
        ></InputForm>

        <div className="rank-dropdowns1">
          <Dropdown
            text={aggValue}
            color="light"
            options={["sum", "avg", "max", "min"]}
            handleClick={(name: string) => setAggValue(name)}
          ></Dropdown>

          <Dropdown
            text={statValue}
            color="light"
            options={[
              "points",
              "fgm",
              "fga",
              "ftm",
              "fta",
              "3pm",
              "3pa",
              "3pct",
              "fgpct",
              "ftpct",
              "ast",
              "reb",
              "steals",
              "blocks",
              "turnovers",
              "min",
              "OPI",
              "games",
            ]}
            handleClick={(stat: string) => setStatValue(stat)}
          ></Dropdown>
        </div>

        <div className="rank-dropdowns2">
          <Dropdown
            text={order}
            options={["Most", "Least"]}
            handleClick={(order: string) => setOrder(order)}
          ></Dropdown>

          <Dropdown
            text={team}
            options={teamAbbreviations}
            handleClick={(team: string) => setTeam(team)}
          ></Dropdown>
        </div>

        <MultiSelect
          text="Select a season or range of seasons (optional)"
          options={[
            "2016",
            "2017",
            "2018",
            "2019",
            "2020",
            "2021",
            "2022",
            "2023",
            "2024",
          ]}
          onChange={(options: string[]) => setSeasons(options)}
        ></MultiSelect>

        <Dropdown
          text={stage}
          color="light"
          options={["Preseason", "Regular Season", "Playoffs"]}
          handleClick={(stage: string) => setStage(stage)}
        ></Dropdown>

        <Modal
          title="Filter criteria? (optional)"
          enterMessage="Enter filter"
          textBox={
            <Input_Tags
              tags={filters}
              addFilters={(event) =>
                setFilters([...filters, event.target.value])
              }
              removeFilters={(indexToRemove) =>
                setFilters(
                  filters.filter((_, index) => index !== indexToRemove)
                )
              }
            ></Input_Tags>
          }
          helperText={[
            "stats: points, fgm, fga, ftm, fta, 3pm, 3pa, 3pct, fgpct, ftpct, ast, reb, steals, blocks, turnovers, min, OPI, games",
            "op: >, <, =",
            "'num' guidelines: use percent for decimal",
          ]}
        />

        {filters.length > 0 && <p>Filter: {filters.join(", ")}</p>}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ marginTop: "20px" }}
        >
          Submit
        </button>

        {error && (
          <div
            className="alert-container"
            style={{ marginTop: "10px", marginBottom: "100px" }}
          >
            <div
              className="alert alert-danger"
              style={{ width: "450px" }}
              role="alert"
            >
              {error}
            </div>
          </div>
        )}
      </form>
    </section>
  );
};

export default RankForm;
