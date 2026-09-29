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
        "lineup_slot": LINEUP_SLOT_NAMES.get(slot_id, slot_id),
        "eligible_slot_ids": [_int(slot) for slot in (player.get("eligibleSlots") or []) if _int(slot) is not None],
        "eligible_slots": [LINEUP_SLOT_NAMES.get(_int(slot), _int(slot)) for slot in (player.get("eligibleSlots") or []) if _int(slot) is not None],
        "starter": slot_id not in BENCH_SLOTS if slot_id is not None else None,
        "pro_team_id": pro_team_id,
        "nfl_team": _team_abbrev(pro_team),
        "headshot": _player_image(player_id, position_id, pro_team_id, pro_teams),
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
        "streak_length": _int((team.get("record") or {}).get("overall", {}).get("streakLength")),
        "streak_type": (team.get("record") or {}).get("overall", {}).get("streakType"),
    }


def _league_activity(
    data: dict[str, Any], teams: dict[int, dict[str, Any]]
) -> list[dict[str, Any]]:
    """Normalize ESPN transaction records into coherent league activity events."""
    player_names: dict[int, str] = {}
    for team in teams.values():
        for entry in (team.get("roster") or {}).get("entries") or []:
            pool = entry.get("playerPoolEntry") or {}
            player = pool.get("player") or {}
            player_id = _int(player.get("id") or entry.get("playerId") or pool.get("id"))
            if player_id is not None and player.get("fullName"):
                player_names[player_id] = player["fullName"]

    events: list[dict[str, Any]] = []
    for tx in data.get("transactions") or []:
        if not isinstance(tx, dict):
            continue
        items = tx.get("items") or []
        normalized_items: list[dict[str, Any]] = []
        phrases: list[str] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            player_id = _int(item.get("playerId"))
            pool = item.get("playerPoolEntry") or {}
            raw_player = pool.get("player") or {}
            name = raw_player.get("fullName") or player_names.get(player_id) or (
                f"Player {player_id}" if player_id is not None else "Player"
            )
            item_type = str(item.get("type") or "").upper()
            from_id = _int(item.get("fromTeamId"))
            to_id = _int(item.get("toTeamId"))
            from_name = _team_name(teams[from_id]) if from_id in teams else None
            to_name = _team_name(teams[to_id]) if to_id in teams else None
            if "ADD" in item_type:
                phrase = f"{to_name or 'Team'} added {name}"
            elif "DROP" in item_type:
                phrase = f"{from_name or 'Team'} dropped {name}"
            elif from_name and to_name:
                phrase = f"{name}: {from_name} → {to_name}"
            else:
                phrase = name
            phrases.append(phrase)
            normalized_items.append({
                "type": item_type.lower() or None,
                "player_id": player_id,
                "player_name": name,
                "from_team_id": from_id,
                "from_team_name": from_name,
                "to_team_id": to_id,
                "to_team_name": to_name,
            })
        team_id = _int(tx.get("teamId"))
        event_type = str(tx.get("type") or tx.get("transactionType") or "transaction").lower()
        description = " · ".join(phrases) if phrases else event_type.replace("_", " ").title()
        events.append({
            "id": tx.get("id") or tx.get("transactionId"),
            "type": event_type,
            "status": str(tx.get("status") or "").lower() or None,
            "timestamp": _int(tx.get("processDate") or tx.get("proposedDate") or tx.get("date")),
            "team_id": team_id,
            "team_name": _team_name(teams[team_id]) if team_id in teams else None,
            "bid_amount": _float(tx.get("bidAmount")),
            "items": normalized_items,
            "description": description,
        })
    events.sort(key=lambda event: event.get("timestamp") or 0, reverse=True)
    return events


def _league_model(
    data: dict[str, Any],
    teams: dict[int, dict[str, Any]],
    matchup_period: int | None,
) -> dict[str, Any]:
    """Build compact standings and current league scoreboard data."""
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

    scoreboard: list[dict[str, Any]] = []
    for matchup in (data.get("current_matchup") or data.get("schedule") or []):
        if matchup_period is not None and _int(matchup.get("matchupPeriodId")) != matchup_period:
            continue
        home = matchup.get("home") or {}
        away = matchup.get("away") or {}
        home_id, away_id = _int(home.get("teamId")), _int(away.get("teamId"))
        if home_id is None and away_id is None:
            continue
        home_team, away_team = teams.get(home_id, {}), teams.get(away_id, {})
        scoreboard.append(
            {
                "id": matchup.get("id"),
                "matchup_period": _int(matchup.get("matchupPeriodId")),
                "playoff_tier": matchup.get("playoffTierType"),
                "winner": matchup.get("winner"),
                "home_team_id": home_id,
                "home_team_name": _league_team(home_team).get("name") if home_team else None,
                "home_logo": home_team.get("logo"),
                "home_score": _float(home.get("totalPointsLive", home.get("totalPoints"))),
                "home_projected_score": _float(home.get("totalProjectedPointsLive", home.get("totalProjectedPoints"))),
                "away_team_id": away_id,
                "away_team_name": _league_team(away_team).get("name") if away_team else None,
                "away_logo": away_team.get("logo"),
                "away_score": _float(away.get("totalPointsLive", away.get("totalPoints"))),
                "away_projected_score": _float(away.get("totalProjectedPointsLive", away.get("totalProjectedPoints"))),
            }
        )
    return {
        "standings": standings,
        "scoreboard": scoreboard,
        "team_count": len(standings),
        "matchup_count": len(scoreboard),
        "matchup_period": matchup_period,
        "activity": _league_activity(data, teams),
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
    league = _league_model(data, teams, matchup_period)
    matchup = _matchup(data, team_id, matchup_period)
    if not matchup:
        return {
            "scoring_period": scoring_period,
            "matchup_period": matchup_period,
            "team_id": team_id,
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
