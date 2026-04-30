import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleList } from "@/components/course/module-list";
import { canvas, type Module } from "@/lib/api";

export const Route = createFileRoute("/_app/courses/$courseId/modules")({
  component: ModulesPage,
});

function ModulesPage() {
  const { courseId } = useParams({ from: "/_app/courses/$courseId/modules" });
  const id = Number(courseId);
  const [modules, setModules] = useState<Module[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    canvas.modules(id).then((v) => !cancelled && setModules(v)).catch(() => !cancelled && setModules([]));
    return () => { cancelled = true; };
  }, [id]);

  if (modules === null) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }
  if (modules.length === 0) return <p className="text-sm text-muted-foreground">No modules.</p>;
  return <ModuleList courseId={id} modules={modules} />;
}
