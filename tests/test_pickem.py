from __future__ import annotations
import importlib.util
import unittest
from pathlib import Path
path=Path("custom_components/espn_fantasy/pickem.py")
spec=importlib.util.spec_from_file_location("espn_fantasy_pickem",path)
pickem=importlib.util.module_from_spec(spec); spec.loader.exec_module(pickem)
class PickemPayloadSummaryTests(unittest.TestCase):
 def test_strings_are_not_preserved(self):
  summary=pickem.pickem_entry_summary({"id":"entry-uuid","name":"Private Entry Name","rank":12,"active":True}); structure=summary["structure"]
  self.assertEqual(structure["rank"],12); self.assertTrue(structure["active"]); self.assertEqual(structure["name"]["_type"],"string")
  self.assertNotIn("Private Entry Name",str(summary)); self.assertNotIn("entry-uuid",str(summary))
 def test_known_profile_fields_are_redacted(self):
  summary=pickem.describe_pickem_payload({"displayName":"Someone","email":"person@example.com"})
  self.assertEqual(summary["displayName"],"**REDACTED**"); self.assertEqual(summary["email"],"**REDACTED**")
 def test_lists_keep_count_and_one_structural_sample(self):
  summary=pickem.describe_pickem_payload({"picks":[{"propositionId":123,"choice":"SEA"},{"propositionId":456}]}); picks=summary["picks"]
  self.assertEqual(picks["_count"],2); self.assertEqual(picks["_sample"]["propositionId"],123); self.assertEqual(picks["_sample"]["choice"]["_type"],"string")
 def test_depth_limit_keeps_keys_not_values(self):
  summary=pickem.describe_pickem_payload({"a":{"b":{"c":{"private":"secret","score":3}}}},max_depth=3); leaf=summary["a"]["b"]
  self.assertEqual(leaf["_type"],"object"); self.assertEqual(leaf["_keys"],["c"]); self.assertNotIn("secret",str(summary))
if __name__=="__main__": unittest.main()
