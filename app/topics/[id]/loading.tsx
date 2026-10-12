import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading topic">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2 border-b border-rule pb-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
