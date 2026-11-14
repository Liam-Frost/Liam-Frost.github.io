import importlib.util
import json
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("public_status", pathlib.Path(__file__).with_name("check-regional-release.py"))
status = importlib.util.module_from_spec(spec)
spec.loader.exec_module(status)
REV = "a" * 40


class PublicStatusTests(unittest.TestCase):
    def row(self, **changes):
        return {"id": "A", "status": "success", "expected_revision": REV,
                "actual_revision": REV, "publication": "success"} | changes

    def test_matching_verified_target_succeeds(self):
        rows = status.public_rows({"targets": [self.row()]}, REV)
        self.assertEqual(rows[0]["status"], "success")

    def test_old_version_is_degraded(self):
        rows = status.public_rows({"targets": [self.row(actual_revision="b" * 40)]}, REV)
        self.assertEqual(rows[0]["status"], "degraded")

    def test_missing_report_emits_all_five_degraded_targets(self):
        rows = status.public_rows({}, REV)
        self.assertEqual(len(rows), 5)
        self.assertTrue(all(row["status"] == "degraded" for row in rows))

    def test_unverified_matching_version_is_degraded(self):
        self.assertEqual(status.public_rows({"targets": [self.row(status="degraded")]}, REV)[0]["status"], "degraded")

    def test_arbitrary_metadata_is_never_forwarded(self):
        row = self.row(host="private-address", provider="private-provider", path="private-path", detail="private-error", label="injected-label")
        output = json.dumps(status.public_rows({"targets": [row], "internal": "private-record"}, REV))
        for text in ["private-", "injected-label"]:
            self.assertNotIn(text, output)

    def test_untrusted_revisions_and_target_ids_are_not_echoed(self):
        rows = status.public_rows({"targets": [self.row(actual_revision="private-address"), self.row(id="private-target")]}, REV)
        self.assertEqual(rows[0]["actual_revision"], "unknown")
        self.assertNotIn("private-", json.dumps(rows))

    def test_bad_input_stays_degraded(self):
        self.assertTrue(all(row["status"] == "degraded" for row in status.public_rows([], REV)))

    def test_secondary_requires_matching_verified_revision(self):
        self.assertEqual(status.secondary_row({"status": "success", "revision": REV}, REV)["status"], "success")
        for report in ({}, {"status": "success", "revision": "b" * 40},
                       {"status": "degraded", "revision": REV, "private": "hidden"}):
            row = status.secondary_row(report, REV)
            self.assertEqual(row["status"], "degraded")
            self.assertNotIn("private", row)


if __name__ == "__main__":
    unittest.main()
