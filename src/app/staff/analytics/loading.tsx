import { ListSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return <ListSkeleton rows={3} tiles={4} />;
}
