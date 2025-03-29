import React from "react";
import { Autocomplete } from "./All";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartSimple } from "@fortawesome/free-solid-svg-icons";
import { faBasketball } from "@fortawesome/free-solid-svg-icons";
import { faRankingStar } from "@fortawesome/free-solid-svg-icons";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import namesList from "../pages/allNames.txt?raw";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Sidebar = () => {
  const allNames = namesList.split("\n");
  const [nameValue, setNameValue] = useState("");
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSearch = (e: unknown) => {
    console.log(e);
    if (nameValue == "") navigate("/");
    else navigate(`/players/${encodeURIComponent(nameValue)}`);
  };

  return (
    <div className="Sidebar">
      <div className="sidebar-content">
        <div>
          <a href="/">
            <h1 className="YangBA-header">YangBA</h1>
          </a>
          <form
            className="search-form"
            role="search"
            onSubmit={(e) => handleSearch(e)}
          >
            <div className="search-container">
              <Autocomplete
                possibleValues={allNames}
                text=""
                onChange={(value: string) => setNameValue(value)}
                className="search-bar"
              />
              <button type="submit" className="magnifying-glass">
                <FontAwesomeIcon icon={faMagnifyingGlass} />
              </button>
            </div>
          </form>
        </div>
        <ul>
          <li className="sidebar-stats">
            <a className="nav_links_items" href="/stats">
              Stats
            </a>
            <FontAwesomeIcon icon={faChartSimple} />
          </li>
          <li className="sidebar-games">
            <a className="nav_links_items" href="/games">
              Games
            </a>
            <FontAwesomeIcon icon={faBasketball} />
          </li>
          <li className="sidebar-rank">
            <a className="nav_links_items" href="/rank">
              Rank
            </a>
            <FontAwesomeIcon icon={faRankingStar} />
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
