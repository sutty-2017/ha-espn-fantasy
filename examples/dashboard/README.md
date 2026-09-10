# Dashboard examples

The integration exposes two dashboard patterns:

- `espn_roster.yaml` — a native Markdown roster board that groups starters, bench, and IR players and shows current fantasy points.
- `espn_live_player.yaml` — a compact player card intended to be shown only while that player's NFL game is live.

## Live player visibility

Version 0.1.5 adds a `binary_sensor` for every rostered player named `<Player> Game Active`. It is `on` while ESPN's live-scoring response contains that player. Home Assistant card visibility can then use that binary sensor directly.

For example:

```yaml
visibility:
  - condition: state
    entity: binary_sensor.espn_fantasy_173951588_sam_darnold_game_active
    state: "on"
```

Replace the entity IDs with the IDs created in your Home Assistant instance.

The roster card is native Home Assistant Markdown and does not require a custom Lovelace card. It does require the player sensor entity IDs to be listed in the card's `entity_id` section so score changes trigger a refresh.
