import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models";
import { UsersManager } from "./UsersManager";

export const metadata = { title: "Staff accounts" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "COORDINATOR") redirect("/staff");

  await connectDB();
  const [staff, studentCount] = await Promise.all([
    User.find({ role: { $in: ["RT", "WARDEN", "COORDINATOR"] } })
      .sort({ role: 1, name: 1 })
      .lean(),
    User.countDocuments({ role: "STUDENT" }),
  ]);

  return (
    <UsersManager
      currentUserId={user.id}
      studentCount={studentCount}
      users={staff.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        phone: u.phone ?? null,
        role: u.role as "RT" | "WARDEN" | "COORDINATOR",
        hostel: u.hostel ?? null,
        isActive: u.isActive,
        mustChangePassword: u.mustChangePassword,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      }))}
    />
  );
}
