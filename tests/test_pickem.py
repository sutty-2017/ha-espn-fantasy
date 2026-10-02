from __future__ import annotations

import unittest

from custom_components.espn_fantasy.pickem import (
    describe_pickem_payload,
    pickem_entry_summary,
)


class PickemPayloadSummaryTests(unittest.TestCase):
    def test_strings_are_not_preserved(self):
        payload = {
            "id": "ae3faad0-bcfa-11f1-9775-6178909c6726",
            "name": "Private Entry Name",
            "rank": 12,
            "active": True,
        }
        summary = pickem_entry_summary(payload)
        structure = summary["structure"]
        self.assertEqual(structure["rank"], 12)
        self.assertTrue(structure["active"])
        self.assertEqual(structure["name"]["_type"], "string")
        self.assertNotIn("Private Entry Name", str(summary))
        self.assertNotIn("ae3faad0", str(summary))

    def test_known_profile_fields_are_redacted(self):
        summary = describe_pickem_payload(
            {"displayName": "Someone", "email": "person@example.com"}
        )
        self.assertEqual(summary["displayName"], "**REDACTED**")
        self.assertEqual(summary["email"], "**REDACTED**")

    def test_lists_keep_count_and_one_structural_sample(self):
        summary = describe_pickem_payload(
            {"picks": [{"propositionId": 123, "choice": "SEA"}, {"propositionId": 456}]}
        )
        picks = summary["picks"]
        self.assertEqual(picks["_count"], 2)
        self.assertEqual(picks["_sample"]["propositionId"], 123)
        self.assertEqual(picks["_sample"]["choice"]["_type"], "string")

    def test_depth_limit_keeps_keys_not_values(self):
        summary = describe_pickem_payload(
            {"a": {"b": {"c": {"private": "secret", "score": 3}}}},
            max_depth=3,
        )
        leaf = summary["a"]["b"]
        self.assertEqual(leaf["_type"], "object")
        self.assertEqual(leaf["_keys"], ["c"])
        self.assertNotIn("secret", str(summary))


if __name__ == "__main__":
    unittest.main()
