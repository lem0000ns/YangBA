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
    if (nameValue == "") navigate("/");
    else navigate(`/players/${encodeURIComponent(nameValue)}`);
  };

  return (
    <>
      <nav>
        <a href="/">
          <h1 className="YangBA-header">YangBA</h1>
        </a>
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
      </nav>
      <Sidebar menuOpen={menuOpen} />
    </>
  );
};

export default Navbar;
