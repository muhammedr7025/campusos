import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentTenant } from "@/lib/tenant";

export default async function LoginPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/");

  return (
    <Card className="w-full max-w-sm border-none bg-transparent shadow-none sm:border sm:bg-card sm:shadow-sm">
      <CardHeader>
        <div className="eyebrow">Sign in</div>
        <CardTitle className="font-heading text-[28px] leading-tight font-normal">Choose your role</CardTitle>
        <CardDescription>Sign in with the account provided by {tenant.name}.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm tenantName={tenant.subdomain} />
      </CardContent>
    </Card>
  );
}
