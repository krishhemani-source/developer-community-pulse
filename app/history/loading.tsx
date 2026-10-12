import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading history">
      <Skeleton className="mb-8 h-8 w-48" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="grid gap-6 border-b border-rule py-4 sm:grid-cols-[12rem_1fr_auto]">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-40" />
        </div>
      ))}
    </div>
  );
}
