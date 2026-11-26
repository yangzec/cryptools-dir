import type { ReactNode } from 'react';

export function Meta({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
