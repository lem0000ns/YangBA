import { useState } from "react";
import { playerImageURL } from "../constants";
import { SheepMark } from "./Sheep";

interface Props {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
}

/** Player headshot with a sheep fallback when the image fails. */
const PlayerAvatar = ({ name, size = "md" }: Props) => {
  const [failed, setFailed] = useState(false);

  return (
    <span className={`avatar avatar-${size}`}>
      {failed || !name ? (
        <SheepMark className="avatar-sheep" size={size == "sm" ? 22 : size == "md" ? 30 : 56} wool="var(--wool-ink)" face="var(--stone)" />
      ) : (
        <img
          src={playerImageURL(name)}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
};

export default PlayerAvatar;
