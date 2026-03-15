import { PostcardExplorer } from "@/src/components/postcard-explorer";
import { getAllPostcards } from "@/src/lib/postcards";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const postcards = getAllPostcards();

  return <PostcardExplorer initialPostcards={postcards} />;
}
