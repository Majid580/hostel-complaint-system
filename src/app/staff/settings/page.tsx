import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { SettingsEditor } from "./SettingsEditor";

export const metadata = { title: "System settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "COORDINATOR") redirect("/staff");

  const settings = await getSettings();
  return <SettingsEditor initial={settings} />;
}
