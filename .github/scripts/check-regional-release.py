"""Report each region independently; degraded regions do not fail production."""

import concurrent.futures
import json
import os
import pathlib
import re
import time
import urllib.request

REGIONS = {"jp": "Japan", "de": "Germany", "sg": "Singapore", "ca": "Canada", "tw": "Taiwan"}


def fetch_json(path):
    request = urllib.request.Request(
        "https://www.twilightfrosty.com" + path,
        headers={
            "Accept": "application/json",
            "Cache-Control": "no-cache",
            "User-Agent": "personal-home-cd/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)


def check_region(region, revision, fetch=fetch_json, admission=None, publication=None):
    result = {"region": region, "label": REGIONS[region], "status": "degraded",
              "actual_revision": "unknown", "expected_revision": revision,
              "publication": publication or "not-reported"}
    try:
        release = fetch("/__edge-release/" + region)
        actual = release.get("revision")
        if isinstance(actual, str) and re.fullmatch(r"[a-f0-9]{40}", actual):
            result["actual_revision"] = actual
        if release.get("revision") != revision:
            result["detail"] = "The region does not serve the published revision."
        elif fetch("/__edge-health/" + region).get("ok") is not True:
            result["detail"] = "The regional API health check failed."
        else:
            assert admission and admission.get("ready") is True and admission.get("revision") == revision, "Primary authority unavailable"
            lease = admission.get("regions", {}).get(region, {})
            assert (lease.get("eligible") is True and lease.get("revision") == revision
                    and lease.get("generation") == admission.get("generation") == release.get("generation")
                    and release.get("public_archive_sha256") == admission.get("archive_sha256")
                    and lease.get("expires_at", 0) > time.time()), "Region not admitted by current primary"
            result.update(status="success", detail="Current version, archive, health and routing admission verified.")
    except Exception as error:
        # Do not copy arbitrary response bodies or exception text into workflow commands.
        code = getattr(error, "code", None)
        reason = "HTTP " + str(code) if isinstance(code, int) else type(error).__name__
        result["detail"] = "Regional verification failed (" + reason + ")."
    return result


def main():
    revision = os.environ["REVISION"]
    assert re.fullmatch(r"[a-f0-9]{40}", revision), "Invalid revision"
    try:
        admission = fetch_json("/__regional/state.json")
    except Exception:
        admission = None
    report = {}
    report_path = os.environ.get("PRODUCTION_REPORT")
    if report_path and pathlib.Path(report_path).exists():
        report = json.loads(pathlib.Path(report_path).read_text())
    publications = {row.get("region"): "success" if row.get("publication", {}).get("ok") else "failed"
                    for row in report.get("regional_publication", {}).get("nodes", [])}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        rows = list(pool.map(lambda region: check_region(region, revision, admission=admission, publication=publications.get(region)), REGIONS))
    failed = sorted(set([row["region"] for row in rows if row["status"] == "degraded"]
                        + [region for region in report.get("failed_nodes", []) if region in REGIONS]))
    degraded = bool(failed or report.get("replication_degraded"))
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write("matrix=" + json.dumps({"include": rows}) + "\n")
        output.write("degraded=" + str(degraded).lower() + "\n")
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as summary:
        summary.write("## Production: " + ("成功但降级 / success with degradation" if degraded else "成功 / success") + "\n\n")
        summary.write("Failed or unverified regions: " + (", ".join(failed) or "none") + ".\n\n")
        summary.write("| Region | Status | Publication | Actual revision | Expected revision | Details |\n| --- | --- | --- | --- | --- | --- |\n")
        for row in rows:
            summary.write("| {label} ({region}) | {status} | {publication} | `{actual_revision}` | `{expected_revision}` | {detail} |\n".format(**row))
            if row["status"] == "degraded":
                print("::warning::Region " + row["region"] + ": " + row["detail"])
        if report.get("upload_mirror", {}).get("ok") is False:
            summary.write("\nUpload mirror is degraded; the primary remains published.\n")
            print("::warning::Production succeeded with a degraded upload mirror.")


if __name__ == "__main__":
    main()
