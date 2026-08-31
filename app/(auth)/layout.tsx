export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/40 flex flex-1 items-center justify-center p-6">
      {children}
    </div>
  );
}
