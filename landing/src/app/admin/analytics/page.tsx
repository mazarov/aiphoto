import { Suspense } from "react";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";

export default function AdminAnalyticsPage() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-7xl text-sm text-zinc-500">Загрузка…</p>}>
      <AnalyticsDashboard />
    </Suspense>
  );
}
