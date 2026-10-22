import Modal from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const FPTS_SCORING = [
  { stat: "Point", value: "+1" },
  { stat: "Field goal made", value: "+2" },
  { stat: "Field goal attempt", value: "−1" },
  { stat: "Three made", value: "+1" },
  { stat: "Free throw missed", value: "−1" },
  { stat: "Rebound", value: "+1" },
  { stat: "Assist", value: "+2" },
  { stat: "Steal", value: "+4" },
  { stat: "Block", value: "+4" },
  { stat: "Turnover", value: "−2" },
];

export const EspnCredit = () => (
  <p className="fpts-credit">
    Scoring based on{" "}
    <a href="https://www.espn.com/fantasy/basketball/" target="_blank" rel="noreferrer">
      ESPN Fantasy Basketball
    </a>
    's default points league.
  </p>
);

const FptsInfo = ({ open, onClose }: Props) => (
  <Modal open={open} onClose={onClose} eyebrow="Fantasy points" title="What is FPTS?">
    <p>FPTS adds up a player's box score into one number.</p>
    <dl className="fpts-table">
      {FPTS_SCORING.map((row) => (
        <div key={row.stat}>
          <dt>{row.stat}</dt>
          <dd className="tabular">{row.value}</dd>
        </div>
      ))}
    </dl>
    <EspnCredit />
  </Modal>
);

export default FptsInfo;
