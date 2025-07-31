import { getAllStreamIds } from "@/lib/mock-data";
import StreamContent from "./StreamContent";

// Server Component that handles static params generation
export async function generateStaticParams() {
  const streamIds = await getAllStreamIds();
  return streamIds.map((id) => ({
    id: id,
  }));
}

// This remains a Server Component
export default async function StreamPage() {
  return <StreamContent />;
}