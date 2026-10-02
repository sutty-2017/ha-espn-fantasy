from __future__ import annotations

from typing import Any


SENSITIVE_KEYS = {
    "email",
    "firstName",
    "lastName",
    "fullName",
    "displayName",
    "profileName",
}


def describe_pickem_payload(value: Any, *, depth: int = 0, max_depth: int = 4) -> Any:
    """Describe a Gambit payload without retaining account/authentication details."""
    if depth >= max_depth:
        if isinstance(value, dict):
            return {"_type": "object", "_keys": sorted(str(k) for k in value)}
        if isinstance(value, list):
            return {"_type": "array", "_count": len(value)}
        return {"_type": type(value).__name__}

    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for key, child in value.items():
            key_text = str(key)
            if key_text in SENSITIVE_KEYS:
                result[key_text] = "**REDACTED**"
            else:
                result[key_text] = describe_pickem_payload(
                    child, depth=depth + 1, max_depth=max_depth
                )
        return result

    if isinstance(value, list):
        result: dict[str, Any] = {"_type": "array", "_count": len(value)}
        if value:
            result["_sample"] = describe_pickem_payload(
                value[0], depth=depth + 1, max_depth=max_depth
            )
        return result

    if value is None or isinstance(value, (bool, int, float)):
        return value

    # Strings can contain names or other user-entered values. Preserve only shape.
    return {"_type": "string", "_length": len(str(value))}


def pickem_entry_summary(payload: dict[str, Any] | list[Any]) -> dict[str, Any]:
    """Return a diagnostics-safe structural summary of an entry response."""
    return {
        "payload_type": "object" if isinstance(payload, dict) else "array",
        "structure": describe_pickem_payload(payload),
    }
