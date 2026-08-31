import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentTenant } from "@/lib/tenant";

export default async function LoginPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/");

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in to {tenant.name}</CardTitle>
        <CardDescription>Use the account provided by your institute.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm tenantName={tenant.subdomain} />
      </CardContent>
    </Card>
  );
}
