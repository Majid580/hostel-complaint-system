import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listWorkers } from "@/lib/services/workers";
import { WorkersManager } from "./WorkersManager";
import { visibleHostels } from "@/lib/auth/permissions";
import { HOSTELS } from "@/lib/domain/constants";

export const metadata = { title: "Workers" };
export const dynamic = "force-dynamic";

export default async function WorkersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "STUDENT") redirect("/student");

  const workers = await listWorkers(user);
  const allowedHostels = visibleHostels(user) ?? [...HOSTELS];

  return <WorkersManager initialWorkers={workers} allowedHostels={allowedHostels} />;
}
