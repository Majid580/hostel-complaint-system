import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { NewComplaintForm } from "./NewComplaintForm";

export const metadata = { title: "File a complaint" };
export const dynamic = "force-dynamic";

export default async function NewComplaintPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") redirect("/login");

  const settings = await getSettings();

  return (
    <NewComplaintForm
      defaultHostel={user.hostel ?? "GIRLS"}
      regNo={user.regNo ?? ""}
      limits={settings.attachments}
      allowAnonymous={settings.policy.allowAnonymous}
    />
  );
}
