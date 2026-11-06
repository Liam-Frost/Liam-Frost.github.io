import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location(
    "regional_release", pathlib.Path(__file__).with_name("check-regional-release.py")
)
regional = importlib.util.module_from_spec(spec)
spec.loader.exec_module(regional)
REVISION = "a" * 40


class RegionalReleaseTests(unittest.TestCase):
    def test_current_revision_and_healthy_api(self):
        result = regional.check_region("jp", REVISION, lambda _: {"revision": REVISION, "ok": True})
        self.assertEqual(result["status"], "success")

    def test_previous_revision_is_degraded_even_when_api_is_healthy(self):
        result = regional.check_region("tw", REVISION, lambda _: {"revision": "b" * 40, "ok": True})
        self.assertEqual(result["status"], "degraded")

    def test_matching_revision_with_unhealthy_api_is_degraded(self):
        result = regional.check_region("ca", REVISION, lambda _: {"revision": REVISION, "ok": False})
        self.assertEqual(result["status"], "degraded")

    def test_unreachable_or_invalid_region_does_not_raise(self):
        for error in [TimeoutError(), ValueError(), OSError()]:
            with self.subTest(error=type(error).__name__):
                def fail(_):
                    raise error
                self.assertEqual(regional.check_region("de", REVISION, fail)["status"], "degraded")

    def test_non_object_json_is_degraded(self):
        self.assertEqual(regional.check_region("sg", REVISION, lambda _: [])["status"], "degraded")


if __name__ == "__main__":
    unittest.main()
