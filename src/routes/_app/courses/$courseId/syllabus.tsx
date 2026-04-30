import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { CanvasHtml } from "@/lib/html";

export const Route = createFileRoute("/_app/courses/$courseId/syllabus")({
  component: SyllabusPage,
});

function SyllabusPage() {
  const { courseId } = useParams({ from: "/_app/courses/$courseId/syllabus" });
  const [body, setBody] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ syllabus_body?: string | null }>(`/api/v1/courses/${courseId}?include[]=syllabus_body`)
      .then((c) => !cancelled && setBody(c.syllabus_body ?? null))
      .catch(() => !cancelled && setBody(null));
    return () => { cancelled = true; };
  }, [courseId]);

  if (body === undefined) return <Skeleton className="h-64 w-full" />;
  if (!body) return <p className="text-sm text-muted-foreground">No syllabus posted.</p>;

  return (
    <Card>
      <CardContent className="pt-6">
        <CanvasHtml html={body} />
      </CardContent>
    </Card>
  );
}
