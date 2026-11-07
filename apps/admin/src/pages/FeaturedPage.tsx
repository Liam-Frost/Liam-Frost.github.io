import { useNavigate } from "react-router";
import { useMediaList } from "../hooks/useMedia";
import { FeaturedOrderDialog } from "../components/collection/FeaturedOrderDialog";
import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
export function FeaturedPage() {
  const { data, error, isPending } = useMediaList();
  const navigate = useNavigate();
  if (isPending) return <LoadingSkeleton label="加载精选…" variant="rows" />;
  if (error) return <p role="alert">{error.message}</p>;
  return <FeaturedOrderDialog page items={data ?? []} onClose={() => navigate("/collection")} />;
}
