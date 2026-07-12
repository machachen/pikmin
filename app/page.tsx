import { PostcardExplorer } from "@/src/components/postcard-explorer";
import { canWrite, isEditingProtected } from "@/src/lib/auth";
import { getAllPostcards } from "@/src/lib/postcards";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const postcards = getAllPostcards();
  const canEdit = await canWrite();

  return (
    <PostcardExplorer
      initialPostcards={postcards}
      initialCanEdit={canEdit}
      authProtected={isEditingProtected()}
    />
  );
}
