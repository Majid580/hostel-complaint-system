import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/AppShell";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/staff");
  if (user.role === "STUDENT") redirect("/student");

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        hostel: user.hostel,
        regNo: user.regNo,
      }}
    >
      {children}
    </AppShell>
  );
}
