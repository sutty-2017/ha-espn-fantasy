# Dashboard examples

The integration exposes two dashboard patterns:

- `espn_roster.yaml` — an ESPN-style roster board built with Mushroom + auto-entities. It discovers the roster automatically and groups the starting lineup separately from Bench & IR.
- `espn_live_player.yaml` — a dynamic Live Now board built with Mushroom + auto-entities. It only creates cards for players whose Game Active binary sensor is on.

## Requirements

These examples use two HACS frontend cards:

- **Mushroom** — provides the player cards and title cards.
- **auto-entities** — dynamically discovers ESPN player sensors and Game Active binary sensors, so player entity IDs do not need to be maintained manually.

## Live player visibility

Version 0.1.5 adds a `binary_sensor` for every rostered player named `<Player> Game Active`. It is `on` while ESPN's live-scoring response contains that player. Home Assistant card visibility can use that binary sensor directly, and the dynamic Live Now example uses it as an auto-entities filter.

For an individual player card, you can still use normal Home Assistant visibility controls:

```yaml
visibility:
  - condition: state
    entity: binary_sensor.espn_fantasy_173951588_sam_darnold_game_active
    state: "on"
```

Replace the entity ID with the one created in your Home Assistant instance.

## Dashboard layout

The recommended setup is:

1. **My Fantasy Team** — always visible, with all starters plus Bench & IR.
2. **Live Now** — automatically appears with only players currently in live scoring.

The roster and live cards use the native Home Assistant grid plus Mushroom and auto-entities; no player entity ID list is required.
