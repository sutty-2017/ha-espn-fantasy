from __future__ import annotations

from typing import Any


BENCH_SLOTS = {20, 21}


def _int(value: Any) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _float(value: Any) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _team_name(team: dict[str, Any]) -> str:
    return (
        team.get("name")
        or " ".join(filter(None, (team.get("location"), team.get("nickname"))))
        or f"Team {team.get('id')}"
    )


def _stat_entry(player: dict[str, Any], period: int | None, source: int) -> dict[str, Any]:
    for stat in player.get("stats") or []:
        if (
            _int(stat.get("scoringPeriodId")) == period
            and _int(stat.get("statSourceId")) == source
            and stat.get("statSplitTypeId") in (1, None)
        ):
            return stat
    return {}


def _player(entry: dict[str, Any], period: int | None) -> dict[str, Any]:
    pool = entry.get("playerPoolEntry") or {}
    player = pool.get("player") or {}
    actual = _stat_entry(player, period, 0)
    projected = _stat_entry(player, period, 1)
    slot_id = _int(entry.get("lineupSlotId"))
    player_id = _int(player.get("id") or entry.get("playerId") or pool.get("id"))
    return {
        "id": player_id,
        "name": player.get("fullName") or f"Player {player_id}",
        "position_id": _int(player.get("defaultPositionId")),
        "lineup_slot_id": slot_id,
        "starter": slot_id not in BENCH_SLOTS if slot_id is not None else None,
        "pro_team_id": _int(player.get("proTeamId")),
        "injury_status": player.get("injuryStatus"),
        "injured": player.get("injured"),
        "actual_points": _float(actual.get("appliedTotal")),
        "projected_points": _float(
            projected.get("appliedTotal", projected.get("projectedTotal"))
        ),
        "projection_ceiling": _float(projected.get("appliedTotalCeiling")),
        "actual_stats": dict(actual.get("stats") or {}),
        "projected_stats": dict(projected.get("stats") or {}),
    }


def _matchup(
    data: dict[str, Any], team_id: int, period: int | None
) -> dict[str, Any] | None:
    for source in (data.get("current_matchup"), data.get("live_scoring")):
        stack = [source]
        while stack:
            item = stack.pop()
            if isinstance(item, dict):
                home, away = item.get("home"), item.get("away")
                if isinstance(home, dict) and isinstance(away, dict):
                    matchup_period = _int(item.get("matchupPeriodId"))
                    ids = {_int(home.get("teamId")), _int(away.get("teamId"))}
                    if team_id in ids and (
                        period is None or matchup_period == period
                    ):
                        return item
                stack.extend(item.values())
            elif isinstance(item, list):
                stack.extend(item)
    return None


def _side(
    side: dict[str, Any], team: dict[str, Any], scoring_period: int | None
) -> dict[str, Any]:
    roster = (
        (side.get("rosterForCurrentScoringPeriod") or {}).get("entries") or []
    )
    players = [_player(entry, scoring_period) for entry in roster]
    starters = [player for player in players if player.get("starter")]
    return {
        "team_id": _int(side.get("teamId") or team.get("id")),
        "team_name": _team_name(team),
        "team_abbrev": team.get("abbrev"),
        "team_logo": team.get("logo"),
        "score": _float(side.get("totalPointsLive", side.get("totalPoints"))),
        "projected_score": _float(side.get("totalProjectedPoints")),
        "live_projected_score": _float(
            side.get("totalProjectedPointsLive", side.get("totalProjectedPoints"))
        ),
        "win_probability": _float(side.get("winProbability")),
        "starter_count": len(starters),
        "roster": players,
        "starters": starters,
    }


def build_normalized_model(data: dict[str, Any], team_id: int) -> dict[str, Any]:
    """Build a stable integration-owned model from ESPN response shapes."""
    scoring_period = _int(data.get("scoringPeriodId"))
    status = data.get("status") or {}
    if scoring_period is None:
        scoring_period = _int(status.get("currentScoringPeriod"))
    matchup_period = _int(status.get("currentMatchupPeriod"))

    teams = {
        _int(team.get("id")): team
        for team in data.get("teams") or []
        if _int(team.get("id")) is not None
    }
    matchup = _matchup(data, team_id, matchup_period)
    if not matchup:
        return {
            "scoring_period": scoring_period,
            "matchup_period": matchup_period,
            "team_id": team_id,
            "matchup": None,
        }

    home = matchup.get("home") or {}
    away = matchup.get("away") or {}
    home_id, away_id = _int(home.get("teamId")), _int(away.get("teamId"))
    my_raw = home if home_id == team_id else away
    opponent_raw = away if home_id == team_id else home
    opponent_id = away_id if home_id == team_id else home_id

    return {
        "scoring_period": scoring_period,
        "matchup_period": matchup_period,
        "team_id": team_id,
        "matchup": {
            "id": matchup.get("id"),
            "my_team": _side(my_raw, teams.get(team_id, {}), scoring_period),
            "opponent": _side(
                opponent_raw, teams.get(opponent_id, {}), scoring_period
            ),
        },
    }
