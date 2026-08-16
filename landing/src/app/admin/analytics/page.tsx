import { redirect } from "next/navigation";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  if (params.tab === "finance") redirect("/admin/finance");
  return <AnalyticsDashboard />;
}
