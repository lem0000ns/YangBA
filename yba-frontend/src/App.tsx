import { useEffect } from "react";
import { Footer, Navigation, SheepPattern } from "./components/All.tsx";
import {
  StatsForm,
  GamesForm,
  RankForm,
  HomePage,
  ExamplePage,
  ResultsPage,
} from "./pages/All.tsx";
import { PlayerInfo } from "./content/All";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { resultsPath } from "./utilities";

/** Root app shell with routes and query submit handlers. */
function App() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  useEffect(() => window.scrollTo(0, 0), [pathname, search]);

  /** Navigates to the stats results URL from form values. */
  const handleStatsSubmit = (
    name: string,
    stat: string,
    agg: string,
    seasons: string[],
    filters: string[],
    stage: string
  ) => {
    navigate(resultsPath("stats", { name, stat, agg, seasons, filters, stage }));
  };

  /** Navigates to the games results URL from form values. */
  const handleGamesSubmit = (
    name: string,
    seasons: string[],
    filters: string[],
    limit: number,
    stage: string
  ) => {
    navigate(resultsPath("games", { name, seasons, filters, limit, stage }));
  };

  /** Navigates to the rank results URL from form values. */
  const handleRankSubmit = (
    agg: string,
    stat: string,
    order: string,
    limit: number,
    team: string,
    seasons: string[],
    stage: string,
    filters: string[]
  ) => {
    navigate(resultsPath("rank", { agg, stat, order, limit, team, seasons, stage, filters }));
  };

  return (
    <>
      <SheepPattern />
      <div className="app">
        <Navigation />
        <main className="content-container">
          <Routes key={`${pathname}${search}`}>
            <Route path="/" element={<HomePage />} />
            <Route path="/examples" element={<ExamplePage />} />

            <Route path="/stats/results" element={<ResultsPage path="stats" />} />
            <Route path="/games/results" element={<ResultsPage path="games" />} />
            <Route path="/rank/results" element={<ResultsPage path="rank" />} />
            <Route
              path="/stats"
              element={<StatsForm onSubmit={handleStatsSubmit} />}
            />
            <Route
              path="/games"
              element={<GamesForm onSubmit={handleGamesSubmit} />}
            />
            <Route
              path="/rank"
              element={<RankForm onSubmit={handleRankSubmit} />}
            />
            <Route path="/players/:name" element={<PlayerInfo />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default App;
