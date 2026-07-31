"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";
import { toast } from "@/components/ui/toaster";

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Mountain, no DST (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
];

export function ProfileForm({
  userId,
  firstName,
  lastName,
  phone,
  timezone,
}: {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  timezone: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [firstNameValue, setFirstNameValue] = useState(firstName ?? "");
  const [lastNameValue, setLastNameValue] = useState(lastName ?? "");
  const [phoneValue, setPhoneValue] = useState(phone ?? "");
  const [timezoneValue, setTimezoneValue] = useState(timezone);
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile() {
    setSavingProfile(true);
    const displayName = `${firstNameValue} ${lastNameValue}`.trim() || null;
    const { error } = await supabase
      .from("user_profiles")
      .upsert(
        {
          user_id: userId,
          first_name: firstNameValue || null,
          last_name: lastNameValue || null,
          display_name: displayName,
          phone: phoneValue || null,
          timezone: timezoneValue,
        },
        { onConflict: "user_id" },
      );
    setSavingProfile(false);
    if (error) {
      toast.error(friendlyDbError(error.message));
      return;
    }
    toast.success("Profile updated");
    router.refresh();
  }

  async function savePassword() {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password updated");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your name, phone, and timezone as shown to your team.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>First name</Label>
              <Input value={firstNameValue} onChange={(e) => setFirstNameValue(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Last name</Label>
              <Input value={lastNameValue} onChange={(e) => setLastNameValue(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={phoneValue} onChange={(e) => setPhoneValue(e.target.value)} placeholder="(555) 555-5555" />
            </div>
            <div className="space-y-1">
              <Label>Timezone</Label>
              <Select value={timezoneValue} onValueChange={setTimezoneValue}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {US_TIMEZONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button variant="brand" size="sm" disabled={savingProfile} onClick={saveProfile}>
            {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
            Save profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription>Change your sign-in password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {passwordError && (
            <Alert variant="destructive">
              <AlertDescription>{passwordError}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>New password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Confirm new password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          <Button variant="brand" size="sm" disabled={savingPassword || !newPassword} onClick={savePassword}>
            {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
