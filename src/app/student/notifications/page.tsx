import { NotificationsList } from "@/components/shared/NotificationsList";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold">Notifications</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Everything that has happened on complaints that concern you.
        </p>
      </header>
      <NotificationsList />
    </div>
  );
}
