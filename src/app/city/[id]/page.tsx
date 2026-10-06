import WorldApp from "@/components/world/WorldApp";
import { cities } from "@/lib/world/cities";
export function generateStaticParams() {
  return cities.map((c) => ({ id: c.id }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <WorldApp initialCity={(await params).id} />;
}
