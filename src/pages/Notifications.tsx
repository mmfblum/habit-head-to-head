import { Bell } from 'lucide-react';
import { useNotifications, useMarkNotificationRead } from '@/hooks/useNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Notifications() {
  const { data, isLoading, error } = useNotifications();
  const markRead = useMarkNotificationRead();

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading notifications…</div>;
  if (error) return <div className="p-4 text-destructive">Failed to load notifications.</div>;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-4 flex items-center gap-2">
        <Bell className="w-5 h-5" />
        <h1 className="text-lg font-semibold">Notifications</h1>
      </div>

      <div className="px-4 space-y-3">
        {(data ?? []).length === 0 ? (
          <p className="text-muted-foreground">No notifications yet.</p>
        ) : (
          data!.map((n) => (
            <Card key={n.id} className={n.read_at ? 'opacity-80' : ''}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">{n.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 space-y-2">
                <p className="text-sm text-muted-foreground">{n.body}</p>
                {!n.read_at && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => markRead.mutate(n.id)}
                    disabled={markRead.isPending}
                  >
                    Mark read
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
