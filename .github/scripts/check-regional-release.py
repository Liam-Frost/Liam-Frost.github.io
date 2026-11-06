"""Report each region independently; degraded regions do not fail production."""

import concurrent.futures
import json
import os
import re
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


def check_region(region, revision, fetch=fetch_json):
    result = {"region": region, "label": REGIONS[region], "status": "degraded"}
    try:
        release = fetch("/__edge-release/" + region)
        if release.get("revision") != revision:
            result["detail"] = "The region does not serve the published revision."
        elif fetch("/__edge-health/" + region).get("ok") is not True:
            result["detail"] = "The regional API health check failed."
        else:
            result.update(status="success", detail="Published revision and regional API verified.")
    except Exception as error:
        # Do not copy arbitrary response bodies or exception text into workflow commands.
        code = getattr(error, "code", None)
        reason = "HTTP " + str(code) if isinstance(code, int) else type(error).__name__
        result["detail"] = "Regional verification failed (" + reason + ")."
    return result


def main():
    revision = os.environ["REVISION"]
    assert re.fullmatch(r"[a-f0-9]{40}", revision), "Invalid revision"
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        rows = list(pool.map(lambda region: check_region(region, revision), REGIONS))
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write("matrix=" + json.dumps({"include": rows}) + "\n")
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as summary:
        summary.write("## Regional deployment status\n\nProduction remains published when a region is degraded.\n\n")
        summary.write("| Region | Status | Details |\n| --- | --- | --- |\n")
        for row in rows:
            summary.write("| {label} ({region}) | {status} | {detail} |\n".format(**row))
            if row["status"] == "degraded":
                print("::warning::Region " + row["region"] + ": " + row["detail"])


if __name__ == "__main__":
    main()
