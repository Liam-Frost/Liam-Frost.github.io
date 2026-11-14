"""Build public status from an allowlisted report; infrastructure stays private."""
import json
import os
import pathlib
import re


def safe_revision(value):
    return value if isinstance(value, str) and re.fullmatch(r"[a-f0-9]{40}", value) else "unknown"


def public_rows(report, expected):
    raw = report.get("targets", []) if isinstance(report, dict) else []
    source = {row.get("id"): row for row in raw if isinstance(row, dict)}
    rows = []
    for target in "ABCDE":
        row = source.get(target, {})
        actual = safe_revision(row.get("actual_revision"))
        healthy = row.get("status") == "success" and actual == expected and row.get("expected_revision") == expected
        rows.append({"id": target, "label": "Target " + target,
                     "status": "success" if healthy else "degraded",
                     "expected_revision": expected, "actual_revision": actual,
                     "publication": "success" if row.get("publication") == "success" else "failed"})
    return rows


def read_report(path):
    try:
        value = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError, TypeError):
        return {}


def secondary_row(report, expected):
    actual = safe_revision(report.get("revision"))
    ready = report.get("status") == "success" and actual == expected
    return {"id": "F", "label": "Target F", "status": "success" if ready else "degraded",
            "expected_revision": expected, "actual_revision": actual,
            "publication": "success" if ready else "failed"}


def main():
    expected = os.environ["REVISION"]
    assert safe_revision(expected) == expected, "Invalid revision"
    report = read_report(os.environ["PRODUCTION_REPORT"])
    rows = public_rows(report, expected)
    if "SECONDARY_REPORT" in os.environ:
        rows.append(secondary_row(read_report(os.environ["SECONDARY_REPORT"]), expected))
    failed = [row["id"] for row in rows if row["status"] != "success"]
    degraded = bool(failed or report.get("degraded"))
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write("matrix=" + json.dumps({"include": rows}) + "\n")
        output.write("degraded=" + str(degraded).lower() + "\n")
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as summary:
        summary.write("## " + ("成功但降级 / Success with degradation" if degraded else "成功 / Success") + "\n\n")
        summary.write("Affected targets: " + (", ".join(failed) or "none") + ".\n\n")
        summary.write("| Target | Result | Publication | Actual revision | Expected revision |\n| --- | --- | --- | --- | --- |\n")
        for row in rows:
            summary.write("| {label} | {status} | {publication} | `{actual_revision}` | `{expected_revision}` |\n".format(**row))
            if row["status"] != "success":
                print("::warning::" + row["label"] + " is degraded or unverified.")
        if degraded and not failed:
            print("::warning::Release succeeded with degradation; private diagnostics contain details.")


if __name__ == "__main__":
    main()
