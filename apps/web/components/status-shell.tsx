interface StatusShellProps {
  label: string;
  value: string;
}

export function StatusShell({ label, value }: StatusShellProps) {
  return (
    <div className="footer-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
