"""Optional compact league transport for bundled cards.

The normalized model remains unchanged. Only explicitly opted-in league sensor
exports use references; legacy exports keep all existing attribute paths.
"""
from __future__ import annotations

from typing import Any


def compact_league(league: dict[str, Any]) -> dict[str, Any]:
    """Share identical player values without confusing distinct lineup advice.

Nested normalized values are read-only and already shared within a model build.
Using their identities avoids serializing full historical stats for every lookup.
The index is local to this export and never survives into another refresh.
"""
    players: dict[str, dict[str, Any]] = {}
    refs: dict[tuple, str] = {}

    def intern(player: dict[str, Any]) -> str:
        signature = tuple(
            (key, type(value), id(value) if isinstance(value, (dict, list)) else value)
            for key, value in sorted(player.items())
        )
        if signature not in refs:
            ref = f"p{len(players)}"
            refs[signature] = ref
            players[ref] = player
        return refs[signature]

    def team(detail: dict[str, Any]) -> dict[str, Any]:
        result = {key: value for key, value in detail.items() if key not in ("roster", "starters")}
        result["roster_refs"] = [intern(player) for player in detail.get("roster") or []]
        result["starter_refs"] = [intern(player) for player in detail.get("starters") or []]
        return result

    def game(row: dict[str, Any]) -> dict[str, Any]:
        result = dict(row)
        for side in ("home_team", "away_team"):
            if isinstance(row.get(side), dict):
                result[side] = team(row[side])
        return result

    result = dict(league)
    result["schedule"] = [game(row) for row in league.get("schedule") or []]
    result["scoreboard"] = [game(row) for row in league.get("scoreboard") or []]
    result["team_rosters"] = [team(row) for row in league.get("team_rosters") or []]
    result["player_details"] = players
    result["payload_format"] = "compact_v1"
    return result
