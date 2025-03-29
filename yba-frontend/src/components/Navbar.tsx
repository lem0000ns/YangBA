import { Autocomplete, Sidebar } from "./All";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import namesList from "../pages/allNames.txt?raw";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { Tooltip } from "react-tooltip";

const Navbar = () => {
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
    <nav>
      <div
        className="menu"
        onClick={() => {
          setMenuOpen(!menuOpen);
        }}
      >
        <span></span>
        <span></span>
        <span></span>
      </div>
      <a href="/">
        <h1 className="YangBA-header">YangBA</h1>
      </a>
      {menuOpen ? <Sidebar /> : null}
      <Tooltip
        id="my-tooltip-inline"
        style={{ backgroundColor: "rgb(179, 255, 179)", color: "#111" }}
        place={menuOpen ? "top" : "bottom"}
      />
      <form className="d-flex" role="search" onSubmit={(e) => handleSearch(e)}>
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
    </nav>
  );
};

export default Navbar;
