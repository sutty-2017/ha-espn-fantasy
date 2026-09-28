from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


BENCH_SLOTS = {20, 21}

POSITION_NAMES = {
    1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K",
    8: "DT", 9: "DE", 10: "DE", 11: "LB", 12: "CB", 13: "S", 14: "DB", 15: "DP",
    16: "D/ST",
}

LINEUP_SLOT_NAMES = {
    0: "QB", 2: "RB", 4: "WR", 6: "TE", 8: "DT", 9: "DL", 10: "LB",
    11: "DL", 12: "CB", 13: "S", 14: "DB", 15: "DP", 16: "D/ST", 17: "K",
    20: "Bench", 21: "IR", 23: "FLEX",
}

STAT_NAMES = {
    0: "passing_attempts", 1: "passing_completions", 3: "passing_yards",
    4: "passing_touchdowns", 20: "passing_interceptions", 23: "rushing_attempts",
    24: "rushing_yards", 25: "rushing_touchdowns", 41: "receiving_receptions",
    42: "receiving_yards", 43: "receiving_touchdowns", 58: "receiving_targets",
    68: "fumbles", 72: "fumbles_lost", 83: "field_goals_made",
    84: "field_goals_attempted", 86: "extra_points_made",
    87: "extra_points_attempted", 94: "defensive_touchdowns",
    95: "defensive_interceptions", 96: "defensive_fumbles_recovered",
    97: "defensive_blocked_kicks", 98: "defensive_safeties",
    99: "defensive_sacks", 106: "defensive_forced_fumbles",
    107: "defensive_assisted_tackles", 108: "defensive_solo_tackles",
    109: "defensive_total_tackles", 113: "defensive_passes_defensed",
    120: "defensive_points_allowed", 127: "defensive_yards_allowed",
}

STAT_LABELS = {
    "passing_attempts": "Pass Att", "passing_completions": "Comp",
    "passing_yards": "Pass Yds", "passing_touchdowns": "Pass TD",
    "passing_interceptions": "INT", "rushing_attempts": "Carries",
    "rushing_yards": "Rush Yds", "rushing_touchdowns": "Rush TD",
    "receiving_receptions": "Rec", "receiving_yards": "Rec Yds",
    "receiving_touchdowns": "Rec TD", "receiving_targets": "Targets",
    "fumbles": "Fumbles", "fumbles_lost": "Fum Lost",
    "field_goals_made": "FG Made", "field_goals_attempted": "FG Att",
    "extra_points_made": "XP Made", "extra_points_attempted": "XP Att",
    "defensive_touchdowns": "Def TD", "defensive_interceptions": "INT",
    "defensive_fumbles_recovered": "Fum Rec", "defensive_blocked_kicks": "Blk Kick",
    "defensive_safeties": "Safety", "defensive_sacks": "Sacks",
    "defensive_forced_fumbles": "FF", "defensive_assisted_tackles": "Ast Tack",
    "defensive_solo_tackles": "Solo Tack", "defensive_total_tackles": "Tackles",
    "defensive_passes_defensed": "PD", "defensive_points_allowed": "Pts Allowed",
    "defensive_yards_allowed": "Yds Allowed",
}

POSITION_DEFAULT_STATS = {
    "QB": ["passing_completions", "passing_attempts", "passing_yards", "passing_touchdowns", "passing_interceptions", "rushing_yards", "rushing_touchdowns"],
    "RB": ["rushing_attempts", "rushing_yards", "rushing_touchdowns", "receiving_targets", "receiving_receptions", "receiving_yards", "receiving_touchdowns"],
    "WR": ["receiving_targets", "receiving_receptions", "receiving_yards", "receiving_touchdowns", "rushing_yards"],
    "TE": ["receiving_targets", "receiving_receptions", "receiving_yards", "receiving_touchdowns"],
    "K": ["field_goals_made", "field_goals_attempted", "extra_points_made", "extra_points_attempted"],
    "D/ST": ["defensive_sacks", "defensive_interceptions", "defensive_fumbles_recovered", "defensive_touchdowns", "defensive_safeties", "defensive_points_allowed", "defensive_yards_allowed"],
    "DT": ["defensive_total_tackles", "defensive_solo_tackles", "defensive_assisted_tackles", "defensive_sacks", "defensive_forced_fumbles", "defensive_fumbles_recovered", "defensive_passes_defensed"],
    "DE": ["defensive_total_tackles", "defensive_solo_tackles", "defensive_assisted_tackles", "defensive_sacks", "defensive_forced_fumbles", "defensive_fumbles_recovered", "defensive_passes_defensed"],
    "LB": ["defensive_total_tackles", "defensive_solo_tackles", "defensive_assisted_tackles", "defensive_sacks", "defensive_forced_fumbles", "defensive_interceptions", "defensive_passes_defensed"],
    "CB": ["defensive_total_tackles", "defensive_solo_tackles", "defensive_assisted_tackles", "defensive_interceptions", "defensive_passes_defensed", "defensive_forced_fumbles"],
    "S": ["defensive_total_tackles", "defensive_solo_tackles", "defensive_assisted_tackles", "defensive_interceptions", "defensive_passes_defensed", "defensive_forced_fumbles"],
    "DB": ["defensive_total_tackles", "defensive_solo_tackles", "defensive_assisted_tackles", "defensive_interceptions", "defensive_passes_defensed", "defensive_forced_fumbles"],
    "DP": ["defensive_total_tackles", "defensive_solo_tackles", "defensive_assisted_tackles", "defensive_sacks", "defensive_interceptions", "defensive_forced_fumbles", "defensive_passes_defensed"],
}


def _named_stats(raw: dict[str, Any]) -> dict[str, float]:
    result: dict[str, float] = {}
    for raw_id, value in raw.items():
        try:
            name = STAT_NAMES.get(int(raw_id), f"stat_{raw_id}")
            result[name] = float(value)
        except (TypeError, ValueError):
            continue
    return result


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


def _team_abbrev(team: dict[str, Any]) -> str | None:
    return team.get("abbrev") or team.get("abbreviation")


def _player_image(
    player_id: int | None,
    position_id: int | None,
    pro_team_id: int | None,
    pro_teams: dict[int, dict[str, Any]],
) -> str | None:
    if position_id == 16:
        abbrev = _team_abbrev(pro_teams.get(pro_team_id) or {})
        if abbrev:
            return (
                "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/"
                f"{abbrev}.png"
            )
        return None
    if player_id is None:
        return None
    return f"https://a.espncdn.com/i/headshots/nfl/players/full/{player_id}.png"


def _game_info(
    pro_team_id: int | None,
    period: int | None,
    pro_teams: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    if pro_team_id is None or period is None:
        return {}
    team = pro_teams.get(pro_team_id) or {}
    games = (team.get("proGamesByScoringPeriod") or {}).get(str(period)) or []
    if not games:
        if _int(team.get("byeWeek")) == period:
            return {"game_status": "bye", "opponent_pro_team_id": None}
        return {"game_status": "unknown"}

    game = games[0]
    home_id = _int(game.get("homeProTeamId"))
    away_id = _int(game.get("awayProTeamId"))
    opponent_id = away_id if home_id == pro_team_id else home_id
    date_ms = _int(game.get("date"))
    kickoff = None
    if date_ms is not None:
        kickoff = datetime.fromtimestamp(date_ms / 1000, tz=timezone.utc)
    if game.get("statsOfficial"):
        status = "final"
    elif kickoff is not None and datetime.now(timezone.utc) >= kickoff:
        status = "in_progress"
    else:
        status = "scheduled"
    opponent = pro_teams.get(opponent_id) or {}
    return {
        "game_id": _int(game.get("id")),
        "game_status": status,
        "game_start": kickoff.isoformat() if kickoff else None,
        "start_time_tbd": bool(game.get("startTimeTBD")),
        "home_away": "home" if home_id == pro_team_id else "away",
        "opponent_pro_team_id": opponent_id,
        "opponent_abbrev": _team_abbrev(opponent),
        "opponent_name": (
            f"{opponent.get('location', '')} {opponent.get('name', '')}".strip()
            or None
        ),
    }


def _player(
    entry: dict[str, Any],
    period: int | None,
    pro_teams: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    pool = entry.get("playerPoolEntry") or {}
    player = pool.get("player") or {}
    actual = _stat_entry(player, period, 0)
    projected = _stat_entry(player, period, 1)
    slot_id = _int(entry.get("lineupSlotId"))
    player_id = _int(player.get("id") or entry.get("playerId") or pool.get("id"))
    position_id = _int(player.get("defaultPositionId"))
    pro_team_id = _int(player.get("proTeamId"))
    pro_team = pro_teams.get(pro_team_id) or {}
    game = _game_info(pro_team_id, period, pro_teams)
    return {
        "id": player_id,
        "name": player.get("fullName") or f"Player {player_id}",
        "position_id": position_id,
        "position": POSITION_NAMES.get(position_id, position_id),
        "lineup_slot_id": slot_id,
        "lineup_slot": LINEUP_SLOT_NAMES.get(slot_id, slot_id),
        "starter": slot_id not in BENCH_SLOTS if slot_id is not None else None,
        "pro_team_id": pro_team_id,
        "nfl_team": _team_abbrev(pro_team),
        "headshot": _player_image(player_id, position_id, pro_team_id, pro_teams),
        "injury_status": player.get("injuryStatus"),
        "injured": player.get("injured"),
        "actual_points": _float(actual.get("appliedTotal")),
        "projected_points": _float(
            projected.get("appliedTotal", projected.get("projectedTotal"))
        ),
        "projection_ceiling": _float(projected.get("appliedTotalCeiling")),
        "stats": _named_stats(dict(actual.get("stats") or {})),
        "stat_labels": STAT_LABELS,
        "default_stats": POSITION_DEFAULT_STATS.get(POSITION_NAMES.get(position_id, position_id), []),
        **game,
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
    side: dict[str, Any],
    team: dict[str, Any],
    scoring_period: int | None,
    pro_teams: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    roster = (
        (side.get("rosterForCurrentScoringPeriod") or {}).get("entries") or []
    )
    players = [_player(entry, scoring_period, pro_teams) for entry in roster]
    starters = [player for player in players if player.get("starter")]
    status_counts = {
        status: sum(1 for player in starters if player.get("game_status") == status)
        for status in ("scheduled", "in_progress", "final", "bye", "unknown")
    }
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
        "starters_remaining": status_counts["scheduled"],
        "starters_playing": status_counts["in_progress"],
        "starters_completed": status_counts["final"],
        "starters_on_bye": status_counts["bye"],
        "starters_unknown": status_counts["unknown"],
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
    pro_teams = {
        _int(team.get("id")): team
        for team in data.get("pro_team_schedules") or []
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
            "my_team": _side(
                my_raw, teams.get(team_id, {}), scoring_period, pro_teams
            ),
            "opponent": _side(
                opponent_raw, teams.get(opponent_id, {}), scoring_period, pro_teams
            ),
        },
    }
