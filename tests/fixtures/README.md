# ESPN Fantasy compatibility fixtures

This directory holds small, sanitized ESPN response shapes used to protect the
normalizer against league-format differences. Fixtures must never contain
`espn_s2`, `SWID`, member profiles, email addresses, or other account data.

Prefer the smallest payload that reproduces the league characteristic being
tested. Keep ESPN field names intact so schema drift remains visible.

Useful fixture targets include traditional waivers, FAB, Superflex/unknown
lineup slots, IDP, divisions, keeper leagues, non-four-team playoffs, offseason
state, and completed seasons.
