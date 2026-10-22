import {
  PCT_STATS,
  TEAMS,
  describeFilter,
  seasonLabel,
  statLabel,
} from "./constants";

function computeURL(
  name: string,
  stat: string,
  agg: string,
  seasons: string[],
  filters: string[],
  limit: Number,
  order: string,
  team: string,
  stage: string
) {
  let url = "";
  let isLimit = false;
  if (limit != -1) {
    url += "limit=" + limit;
    isLimit = true;
  }
  if (stat != "") isLimit ? (url += "&stat=" + stat) : (url += "stat=" + stat);
  if (name != "") url += "&name=" + name.toLowerCase();
  if (agg != "") {
    if (stat == "games") agg = "sum";
    url += "&agg=" + agg;
  }
  if (seasons.length > 0 && seasons[0] != "") {
    for (const szn of seasons) {
      let temp = Number(szn) - 1;
      url += "&season=" + temp;
    }
  }
  if (filters.length > 0) {
    let tempFilters = filters.join(",");
    url += "&filter=" + tempFilters;
  }
  if (order != "") {
    order == "Most" ? (url += "&order=desc") : (url += "&order=asc");
  }
  if (team != "" && team != "Select team (optional)") url += "&team=" + team;
  if (stage != "" && stage != "Select a stage (optional)") {
    if (stage == "Preseason") url += "&stage=1";
    else if (stage == "Regular Season") url += "&stage=2";
    else url += "&stage=3&stage=4&stage=5";
  }
  return url;
}

function getStatInfo(
  name: string,
  stat: string,
  agg: string,
  seasons: string[],
  filters: string[],
  team: string,
  limit: Number,
  order: string,
  stage: string
) {
  const parts: string[] = [];
  if (name != "") parts.push(`${name}'s`);

  //rank
  if (order != "") {
    parts.push(`${order == "Most" ? "Top" : "Bottom"} ${limit} players by`);
  }
  //games
  else if (stat == "") {
    const count = Number(limit);
    parts.push(count > 0 ? `${count} ${count == 1 ? "game" : "games"}` : "games");
  }
  //rank or stats
  if (stat != "") {
    const label = statLabel(stat).toLowerCase();
    if (stat == "games") parts.push("games played");
    else if (PCT_STATS.includes(stat) && agg != "max" && agg != "min")
      parts.push(label);
    else if (agg == "sum") parts.push(`total ${label}`);
    else if (agg == "avg") parts.push(`${label} per game`);
    else if (agg == "max") parts.push(`most ${label} in a game`);
    else parts.push(`fewest ${label} in a game`);
  }

  if (team != "" && team != "Select team (optional)") {
    parts.push(`on the ${TEAMS[team] ?? team}`);
  }

  if (seasons.length == 1 && seasons[0] != "") {
    parts.push(`in ${seasonLabel(seasons[0])}`);
  } else if (seasons.length > 1) {
    parts.push(`across ${seasons.length} seasons`);
  }

  if (filters.length > 0) {
    const described = filters.map((f) => {
      const text = describeFilter(f, order != "");
      return text.charAt(0).toLowerCase() + text.slice(1);
    });
    parts.push(`with ${described.join(", ")}`);
  }

  if (stage != "" && stage != "Select a stage (optional)") {
    parts.push(`during the ${stage.toLowerCase()}`);
  }

  return parts.join(" ");
}

export { computeURL, getStatInfo };
