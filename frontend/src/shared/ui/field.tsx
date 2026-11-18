import type { ReactNode } from "react";

export function Field({ label, htmlFor, error, hint, children }: {
  label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode;
}) {
  return <div className="field"><label htmlFor={htmlFor}>{label}</label>{children}
    {error ? <p id={`${htmlFor}-error`} className="field-error" role="alert">{error}</p>
      : hint ? <p className="field-hint">{hint}</p> : null}
  </div>;
}
