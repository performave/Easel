import { useQuery } from "@tanstack/react-query";
import { IconCalendarTime } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton-list";
import { upcomingEventsQueryOptions } from "@/lib/queries";
import { formatRelativeDate } from "@/lib/format";

export function UpcomingCard() {
  const { data: upcoming, isPending } = useQuery(upcomingEventsQueryOptions());

  return (
    <Card className="border-0 bg-card/70 shadow-sm ring-1 ring-foreground/8 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconCalendarTime className="size-4" /> Upcoming
        </CardTitle>
        <CardDescription>Next on your calendar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isPending ? (
          <SkeletonList count={3} className="h-10 w-full rounded-lg" />
        ) : !upcoming || upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
        ) : (
          upcoming.slice(0, 6).map((ev) => (
            <div key={ev.id} className="rounded-lg border bg-background/80 p-2.5">
              <p className="truncate text-sm font-medium">{ev.title}</p>
              <p className="text-xs text-muted-foreground">{ev.start_at ? formatRelativeDate(ev.start_at) : "No date"}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
