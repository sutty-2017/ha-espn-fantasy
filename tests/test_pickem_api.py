from __future__ import annotations

import json
import unittest

from custom_components.espn_fantasy.pickem_api import ESPNPickemClient


class _Response:
    def __init__(self, payload, status=200):
        self.status = status
        self._payload = payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def json(self):
        return self._payload


class _Session:
    def __init__(self, payload, statuses=None):
        self.payload = payload
        self.statuses = list(statuses or [])
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        status = self.statuses.pop(0) if self.statuses else 200
        return _Response(self.payload, status)


class PickemClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_current_challenge_name_and_cookies(self):
        session = _Session({"id": 999})
        client = ESPNPickemClient(session, 2026, "secret", "{ABC}")
        await client.get_challenge(5)
        url, kwargs = session.calls[0]
        self.assertTrue(url.endswith("/challenges/nfl-pickem-2026"))
        self.assertIn(("scoringPeriodId", 5), kwargs["params"])
        self.assertEqual(kwargs["cookies"], {"espn_s2": "secret", "SWID": "{ABC}"})

    async def test_legacy_challenge_slug_is_fallback(self):
        session = _Session({"id": 999}, statuses=[404, 200])
        client = ESPNPickemClient(session, 2026)
        await client.get_entry("entry-id")
        self.assertTrue(session.calls[0][0].endswith("/nfl-pickem-2026/entries/entry-id"))
        self.assertTrue(
            session.calls[1][0].endswith("/nfl-pigskin-pickem-2026/entries/entry-id")
        )

    async def test_explicit_challenge_slug(self):
        session = _Session({"id": 999})
        client = ESPNPickemClient(session, 2026, challenge_slug="custom-pickem-2026")
        await client.get_entry("entry-id")
        self.assertTrue(
            session.calls[0][0].endswith("/custom-pickem-2026/entries/entry-id")
        )
        self.assertEqual(len(session.calls), 1)

    async def test_group_uses_gambit_paging_filter(self):
        session = _Session({"group": {}})
        client = ESPNPickemClient(session, 2026)
        await client.get_group("group-id")
        url, kwargs = session.calls[0]
        self.assertTrue(url.endswith("/groups/group-id"))
        filt = json.loads(kwargs["headers"]["gambit-filter"])
        self.assertEqual(filt["limit"], 100)
        self.assertTrue(filt["sortRank"]["sortAsc"])

    async def test_propositions_use_challenge_id(self):
        session = _Session([])
        client = ESPNPickemClient(session, 2026)
        await client.get_propositions(321)
        url, kwargs = session.calls[0]
        self.assertTrue(url.endswith("/propositions"))
        self.assertIn(("challengeId", 321), kwargs["params"])


if __name__ == "__main__":
    unittest.main()
