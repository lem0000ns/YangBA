import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "./Icons";

interface Props {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit" | "reset";
  to?: string;
  arrow?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}

const Button = ({
  children,
  variant = "primary",
  size = "md",
  type = "button",
  to,
  arrow = false,
  icon,
  disabled,
  className = "",
  onClick,
}: Props) => {
  const classes = `btn btn-${variant} btn-${size} ${className}`;
  const content = (
    <>
      {icon && <span className="btn-icon">{icon}</span>}
      <span>{children}</span>
      {arrow && <ArrowRight size={size == "lg" ? 18 : 15} className="btn-arrow" />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
};

export default Button;
