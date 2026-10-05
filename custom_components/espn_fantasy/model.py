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


def _slot_name(slot_id: int | None) -> str | None:
    """Return a stable label while preserving unknown ESPN slot IDs."""
    if slot_id is None:
        return None
    return str(LINEUP_SLOT_NAMES.get(slot_id, f"Slot {slot_id}"))


def _league_capabilities(data: dict[str, Any]) -> dict[str, Any]:
    """Describe the ESPN league shape without assuming one roster/scoring format."""
    settings = data.get("settings") or {}
    roster = settings.get("rosterSettings") or {}
    schedule = settings.get("scheduleSettings") or {}
    scoring = settings.get("scoringSettings") or {}
    acquisition = settings.get("acquisitionSettings") or {}

    raw_slots = roster.get("lineupSlotCounts") or {}
    slot_counts: dict[str, int] = {}
    unknown_slots: list[int] = []
    for raw_id, raw_count in raw_slots.items():
        slot_id = _int(raw_id)
        count = _int(raw_count)
        if slot_id is None or count is None or count <= 0:
            continue
        slot_counts[_slot_name(slot_id) or f"Slot {slot_id}"] = count
        if slot_id not in LINEUP_SLOT_NAMES:
            unknown_slots.append(slot_id)

    acquisition_type = str(acquisition.get("acquisitionType") or "").upper()
    uses_budget = bool(
        acquisition.get("isUsingAcquisitionBudget")
        or acquisition.get("isUsingAcquisitionBudgetEnabled")
        or any(token in acquisition_type for token in ("BUDGET", "FAAB", "FAB"))
    )
    scoring_type = scoring.get("scoringType")
    playoff_count = _int(schedule.get("playoffTeamCount"))
    team_count = len(data.get("teams") or [])

    observed_slots: set[int] = set()
    observed_positions: set[int] = set()
    for team in data.get("teams") or []:
        for entry in (team.get("roster") or {}).get("entries") or []:
            slot_id = _int(entry.get("lineupSlotId"))
            if slot_id is not None:
                observed_slots.add(slot_id)
            player = (entry.get("playerPoolEntry") or {}).get("player") or {}
            position_id = _int(player.get("defaultPositionId"))
            if position_id is not None:
                observed_positions.add(position_id)
            for eligible in player.get("eligibleSlots") or []:
                eligible_id = _int(eligible)
                if eligible_id is not None:
                    observed_slots.add(eligible_id)

    unknown_slots = sorted(set(unknown_slots) | {slot for slot in observed_slots if slot not in LINEUP_SLOT_NAMES})
    unknown_positions = sorted(position for position in observed_positions if position not in POSITION_NAMES)

    return {
        "team_count": team_count,
        "scoring_type": scoring_type,
        "lineup_slot_counts": slot_counts,
        "lineup_slot_ids": sorted(set(observed_slots) | {_int(k) for k in raw_slots if _int(k) is not None}),
        "has_ir": any(slot_counts.get(name, 0) for name in ("IR",)),
        "has_idp": any(position in observed_positions for position in range(8, 16)),
        "has_unknown_lineup_slots": bool(unknown_slots),
        "unknown_lineup_slot_ids": unknown_slots,
        "unknown_position_ids": unknown_positions,
        "acquisition_type": acquisition_type or None,
        "uses_acquisition_budget": uses_budget,
        "has_waivers": not any(token in acquisition_type for token in ("FREE_AGENT", "NO_WAIVER", "NONE")),
        "playoff_team_count": playoff_count,
        "playoff_reseed": schedule.get("playoffReseed"),
        "consolation_ladder_enabled": schedule.get("consolationLadderDisabled") is not True,
        "has_divisions": bool((settings.get("scheduleSettings") or {}).get("divisions")),
        "keeper_count": _int((settings.get("draftSettings") or {}).get("keeperCount")),
    }


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


def _weekly_history(player: dict[str, Any], current_period: int | None) -> list[dict[str, Any]]:
    """Normalize weekly fantasy results already embedded in ESPN player data."""
    weeks: dict[int, dict[str, Any]] = {}
    for stat in player.get("stats") or []:
        period = _int(stat.get("scoringPeriodId"))
        if period is None or period <= 0 or (current_period is not None and period > current_period):
            continue
        source = _int(stat.get("statSourceId"))
        if source not in (0, 1) or stat.get("statSplitTypeId") not in (1, None):
            continue
        row = weeks.setdefault(period, {"week": period})
        if source == 0:
            row["actual_points"] = _float(stat.get("appliedTotal"))
            row["stats"] = _named_stats(dict(stat.get("stats") or {}))
        else:
            row["projected_points"] = _float(stat.get("appliedTotal", stat.get("projectedTotal")))
    return [weeks[period] for period in sorted(weeks, reverse=True)]


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

    raw_status = game.get("status") or {}
    status_type = raw_status.get("type") or {}
    state = str(
        status_type.get("state")
        or raw_status.get("state")
        or game.get("gameStatus")
        or ""
    ).lower()
    completed = bool(status_type.get("completed") or raw_status.get("completed"))
    if game.get("statsOfficial") or completed or state in {"post", "final"}:
        status = "final"
    elif state in {"in", "in_progress", "live"}:
        status = "in_progress"
    elif kickoff is not None and datetime.now(timezone.utc) >= kickoff:
        status = "in_progress"
    else:
        status = "scheduled"

    period_number = _int(
        game.get("period")
        or raw_status.get("period")
        or (game.get("situation") or {}).get("period")
    )
    clock = (
        game.get("displayClock")
        or raw_status.get("displayClock")
        or (game.get("situation") or {}).get("displayClock")
        or (game.get("situation") or {}).get("clock")
    )
    detail = (
        status_type.get("shortDetail")
        or status_type.get("detail")
        or raw_status.get("shortDetail")
        or raw_status.get("detail")
    )
    possession_id = _int(
        game.get("possessionProTeamId")
        or game.get("possessionTeamId")
        or (game.get("situation") or {}).get("possessionProTeamId")
        or (game.get("situation") or {}).get("possessionTeamId")
    )
    home_score = _float(
        game.get("homeScore")
        if game.get("homeScore") is not None
        else game.get("homeTeamScore")
        if game.get("homeTeamScore") is not None
        else (game.get("score") or {}).get("home")
    )
    away_score = _float(
        game.get("awayScore")
        if game.get("awayScore") is not None
        else game.get("awayTeamScore")
        if game.get("awayTeamScore") is not None
        else (game.get("score") or {}).get("away")
    )
    opponent = pro_teams.get(opponent_id) or {}
    possession_team = pro_teams.get(possession_id) or {}
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
        "game_period": period_number,
        "game_clock": str(clock) if clock not in (None, "") else None,
        "game_detail": detail,
        "possession_pro_team_id": possession_id,
        "possession_abbrev": _team_abbrev(possession_team),
        "home_pro_team_id": home_id,
        "away_pro_team_id": away_id,
        "home_abbrev": _team_abbrev(pro_teams.get(home_id) or {}),
        "away_abbrev": _team_abbrev(pro_teams.get(away_id) or {}),
        "home_score": home_score,
        "away_score": away_score,
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
    outlooks = player.get("outlooks") or {}
    weekly_outlooks = outlooks.get("outlooksByWeek") or {}
    current_outlook = weekly_outlooks.get(str(period)) if period is not None else None
    if current_outlook is None and period is not None:
        current_outlook = weekly_outlooks.get(period)
    injury_status = player.get("injuryStatus") or entry.get("injuryStatus")
    if injury_status in (None, "", "NORMAL") and entry.get("injuryStatus") not in (None, "", "NORMAL"):
        injury_status = entry.get("injuryStatus")
    if injury_status in (None, "", "NORMAL") and player.get("injured"):
        injury_status = "INJURED"
    return {
        "id": player_id,
        "name": player.get("fullName") or f"Player {player_id}",
        "position_id": position_id,
        "position": POSITION_NAMES.get(position_id, position_id),
        "lineup_slot_id": slot_id,
        "lineup_slot": _slot_name(slot_id),
        "eligible_slot_ids": [_int(slot) for slot in (player.get("eligibleSlots") or []) if _int(slot) is not None],
        "eligible_slots": [_slot_name(_int(slot)) for slot in (player.get("eligibleSlots") or []) if _int(slot) is not None],
        "starter": slot_id not in BENCH_SLOTS if slot_id is not None else None,
        "pro_team_id": pro_team_id,
        "nfl_team": _team_abbrev(pro_team),
        "nfl_team_logo": (
            f"https://a.espncdn.com/i/teamlogos/nfl/500/{_team_abbrev(pro_team).lower()}.png"
            if _team_abbrev(pro_team) else None
        ),
        "headshot": _player_image(player_id, position_id, pro_team_id, pro_teams),
        "biography": player.get("biography") or {},
        "injury_status": injury_status,
        "injured": player.get("injured"),
        "last_news_date": _int(player.get("lastNewsDate")),
        "weekly_outlook": current_outlook,
        "season_outlook": player.get("seasonOutlook"),
        "actual_points": _float(actual.get("appliedTotal")),
        "projected_points": _float(
            projected.get("appliedTotal", projected.get("projectedTotal"))
        ),
        "projection_ceiling": _float(projected.get("appliedTotalCeiling")),
        "stats": _named_stats(dict(actual.get("stats") or {})),
        "weekly_history": _weekly_history(player, period),
        "stat_labels": STAT_LABELS,
        "default_stats": POSITION_DEFAULT_STATS.get(POSITION_NAMES.get(position_id, position_id), []),
        **game,
    }


def _season_summary(history: list[dict[str, Any]]) -> dict[str, Any]:
    """Summarize completed/current weekly fantasy results."""
    actual = [
        row for row in history
        if isinstance(row.get("actual_points"), (int, float))
    ]
    points = [float(row["actual_points"]) for row in actual]
    return {
        "weeks_with_stats": len(actual),
        "total_points": round(sum(points), 2) if points else None,
        "average_points": round(sum(points) / len(points), 2) if points else None,
        "high_points": round(max(points), 2) if points else None,
        "low_points": round(min(points), 2) if points else None,
    }


def _apply_lineup_advice(players: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Annotate projection-based starter/bench swap opportunities.

    ESPN's eligibleSlots is authoritative here, which keeps FLEX/Superflex/IDP
    leagues from being reduced to hard-coded position comparisons.
    """
    starters = [p for p in players if p.get("starter") is True]
    bench = [
        p for p in players
        if p.get("lineup_slot_id") == 20
        and isinstance(p.get("projected_points"), (int, float))
    ]
    for player in players:
        player["lineup_alert"] = None
        player["lineup_alert_player_id"] = None
        player["lineup_alert_player_name"] = None
        player["lineup_alert_difference"] = None

    for starter in starters:
        slot = starter.get("lineup_slot_id")
        starter_projection = starter.get("projected_points")
        if slot is None or not isinstance(starter_projection, (int, float)):
            continue
        candidates = [
            candidate for candidate in bench
            if slot in (candidate.get("eligible_slot_ids") or [])
            and float(candidate["projected_points"]) > float(starter_projection)
        ]
        if not candidates:
            continue
        better = max(candidates, key=lambda p: float(p["projected_points"]))
        difference = round(float(better["projected_points"]) - float(starter_projection), 2)
        starter.update({
            "lineup_alert": "lower_than_bench",
            "lineup_alert_player_id": better.get("id"),
            "lineup_alert_player_name": better.get("name"),
            "lineup_alert_difference": difference,
        })
        previous = better.get("lineup_alert_difference")
        if not isinstance(previous, (int, float)) or difference > previous:
            better.update({
                "lineup_alert": "higher_than_starter",
                "lineup_alert_player_id": starter.get("id"),
                "lineup_alert_player_name": starter.get("name"),
                "lineup_alert_difference": difference,
            })
    return players


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


def _player_id_from_entry(entry: dict[str, Any]) -> int | None:
    """Return a player ID across ESPN roster entry shapes."""
    pool = entry.get("playerPoolEntry") or {}
    player = pool.get("player") or {}
    return _int(player.get("id") or entry.get("playerId") or pool.get("id"))


def _merge_roster_entry(
    matchup_entry: dict[str, Any],
    canonical_entry: dict[str, Any] | None,
) -> dict[str, Any]:
    """Combine current-matchup placement with canonical roster player data.

    ESPN returns multiple copies of a roster. The mRoster copy is enriched by
    the coordinator with history and injury data, while the matchup copy is
    authoritative for the current lineup slot. Preserve both instead of
    normalizing the matchup copy in isolation.
    """
    if not canonical_entry:
        return matchup_entry

    merged = dict(canonical_entry)
    merged.update({
        key: value
        for key, value in matchup_entry.items()
        if key != "playerPoolEntry"
    })

    canonical_pool = canonical_entry.get("playerPoolEntry") or {}
    matchup_pool = matchup_entry.get("playerPoolEntry") or {}
    merged_pool = dict(canonical_pool)
    merged_pool.update({
        key: value
        for key, value in matchup_pool.items()
        if key != "player"
    })

    canonical_player = canonical_pool.get("player") or {}
    matchup_player = matchup_pool.get("player") or {}
    merged_player = dict(matchup_player)
    merged_player.update(canonical_player)

    # Keep all historical rows from the canonical/enriched player while also
    # retaining any current live row that exists only in the matchup payload.
    keyed_stats: dict[tuple[Any, Any, Any, Any], dict[str, Any]] = {}
    for stat in [
        *(canonical_player.get("stats") or []),
        *(matchup_player.get("stats") or []),
    ]:
        key = (
            stat.get("seasonId"),
            stat.get("scoringPeriodId"),
            stat.get("statSourceId"),
            stat.get("statSplitTypeId"),
        )
        keyed_stats[key] = stat
    if keyed_stats:
        merged_player["stats"] = list(keyed_stats.values())

    merged_pool["player"] = merged_player
    merged["playerPoolEntry"] = merged_pool
    return merged


def _side(
    side: dict[str, Any],
    team: dict[str, Any],
    scoring_period: int | None,
    pro_teams: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    matchup_roster = (
        (side.get("rosterForCurrentScoringPeriod") or {}).get("entries") or []
    )
    canonical_roster = (team.get("roster") or {}).get("entries") or []
    canonical_by_id = {
        player_id: entry
        for entry in canonical_roster
        if (player_id := _player_id_from_entry(entry)) is not None
    }
    roster = [
        _merge_roster_entry(entry, canonical_by_id.get(_player_id_from_entry(entry)))
        for entry in matchup_roster
    ]
    # Fall back to mRoster when ESPN omits the matchup roster entirely.
    if not roster:
        roster = canonical_roster
    players = [_player(entry, scoring_period, pro_teams) for entry in roster]
    for player in players:
        player["season_summary"] = _season_summary(player.get("weekly_history") or [])
    _apply_lineup_advice(players)
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



def _league_record(team: dict[str, Any]) -> dict[str, int]:
    """Return a compact overall fantasy record."""
    record = team.get("record") or {}
    overall = record.get("overall") or record
    return {
        "wins": _int(overall.get("wins")) or 0,
        "losses": _int(overall.get("losses")) or 0,
        "ties": _int(overall.get("ties")) or 0,
    }


def _league_team(team: dict[str, Any]) -> dict[str, Any]:
    """Normalize league-level team metadata without roster payloads."""
    record = _league_record(team)
    return {
        "id": _int(team.get("id")),
        "name": team.get("name")
        or " ".join(filter(None, (team.get("location"), team.get("nickname"))))
        or team.get("abbrev"),
        "abbrev": team.get("abbrev"),
        "logo": team.get("logo"),
        "wins": record["wins"],
        "losses": record["losses"],
        "ties": record["ties"],
        "points_for": _float(team.get("pointsFor")),
        "points_against": _float(team.get("pointsAgainst")),
        "playoff_seed": _int(team.get("playoffSeed")),
        "rank": _int(team.get("rankCalculatedFinal") or team.get("rankFinal")),
        "waiver_rank": _int(team.get("waiverRank")),
        "acquisition_budget_spent": _float((team.get("transactionCounter") or {}).get("acquisitionBudgetSpent")),
        "streak_length": _int((team.get("record") or {}).get("overall", {}).get("streakLength")),
        "streak_type": (team.get("record") or {}).get("overall", {}).get("streakType"),
    }


def _league_activity(
    data: dict[str, Any],
    teams: dict[int, dict[str, Any]],
    pro_teams: dict[int, dict[str, Any]],
    scoring_period: int | None,
) -> list[dict[str, Any]]:
    """Normalize ESPN transactions, including team-oriented trade sides."""
    player_names: dict[int, str] = {}
    roster_players: dict[int, dict[str, Any]] = {}
    for team in teams.values():
        for entry in (team.get("roster") or {}).get("entries") or []:
            pool = entry.get("playerPoolEntry") or {}
            player = pool.get("player") or {}
            player_id = _int(player.get("id") or entry.get("playerId") or pool.get("id"))
            if player_id is not None:
                roster_players[player_id] = player
                if player.get("fullName"):
                    player_names[player_id] = player["fullName"]

    transaction_players = {
        int(key): value
        for key, value in (data.get("transaction_players") or {}).items()
        if str(key).isdigit()
    }
    events: list[dict[str, Any]] = []
    for tx in data.get("transactions") or []:
        if not isinstance(tx, dict):
            continue
        normalized_items: list[dict[str, Any]] = []
        phrases: list[str] = []
        side_ids: set[int] = set()
        for item in tx.get("items") or []:
            if not isinstance(item, dict):
                continue
            player_id = _int(item.get("playerId"))
            pool = item.get("playerPoolEntry") or {}
            raw_player = pool.get("player") or transaction_players.get(player_id) or roster_players.get(player_id) or {}
            name = raw_player.get("fullName") or player_names.get(player_id) or (
                f"Player {player_id}" if player_id is not None else "Player"
            )
            item_type = str(item.get("type") or "").upper()
            from_id = _int(item.get("fromTeamId"))
            to_id = _int(item.get("toTeamId"))
            if from_id in teams:
                side_ids.add(from_id)
            if to_id in teams:
                side_ids.add(to_id)
            from_name = _team_name(teams[from_id]) if from_id in teams else None
            to_name = _team_name(teams[to_id]) if to_id in teams else None
            from_slot = _int(item.get("fromLineupSlotId"))
            to_slot = _int(item.get("toLineupSlotId"))
            action = item_type.lower() or None
            if "LINEUP" in item_type:
                from_bench = from_slot in BENCH_SLOTS
                to_bench = to_slot in BENCH_SLOTS
                if from_bench and not to_bench:
                    action = "started"
                    phrase = f"{name} started"
                elif not from_bench and to_bench:
                    action = "benched"
                    phrase = f"{name} benched"
                else:
                    action = "roster_move"
                    phrase = f"{name}: {LINEUP_SLOT_NAMES.get(from_slot, from_slot)} → {LINEUP_SLOT_NAMES.get(to_slot, to_slot)}"
            elif "ADD" in item_type:
                action = "added"
                phrase = f"{to_name or 'Team'} added {name}"
            elif "DROP" in item_type:
                action = "dropped"
                phrase = f"{from_name or 'Team'} dropped {name}"
            elif "TRADE" in item_type:
                action = "traded"
                phrase = f"{name}: {from_name or 'Team'} → {to_name or 'Team'}"
            elif from_name and to_name:
                phrase = f"{name}: {from_name} → {to_name}"
            else:
                phrase = name
            phrases.append(phrase)
            position_id = _int(raw_player.get("defaultPositionId"))
            pro_team_id = _int(raw_player.get("proTeamId"))
            normalized_player = (
                _player(
                    {
                        "playerId": player_id,
                        "lineupSlotId": 20,
                        "playerPoolEntry": {"id": player_id, "player": raw_player},
                    },
                    scoring_period,
                    pro_teams,
                )
                if raw_player
                else None
            )
            normalized_items.append({
                "type": action,
                "raw_type": item_type.lower() or None,
                "from_lineup_slot_id": from_slot,
                "from_lineup_slot": LINEUP_SLOT_NAMES.get(from_slot, from_slot),
                "to_lineup_slot_id": to_slot,
                "to_lineup_slot": LINEUP_SLOT_NAMES.get(to_slot, to_slot),
                "player_id": player_id,
                "player_name": name,
                "position": POSITION_NAMES.get(position_id, position_id),
                "nfl_team": _team_abbrev(pro_teams.get(pro_team_id) or {}),
                "headshot": _player_image(player_id, position_id, pro_team_id, pro_teams),
                "injury_status": normalized_player.get("injury_status") if normalized_player else None,
                "from_team_id": from_id,
                "from_team_name": from_name,
                "to_team_id": to_id,
                "to_team_name": to_name,
                "player": normalized_player,
            })

        team_id = _int(tx.get("teamId"))
        if team_id in teams:
            side_ids.add(team_id)
        event_type = str(tx.get("type") or tx.get("transactionType") or "transaction").lower()
        is_trade = "trade" in event_type or (
            len(side_ids) > 1
            and any(
                item.get("from_team_id") in teams and item.get("to_team_id") in teams
                for item in normalized_items
            )
        )
        sides: list[dict[str, Any]] = []
        for side_id in sorted(side_ids):
            team = teams.get(side_id) or {}
            sent = [
                item for item in normalized_items
                if item.get("from_team_id") == side_id and item.get("to_team_id") != side_id
            ]
            received = [
                item for item in normalized_items
                if item.get("to_team_id") == side_id and item.get("from_team_id") != side_id
            ]
            sides.append({
                "team_id": side_id,
                "team_name": _team_name(team),
                "team_logo": team.get("logo"),
                "sent": sent,
                "received": received,
            })
        description = " · ".join(phrases) if phrases else event_type.replace("_", " ").title()
        events.append({
            "id": tx.get("id") or tx.get("transactionId"),
            "type": event_type,
            "is_trade": is_trade,
            "status": str(tx.get("status") or "").lower() or None,
            "timestamp": _int(tx.get("processDate") or tx.get("proposedDate") or tx.get("date")),
            "team_id": team_id,
            "team_name": _team_name(teams[team_id]) if team_id in teams else None,
            "team_logo": teams[team_id].get("logo") if team_id in teams else None,
            "bid_amount": _float(tx.get("bidAmount")),
            "items": normalized_items,
            "sides": sides,
            "description": description,
        })
    events.sort(key=lambda event: event.get("timestamp") or 0, reverse=True)
    return events

def _normalize_league_game(
    matchup: dict[str, Any],
    teams: dict[int, dict[str, Any]],
    current_period: int | None,
    scoring_period: int | None = None,
    pro_teams: dict[int, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Normalize one fantasy matchup for schedule/scoreboard/bracket use."""
    home = matchup.get("home") or {}
    away = matchup.get("away") or {}
    home_id, away_id = _int(home.get("teamId")), _int(away.get("teamId"))
    home_team, away_team = teams.get(home_id, {}), teams.get(away_id, {})
    period = _int(matchup.get("matchupPeriodId"))
    winner = str(matchup.get("winner") or "").upper() or None
    if winner in {"HOME", "AWAY", "TIE"}:
        status = "final"
    elif current_period is not None and period is not None:
        status = "final" if period < current_period else ("current" if period == current_period else "scheduled")
    else:
        status = "scheduled"

    pro_teams = pro_teams or {}
    def enriched_side(raw_side: dict[str, Any], team: dict[str, Any]) -> dict[str, Any]:
        if not team:
            return {}
        detail = _side(raw_side, team, scoring_period, pro_teams)
        return {
            **detail,
            "score": _float(raw_side.get("totalPointsLive", raw_side.get("totalPoints"))),
            "projected_score": _float(raw_side.get("totalProjectedPoints")),
            "live_projected_score": _float(raw_side.get("totalProjectedPointsLive", raw_side.get("totalProjectedPoints"))),
            "win_probability": _float(raw_side.get("winProbability")),
        }

    home_detail = enriched_side(home, home_team)
    away_detail = enriched_side(away, away_team)
    return {
        "id": matchup.get("id"),
        "matchup_period": period,
        "playoff_tier": matchup.get("playoffTierType"),
        "winner": winner,
        "status": status,
        "home_team_id": home_id,
        "home_team_name": _league_team(home_team).get("name") if home_team else None,
        "home_logo": home_team.get("logo"),
        "home_seed": _int(home_team.get("playoffSeed")) if home_team else None,
        "home_score": _float(home.get("totalPointsLive", home.get("totalPoints"))),
        "home_projected_score": _float(home.get("totalProjectedPointsLive", home.get("totalProjectedPoints"))),
        "home_win_probability": _float(home.get("winProbability")),
        "home_starters_remaining": home_detail.get("starters_remaining"),
        "home_starters_playing": home_detail.get("starters_playing"),
        "home_starters_completed": home_detail.get("starters_completed"),
        "home_team": home_detail or None,
        "away_team_id": away_id,
        "away_team_name": _league_team(away_team).get("name") if away_team else None,
        "away_logo": away_team.get("logo"),
        "away_seed": _int(away_team.get("playoffSeed")) if away_team else None,
        "away_score": _float(away.get("totalPointsLive", away.get("totalPoints"))),
        "away_projected_score": _float(away.get("totalProjectedPointsLive", away.get("totalProjectedPoints"))),
        "away_win_probability": _float(away.get("winProbability")),
        "away_starters_remaining": away_detail.get("starters_remaining"),
        "away_starters_playing": away_detail.get("starters_playing"),
        "away_starters_completed": away_detail.get("starters_completed"),
        "away_team": away_detail or None,
    }

def _round_labels(count: int) -> list[str]:
    """Return readable labels for a league's number of playoff rounds."""
    labels = []
    for index in range(count):
        remaining = count - index
        if remaining == 1:
            labels.append("Championship")
        elif remaining == 2:
            labels.append("Semifinals")
        elif remaining == 3:
            labels.append("Quarterfinals")
        else:
            labels.append(f"Round {index + 1}")
    return labels


def _projected_playoff_bracket(
    standings: list[dict[str, Any]],
    settings: dict[str, Any],
) -> dict[str, Any] | None:
    """Build a clearly-labelled fallback projection from ESPN standings/seeds."""
    schedule_settings = settings.get("scheduleSettings") or {}
    playoff_count = _int(schedule_settings.get("playoffTeamCount"))
    if not playoff_count or playoff_count < 2:
        return None
    seeded = sorted(
        standings,
        key=lambda team: (
            team.get("playoff_seed") is None,
            team.get("playoff_seed") or team.get("standing") or 999,
        ),
    )[:playoff_count]
    if len(seeded) < 2:
        return None

    bracket_size = 1
    while bracket_size < len(seeded):
        bracket_size *= 2
    rounds_count = 0
    size = bracket_size
    while size > 1:
        rounds_count += 1
        size //= 2
    labels = _round_labels(rounds_count)
    byes = bracket_size - len(seeded)
    active = seeded[byes:]
    first_matches: list[dict[str, Any]] = []
    left, right = 0, len(active) - 1
    while left < right:
        home, away = active[left], active[right]
        first_matches.append({
            "id": f"projected-r1-{left}",
            "matchup_period": None,
            "playoff_tier": "WINNERS_BRACKET",
            "winner": None,
            "status": "projected",
            "home_team_id": home.get("id"),
            "home_team_name": home.get("name"),
            "home_logo": home.get("logo"),
            "home_seed": home.get("playoff_seed") or home.get("standing"),
            "home_score": None,
            "home_projected_score": None,
            "away_team_id": away.get("id"),
            "away_team_name": away.get("name"),
            "away_logo": away.get("logo"),
            "away_seed": away.get("playoff_seed") or away.get("standing"),
            "away_score": None,
            "away_projected_score": None,
        })
        left += 1
        right -= 1

    rounds = [{"index": 1, "label": labels[0], "matchup_period": None, "matches": first_matches}]
    previous_match_count = max(1, bracket_size // 2)
    for round_index in range(2, rounds_count + 1):
        match_count = max(1, previous_match_count // 2)
        matches = []
        for match_index in range(match_count):
            home = seeded[match_index] if round_index == 2 and match_index < byes else None
            matches.append({
                "id": f"projected-r{round_index}-{match_index}",
                "matchup_period": None,
                "playoff_tier": "WINNERS_BRACKET",
                "winner": None,
                "status": "projected",
                "home_team_id": home.get("id") if home else None,
                "home_team_name": home.get("name") if home else "TBD",
                "home_logo": home.get("logo") if home else None,
                "home_seed": (home.get("playoff_seed") or home.get("standing")) if home else None,
                "home_score": None,
                "home_projected_score": None,
                "away_team_id": None,
                "away_team_name": "TBD",
                "away_logo": None,
                "away_seed": None,
                "away_score": None,
                "away_projected_score": None,
            })
        rounds.append({"index": round_index, "label": labels[round_index - 1], "matchup_period": None, "matches": matches})
        previous_match_count = match_count

    return {
        "available": True,
        "projected": True,
        "source": "standings_projection",
        "playoff_team_count": playoff_count,
        "rounds": rounds,
    }


def _playoff_bracket_model(
    schedule: list[dict[str, Any]],
    standings: list[dict[str, Any]],
    settings: dict[str, Any],
    current_period: int | None,
) -> dict[str, Any]:
    """Build every ESPN postseason tier, with a winners-bracket projection fallback."""
    tier_labels = {
        "WINNERS_BRACKET": "Championship Bracket",
        "WINNERS_CONSOLATION_LADDER": "Winners Consolation Ladder",
        "LOSERS_BRACKET": "Winners Consolation Ladder",
        "CONSOLATION_LADDER": "Consolation Ladder",
    }
    tier_order = {
        "WINNERS_BRACKET": 0,
        "WINNERS_CONSOLATION_LADDER": 1,
        "LOSERS_BRACKET": 1,
        "CONSOLATION_LADDER": 2,
    }
    playoff_games = [
        game for game in schedule
        if str(game.get("playoff_tier") or "").upper() not in {"", "NONE"}
    ]
    grouped: dict[str, dict[int, list[dict[str, Any]]]] = {}
    for game in playoff_games:
        tier = str(game.get("playoff_tier") or "").upper()
        period = game.get("matchup_period")
        if isinstance(period, int):
            grouped.setdefault(tier, {}).setdefault(period, []).append(game)

    sections: list[dict[str, Any]] = []
    for tier, by_period in sorted(
        grouped.items(), key=lambda item: (tier_order.get(item[0], 99), item[0])
    ):
        periods = sorted(by_period)
        labels = _round_labels(len(periods))
        rounds = [
            {
                "index": index + 1,
                "label": labels[index],
                "matchup_period": period,
                "matches": by_period[period],
            }
            for index, period in enumerate(periods)
        ]
        sections.append({
            "tier": tier,
            "label": tier_labels.get(tier, tier.replace("_", " ").title()),
            "rounds": rounds,
        })

    schedule_settings = settings.get("scheduleSettings") or {}
    has_winners_consolation = any(
        section["tier"] in {"WINNERS_CONSOLATION_LADDER", "LOSERS_BRACKET"}
        for section in sections
    )
    if (
        sections
        and schedule_settings.get("consolationLadderDisabled") is not True
        and not has_winners_consolation
    ):
        periods = sorted({
            game.get("matchup_period")
            for game in playoff_games
            if isinstance(game.get("matchup_period"), int)
        })
        # The winners consolation game is played only in the final postseason
        # matchup period. Do not manufacture a first-round TBD matchup merely
        # to align it with the championship bracket.
        winners_consolation_periods = periods[-1:] or [None]
        sections.append({
            "tier": "LOSERS_BRACKET",
            "label": "Winners Consolation Ladder",
            "rounds": [{
                "index": index + 1,
                "label": "Winners Consolation",
                "matchup_period": period,
                "matches": [{
                    "id": f"projected-winners-consolation-r{index + 1}",
                    "matchup_period": period,
                    "playoff_tier": "LOSERS_BRACKET",
                    "winner": None,
                    "status": "projected",
                    "home_team_id": None,
                    "home_team_name": "TBD",
                    "home_logo": None,
                    "home_seed": None,
                    "home_score": None,
                    "home_projected_score": None,
                    "away_team_id": None,
                    "away_team_name": "TBD",
                    "away_logo": None,
                    "away_seed": None,
                    "away_score": None,
                    "away_projected_score": None,
                }],
            } for index, period in enumerate(winners_consolation_periods)],
        })
        sections.sort(key=lambda section: (
            tier_order.get(section["tier"], 99), section["tier"]
        ))

    if sections:
        winners = next(
            (section for section in sections if section["tier"] == "WINNERS_BRACKET"),
            sections[0],
        )
        has_started = any(
            game.get("status") in {"current", "final"} for game in playoff_games
        )
        return {
            "available": True,
            "projected": not has_started,
            "source": "espn_schedule",
            "playoff_team_count": _int((settings.get("scheduleSettings") or {}).get("playoffTeamCount")),
            "rounds": winners["rounds"],
            "sections": sections,
        }

    projected = _projected_playoff_bracket(standings, settings)
    if projected:
        sections = [{
            "tier": "WINNERS_BRACKET",
            "label": "Championship Bracket",
            "rounds": projected.get("rounds") or [],
        }]
        schedule_settings = settings.get("scheduleSettings") or {}
        if schedule_settings.get("consolationLadderDisabled") is not True:
            playoff_count = _int(schedule_settings.get("playoffTeamCount")) or 0
            postseason_periods = sorted(
                _int(period)
                for period in (schedule_settings.get("matchupPeriods") or {})
                if _int(period) is not None
                and _int(period) > (_int(schedule_settings.get("matchupPeriodCount")) or 0)
            )
            winners_consolation_rounds = []
            # Winners consolation is a single game in the second/final
            # postseason round; horizontal alignment is handled by the card.
            for index, period in enumerate(postseason_periods[-1:] or [None]):
                winners_consolation_rounds.append({
                    "index": index + 1,
                    "label": "Winners Consolation",
                    "matchup_period": period,
                    "matches": [{
                        "id": f"projected-winners-consolation-r{index + 1}-{match_index}",
                        "matchup_period": period,
                        "playoff_tier": "LOSERS_BRACKET",
                        "winner": None,
                        "status": "projected",
                        "home_team_id": None,
                        "home_team_name": "TBD",
                        "home_logo": None,
                        "home_seed": None,
                        "home_score": None,
                        "home_projected_score": None,
                        "away_team_id": None,
                        "away_team_name": "TBD",
                        "away_logo": None,
                        "away_seed": None,
                        "away_score": None,
                        "away_projected_score": None,
                    } for match_index in range(max(1, playoff_count // 4))],
                })
            sections.append({
                "tier": "LOSERS_BRACKET",
                "label": "Winners Consolation Ladder",
                "rounds": winners_consolation_rounds,
            })
            consolation = sorted(
                standings,
                key=lambda team: (
                    team.get("playoff_seed") is None,
                    team.get("playoff_seed") or team.get("standing") or 999,
                ),
            )[playoff_count:]
            if len(consolation) >= 2:
                postseason_periods = sorted(
                    _int(period)
                    for period in (schedule_settings.get("matchupPeriods") or {})
                    if _int(period) is not None
                    and _int(period) > (_int(schedule_settings.get("matchupPeriodCount")) or 0)
                )
                round_count = max(1, len(postseason_periods))
                rounds = []
                first_matches = []
                left, right = 0, len(consolation) - 1
                while left < right:
                    home, away = consolation[left], consolation[right]
                    first_matches.append({
                        "id": f"projected-consolation-r1-{left}",
                        "matchup_period": postseason_periods[0] if postseason_periods else None,
                        "playoff_tier": "CONSOLATION_LADDER",
                        "winner": None,
                        "status": "projected",
                        "home_team_id": home.get("id"),
                        "home_team_name": home.get("name"),
                        "home_logo": home.get("logo"),
                        "home_seed": home.get("playoff_seed") or home.get("standing"),
                        "home_score": None,
                        "home_projected_score": None,
                        "away_team_id": away.get("id"),
                        "away_team_name": away.get("name"),
                        "away_logo": away.get("logo"),
                        "away_seed": away.get("playoff_seed") or away.get("standing"),
                        "away_score": None,
                        "away_projected_score": None,
                    })
                    left += 1
                    right -= 1
                rounds.append({
                    "index": 1,
                    "label": "Round 1" if round_count > 1 else "Consolation",
                    "matchup_period": postseason_periods[0] if postseason_periods else None,
                    "matches": first_matches,
                })
                for index in range(1, round_count):
                    rounds.append({
                        "index": index + 1,
                        "label": f"Round {index + 1}",
                        "matchup_period": postseason_periods[index] if index < len(postseason_periods) else None,
                        "matches": [{
                            "id": f"projected-consolation-r{index + 1}-{match_index}",
                            "matchup_period": postseason_periods[index] if index < len(postseason_periods) else None,
                            "playoff_tier": "CONSOLATION_LADDER",
                            "winner": None,
                            "status": "projected",
                            "home_team_id": None,
                            "home_team_name": "TBD",
                            "home_logo": None,
                            "home_seed": None,
                            "home_score": None,
                            "home_projected_score": None,
                            "away_team_id": None,
                            "away_team_name": "TBD",
                            "away_logo": None,
                            "away_seed": None,
                            "away_score": None,
                            "away_projected_score": None,
                        } for match_index in range(max(1, len(first_matches)))],
                    })
                sections.append({
                    "tier": "CONSOLATION_LADDER",
                    "label": "Consolation Ladder",
                    "rounds": rounds,
                })
        projected["sections"] = sections
        return projected
    return {
        "available": False,
        "projected": True,
        "source": None,
        "playoff_team_count": _int((settings.get("scheduleSettings") or {}).get("playoffTeamCount")),
        "rounds": [],
        "sections": [],
    }

def _league_model(
    data: dict[str, Any],
    teams: dict[int, dict[str, Any]],
    matchup_period: int | None,
    scoring_period: int | None,
    pro_teams: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    """Build standings, schedule, scoreboard, bracket, and league activity."""
    normalized_teams = [_league_team(team) for team in teams.values()]
    normalized_teams.sort(
        key=lambda team: (
            team.get("rank") is None and team.get("playoff_seed") is None,
            team.get("rank") if team.get("rank") is not None else (
                team.get("playoff_seed") if team.get("playoff_seed") is not None else 999
            ),
            -(team.get("wins") or 0),
            team.get("losses") or 0,
            -(team.get("points_for") or 0),
        )
    )
    standings = [
        {**team, "standing": index + 1}
        for index, team in enumerate(normalized_teams)
    ]

    raw_schedule = data.get("season_schedule") or data.get("schedule") or []
    schedule = [
        _normalize_league_game(matchup, teams, matchup_period, scoring_period, pro_teams)
        for matchup in raw_schedule
        if isinstance(matchup, dict)
    ]
    schedule.sort(key=lambda game: ((game.get("matchup_period") or 999), str(game.get("id") or "")))

    scoreboard_source = data.get("current_matchup") or raw_schedule
    scoreboard: list[dict[str, Any]] = []
    for matchup in scoreboard_source or []:
        if not isinstance(matchup, dict):
            continue
        if matchup_period is not None and _int(matchup.get("matchupPeriodId")) != matchup_period:
            continue
        game = _normalize_league_game(matchup, teams, matchup_period, scoring_period, pro_teams)
        if game.get("home_team_id") is None and game.get("away_team_id") is None:
            continue
        scoreboard.append(game)

    schedule_periods = sorted({
        game["matchup_period"]
        for game in schedule
        if isinstance(game.get("matchup_period"), int)
    })
    settings = data.get("settings") or {}
    bracket = _playoff_bracket_model(schedule, standings, settings, matchup_period)
    acquisition = settings.get("acquisitionSettings") or {}
    budget = _float(acquisition.get("acquisitionBudget"))
    acquisition_type = str(acquisition.get("acquisitionType") or "").upper()
    uses_budget = bool(
        acquisition.get("isUsingAcquisitionBudget")
        or acquisition.get("isUsingAcquisitionBudgetEnabled")
        or any(token in acquisition_type for token in ("BUDGET", "FAAB", "FAB"))
    )
    no_waivers = any(token in acquisition_type for token in ("FREE_AGENT", "NO_WAIVER", "NONE"))
    waiver_order = [
        {
            "rank": team.get("waiver_rank"),
            "team_id": team.get("id"),
            "team_name": team.get("name"),
            "team_logo": team.get("logo"),
            "budget_spent": team.get("acquisition_budget_spent") if uses_budget else None,
            "budget_remaining": (
                round(budget - float(team.get("acquisition_budget_spent") or 0), 2)
                if uses_budget and budget is not None else None
            ),
        }
        for team in standings
        if team.get("waiver_rank") is not None and not no_waivers
    ]
    waiver_order.sort(key=lambda item: item["rank"])
    waiver_system = "none" if no_waivers else ("fab_tiebreaker" if uses_budget else ("waiver_order" if waiver_order else "unknown"))
    activity = _league_activity(
        data,
        teams,
        {
            _int(team.get("id")): team
            for team in data.get("pro_team_schedules") or []
            if _int(team.get("id")) is not None
        },
        _int(data.get("scoringPeriodId"))
        or _int((data.get("status") or {}).get("currentScoringPeriod")),
    )
    team_rosters = [
        _side({"teamId": team_key}, team, scoring_period, pro_teams)
        for team_key, team in teams.items()
    ]
    team_rosters.sort(key=lambda item: str(item.get("team_name") or ""))

    return {
        "standings": standings,
        "team_rosters": team_rosters,
        "scoreboard": scoreboard,
        "schedule": schedule,
        "schedule_periods": schedule_periods,
        "playoff_bracket": bracket,
        "waivers": {
            "available": bool(waiver_order),
            "system": waiver_system,
            "label": "FAB Tiebreaker" if uses_budget else "Waiver Order",
            "acquisition_type": acquisition_type or None,
            "acquisition_budget": budget if uses_budget else None,
            "last_execution": _int((data.get("status") or {}).get("waiverLastExecutionDate")),
            "order": waiver_order,
        },
        "team_count": len(standings),
        "matchup_count": len(scoreboard),
        "matchup_period": matchup_period,
        "activity": activity,
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
    league = _league_model(
        data, teams, matchup_period, scoring_period, pro_teams
    )
    matchup = _matchup(data, team_id, matchup_period)
    if not matchup:
        return {
            "scoring_period": scoring_period,
            "matchup_period": matchup_period,
            "team_id": team_id,
            "capabilities": _league_capabilities(data),
            "league": league,
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
        "capabilities": _league_capabilities(data),
        "league": league,
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
