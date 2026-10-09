"""Regression checks for bounded ESPN diagnostics, without Home Assistant imports."""
from __future__ import annotations

import ast
from pathlib import Path
import unittest

SOURCE = Path(__file__).resolve().parents[1] / "custom_components/espn_fantasy/diagnostics.py"


def load_helpers():
    tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
    wanted = {"_bounded_diagnostic", "_transaction_summary"}
    nodes = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in wanted]
    module = ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[]))
    scope = {
        "Any": object,
        "MAX_DIAGNOSTIC_LIST_ITEMS": 12,
        "MAX_DIAGNOSTIC_DEPTH": 4,
        "MAX_DIAGNOSTIC_STRING_LENGTH": 500,
        "MAX_TRANSACTION_ITEMS": 20,
    }
    exec(compile(module, str(SOURCE), "exec"), scope)
    return scope


class DiagnosticsTests(unittest.TestCase):
    def test_bounded_nested_data(self):
        bounded = load_helpers()["_bounded_diagnostic"]
        original = {"players": [{"name": "x" * 900} for _ in range(30)]}
        result = bounded(original)
        self.assertEqual(len(result["players"]), 12)
        self.assertEqual(len(result["players"][0]["name"]), 500)
        self.assertEqual(len(original["players"]), 30)

    def test_deep_payload_is_truncated(self):
        bounded = load_helpers()["_bounded_diagnostic"]
        result = bounded({"a": {"b": {"c": {"d": list(range(100))}}}})
        self.assertEqual(result["a"]["b"]["c"]["d"], {"omitted": True, "count": 100})

    def test_redacts_nested_credentials(self):
        bounded = load_helpers()["_bounded_diagnostic"]
        self.assertEqual(bounded({"SWID": "secret", "x": {"espn_s2": "secret", "ok": 1}}), {"x": {"ok": 1}})

    def test_transaction_items_are_bounded(self):
        summary = load_helpers()["_transaction_summary"]
        item = {"playerId": 42, "type": "ADD", "player": {"massive": "payload"}}
        result = summary({"id": "tx", "items": [item] * 40})
        self.assertEqual(result["item_count"], 40)
        self.assertEqual(len(result["items"]), 20)
        self.assertEqual(result["items"][0], {"playerId": 42, "type": "ADD"})

    def test_malformed_items_do_not_crash(self):
        summary = load_helpers()["_transaction_summary"]
        self.assertEqual(summary({"items": None})["item_count"], 0)
        self.assertEqual(summary({"items": "invalid"})["items"], [])


if __name__ == "__main__":
    unittest.main()
