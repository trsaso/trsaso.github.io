import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function TodayLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-[76px] rounded-md" />
        <Skeleton className="h-[76px] rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-14" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
