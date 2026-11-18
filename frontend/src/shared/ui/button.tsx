import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
};

export function Button({ variant = "primary", loading, children, className = "", disabled, ...props }: Props) {
  return <button type="button" {...props} disabled={disabled || loading}
    className={`button button-${variant} ${className}`}>
    {loading && <LoaderCircle size={16} className="spin" aria-hidden="true" />}{children}
  </button>;
}
