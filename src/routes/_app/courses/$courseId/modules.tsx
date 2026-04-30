import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleList } from "@/components/course/module-list";
import { modulesQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/_app/courses/$courseId/modules")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(modulesQueryOptions(Number(params.courseId))),
  component: ModulesPage,
});

function ModulesPage() {
  const { courseId } = useParams({ from: "/_app/courses/$courseId/modules" });
  const id = Number(courseId);
  const { data, isPending } = useQuery(modulesQueryOptions(id));
  const modules = data ?? [];

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }
  if (modules.length === 0) return <p className="text-sm text-muted-foreground">No modules.</p>;
  return <ModuleList courseId={id} modules={modules} />;
}
