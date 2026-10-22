import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "./Icons";
import PlayerAvatar from "./PlayerAvatar";

interface Props {
  name: string;
  meta?: ReactNode;
  children?: ReactNode;
}

const PlayerCard = ({ name, meta, children }: Props) => (
  <div className="player-card reveal">
    <div className="player-card-portrait">
      <PlayerAvatar name={name} size="xl" />
    </div>
    <div className="player-card-body">
      {meta && <div className="eyebrow">{meta}</div>}
      <h2 className="player-card-name">{name}</h2>
      {children}
      <Link to={`/players/${encodeURIComponent(name)}`} className="text-link">
        View profile <ArrowRight size={14} />
      </Link>
    </div>
  </div>
);

export default PlayerCard;
