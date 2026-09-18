/** Deliberately no RoleShell: a receipt prints as a document, not as a page inside the app. */
export default function ReceiptsLayout({ children }: { children: React.ReactNode }) {
  return <main className="bg-background min-h-full print:bg-white">{children}</main>;
}
