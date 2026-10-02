from __future__ import annotations
import importlib.util, json, sys, types, unittest
from pathlib import Path
package=types.ModuleType("espn_fantasy_test"); package.__path__=[]; sys.modules[package.__name__]=package
aiohttp=types.ModuleType("aiohttp"); aiohttp.ClientSession=object; sys.modules["aiohttp"]=aiohttp
api=types.ModuleType("espn_fantasy_test.api")
class ESPNError(Exception): pass
class ESPNAuthError(ESPNError): pass
api.ESPNError=ESPNError; api.ESPNAuthError=ESPNAuthError; sys.modules["espn_fantasy_test.api"]=api
pickem_spec=importlib.util.spec_from_file_location("espn_fantasy_test.pickem_api",Path("custom_components/espn_fantasy/pickem_api.py"))
pickem_api=importlib.util.module_from_spec(pickem_spec); sys.modules[pickem_spec.name]=pickem_api; pickem_spec.loader.exec_module(pickem_api)
ESPNPickemClient=pickem_api.ESPNPickemClient
class _Response:
 def __init__(self,payload,status=200): self.status=status; self._payload=payload
 async def __aenter__(self): return self
 async def __aexit__(self,*args): return None
 async def json(self): return self._payload
class _Session:
 def __init__(self,payload,statuses=None): self.payload=payload; self.statuses=list(statuses or []); self.calls=[]
 def get(self,url,**kwargs):
  self.calls.append((url,kwargs)); status=self.statuses.pop(0) if self.statuses else 200; return _Response(self.payload,status)
class PickemClientTests(unittest.IsolatedAsyncioTestCase):
 async def test_current_challenge_name_and_cookies(self):
  session=_Session({"id":999}); client=ESPNPickemClient(session,2026,"secret","{ABC}"); await client.get_challenge(5); url,kwargs=session.calls[0]
  self.assertTrue(url.endswith("/challenges/nfl-pickem-2026")); self.assertIn(("scoringPeriodId",5),kwargs["params"]); self.assertEqual(kwargs["cookies"],{"espn_s2":"secret","SWID":"{ABC}"})
 async def test_legacy_challenge_slug_is_fallback(self):
  session=_Session({"id":999},statuses=[404,200]); client=ESPNPickemClient(session,2026); await client.get_entry("entry-id")
  self.assertTrue(session.calls[0][0].endswith("/nfl-pickem-2026/entries/entry-id")); self.assertTrue(session.calls[1][0].endswith("/nfl-pigskin-pickem-2026/entries/entry-id"))
 async def test_explicit_challenge_slug(self):
  session=_Session({"id":999}); client=ESPNPickemClient(session,2026,challenge_slug="custom-pickem-2026"); await client.get_entry("entry-id")
  self.assertTrue(session.calls[0][0].endswith("/custom-pickem-2026/entries/entry-id")); self.assertEqual(len(session.calls),1)
 async def test_group_uses_gambit_paging_filter(self):
  session=_Session({"group":{}}); client=ESPNPickemClient(session,2026); await client.get_group("group-id"); url,kwargs=session.calls[0]; filt=json.loads(kwargs["headers"]["gambit-filter"])
  self.assertTrue(url.endswith("/groups/group-id")); self.assertEqual(filt["limit"],100); self.assertTrue(filt["sortRank"]["sortAsc"])
 async def test_propositions_use_challenge_id(self):
  session=_Session([]); client=ESPNPickemClient(session,2026); await client.get_propositions(321); url,kwargs=session.calls[0]
  self.assertTrue(url.endswith("/propositions")); self.assertIn(("challengeId",321),kwargs["params"])
if __name__=="__main__": unittest.main()
