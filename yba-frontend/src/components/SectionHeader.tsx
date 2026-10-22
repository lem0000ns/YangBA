import { ReactNode } from "react";

interface Props {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  size?: "hero" | "page" | "section";
  align?: "left" | "center";
}

const SectionHeader = ({
  eyebrow,
  title,
  description,
  actions,
  size = "section",
  align = "left",
}: Props) => {
  const Heading = size == "section" ? "h2" : "h1";
  return (
    <div className={`section-header section-header-${size} align-${align}`}>
      <div className="section-header-text">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <Heading className="section-title">{title}</Heading>
        {description && <p className="section-description">{description}</p>}
      </div>
      {actions && <div className="section-header-actions">{actions}</div>}
    </div>
  );
};

export default SectionHeader;
