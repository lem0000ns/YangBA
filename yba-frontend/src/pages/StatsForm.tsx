import { useState } from "react";
import {
  Dropdown,
  MultiSelect,
  Modal,
  Autocomplete,
  Input_Tags,
} from "../components/All";
import namesList from "./allNames.txt?raw";

interface Props {
  onSubmit: (
    name: string,
    stat: string,
    agg: string,
    seasons: string[],
    filters: string[]
  ) => void;
}

const StatsForm = ({ onSubmit }: Props) => {
  const allNames = namesList.split("\n");
  const [nameValue, setNameValue] = useState("");
  const [statValue, setStatValue] = useState("Select a stat");
  const [aggValue, setAggValue] = useState("Select a metric");
  const [seasons, setSeasons] = useState<string[]>([]);
  const [filters, setFilters] = useState<string[]>([]);
  const [error, setError] = useState("");

  const handleStatClick = (name: string) => {
    setStatValue(name);
    if (name == "games") setAggValue("sum");
  };

  const handleAggClick = (agg: string) => {
    if (statValue != "games") {
      setAggValue(agg);
    }
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    statValue == "Select a stat" || aggValue == "Select a metric"
      ? setError("'Stat' and 'Agg' are required fields")
      : onSubmit(nameValue, statValue, aggValue, seasons, filters);
  };

  return (
    <section className="stats-background">
      <form className="path_page" onSubmit={handleSubmit}>
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
          handleClick={handleStatClick}
        />

        <Dropdown
          text={aggValue}
          color="light"
          options={["sum", "avg", "max", "min"]}
          handleClick={handleAggClick}
        />

        <Autocomplete
          possibleValues={allNames}
          text="Enter name (optional)"
          onChange={(value: string) => setNameValue(value)}
        />

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
        />

        <br />

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
            "stats: points, fgm, fga, ftm, fta, 3pm, 3pa, 3pct, fgpct, ftpct, ast, reb, steals, blocks, turnovers, min, OPI, stage",
            "op: >, <, =",
            "'num' guidelines: use decimal for percents, stage = (1: preseason, 2: regular season, 3-5: playoffs)",
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
          <div className="alert-container" style={{ marginBottom: "100px" }}>
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          </div>
        )}
      </form>
    </section>
  );
};

export default StatsForm;
