import { companyLabels, type CompanyStatus } from "../model/company";

export function CompanyStatusBadge({ status }: { status: CompanyStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {companyLabels[status]}
    </span>
  );
}
export function CompanyAvatar({
  name,
  id,
  small = false,
}: {
  name: string;
  id: number;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`company-avatar avatar-${id % 5} ${small ? "avatar-small" : ""}`}
    >
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}
