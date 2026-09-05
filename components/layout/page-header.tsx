/**
 * The crumb + serif title + actions row every screen opens with — mirrors
 * the design system's persistent header pattern (uppercase eyebrow crumb,
 * Instrument Serif title, right-aligned search/scope/primary-action).
 * Rendered per-page (not by AppShell) so each route controls its own
 * title/actions without cross-layout prop threading.
 */
export function PageHeader({
  crumb,
  title,
  description,
  actions,
}: {
  crumb?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 pb-1 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {crumb && <div className="eyebrow">{crumb}</div>}
        <h1 className="font-heading mt-0.5 text-2xl tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
