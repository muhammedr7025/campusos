import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Building2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCurrentTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ROLE_HOME } from "@/lib/rbac/permissions";

export default async function Home() {
  const tenant = await getCurrentTenant();

  // Already signed in? Skip the marketing/sign-in card and go straight to
  // the role's home — landing here after login should feel like arriving
  // somewhere, not seeing the same "Sign in" button again.
  const session = await auth();
  if (session?.user) redirect(ROLE_HOME[session.user.role]);

  if (!tenant) {
    const h = await headers();
    const host = h.get("x-tenant-host") ?? "localhost:3000";
    const [hostname, port] = host.split(":");
    const rootHostname = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
    const portSuffix = port ? `:${port}` : "";
    const tenants = await prisma.tenant.findMany({ orderBy: { name: "asc" } });

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
        <Building2 className="text-muted-foreground size-10" />
        <div>
          <h1 className="text-xl font-semibold">This address isn&apos;t tied to an institute yet</h1>
          <p className="text-muted-foreground mt-1 max-w-md text-sm">
            CampusOS is multi-tenant — pick an institute below (works on any host), or visit its
            subdomain directly (e.g. <code className="bg-muted rounded px-1 py-0.5">acme.{rootHostname}{portSuffix}</code>
            {" "}if your browser resolves *.localhost).
          </p>
        </div>

        {tenants.length > 0 && (
          <div className="flex w-full max-w-sm flex-col gap-2">
            {tenants.map((t) => (
              <a key={t.id} href={`/login?tenant=${t.subdomain}`}>
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      {t.logoUrl ? (
                        <Image src={t.logoUrl} alt={t.name} width={32} height={32} className="rounded" />
                      ) : (
                        <div
                          className="flex size-8 items-center justify-center rounded text-sm font-semibold text-white"
                          style={{ background: t.primaryColor }}
                        >
                          {t.name.charAt(0)}
                        </div>
                      )}
                      <span className="font-medium">{t.name}</span>
                    </div>
                    <ArrowRight className="text-muted-foreground size-4" />
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        {tenant.logoUrl ? (
          <Image src={tenant.logoUrl} alt={tenant.name} width={56} height={56} className="rounded-lg" />
        ) : (
          <div className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-lg text-xl font-semibold">
            {tenant.name.charAt(0)}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
        <p className="text-muted-foreground text-sm">Institute operations platform</p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your {tenant.name} account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <a href="/login">Sign in</a>
          </Button>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Badge variant="secondary">Attendance</Badge>
            <Badge variant="secondary">Fees</Badge>
            <Badge variant="secondary">Admissions</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
