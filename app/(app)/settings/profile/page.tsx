import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/features/settings/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("first_name, last_name, phone, timezone")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm">{user.email}</p>
          </div>
        </CardContent>
      </Card>

      <ProfileForm
        userId={user.id}
        firstName={profile?.first_name ?? null}
        lastName={profile?.last_name ?? null}
        phone={profile?.phone ?? null}
        timezone={profile?.timezone ?? "America/Chicago"}
      />
    </div>
  );
}
