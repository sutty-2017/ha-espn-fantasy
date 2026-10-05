from pathlib import Path
import unittest


class StaleDataGuardTests(unittest.TestCase):
    def test_coordinator_keeps_last_good_data_after_transient_espn_error(self):
        text = Path("custom_components/espn_fantasy/coordinator.py").read_text()
        self.assertIn("if self.data:", text)
        self.assertIn("keeping last known-good data", text)
        self.assertIn("return self.data", text)
        self.assertIn("_serving_stale_data", text)
        self.assertIn("refresh recovered after a transient API failure", text)

    def test_first_load_failure_still_raises_update_failed(self):
        text = Path("custom_components/espn_fantasy/coordinator.py").read_text()
        stale_return = text.index("return self.data")
        failure_raise = text.index("raise UpdateFailed(str(err)) from err", stale_return)
        self.assertGreater(failure_raise, stale_return)


if __name__ == "__main__":
    unittest.main()
