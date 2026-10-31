"""python -m app.eval.run  -- evaluates the configured Understand pipeline on GOLDEN."""

import time
from collections import Counter

from app.ai.understand import understand
from app.core.config import get_settings
from app.eval.golden import GOLDEN, Example
from app.eval.heldout import HELDOUT


def evaluate(examples: list[Example] | None = None) -> dict[str, float]:
    settings = get_settings()
    examples = GOLDEN if examples is None else examples
    n = len(examples)
    intent_ok = lang_ok = inj_ok = legal_ok = 0
    latencies: list[float] = []
    cost = 0.0
    modes: Counter[str] = Counter()
    failures: list[str] = []
    for item in examples:
        t0 = time.perf_counter()
        result = understand(item.text, settings)
        latencies.append((time.perf_counter() - t0) * 1000)
        cost += float(result.ai_cost_inr)
        modes[result.mode] += 1
        got = frozenset(c.intent.value for c in result.cases)
        injected = any(c.injection_suspected for c in result.cases)
        intent_ok += got == item.intents
        lang_ok += result.language == item.language
        inj_ok += injected == item.injection
        legal_ok += result.legal_mention == item.legal
        if got != item.intents or injected != item.injection:
            failures.append(f"{item.text!r}: expected {sorted(item.intents)} got {sorted(got)}")
    latencies.sort()
    report = {
        "examples": float(n),
        "intent_set_accuracy": intent_ok / n,
        "language_accuracy": lang_ok / n,
        "injection_accuracy": inj_ok / n,
        "legal_flag_accuracy": legal_ok / n,
        "p50_ms": latencies[n // 2],
        "p95_ms": latencies[int(n * 0.95) - 1],
        "ai_cost_inr_total": cost,
    }
    print(f"modes: {dict(modes)}")
    for k, v in report.items():
        print(f"{k:24s} {v:.3f}")
    for f in failures:
        print("MISS", f)
    return report


if __name__ == "__main__":
    print("== dev set (rules were tuned on this) ==")
    evaluate(GOLDEN)
    print("\n== held-out set ==")
    evaluate(HELDOUT)
