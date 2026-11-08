import { useI18n } from "../lib/i18n";

/** Initial configuration and reload restoration share a quiet spinner, never content skeletons. */
export default function PageLoading() {
  const { t } = useI18n();
  return (
    <div className="pageLoading" role="status" aria-label={t("common.loading")}>
      <span className="pageLoadingSpinner" aria-hidden="true" />
    </div>
  );
}
