from functools import lru_cache
from pathlib import Path

import yaml

from app.domain.types import Intent
from app.skillpacks.models import PackStatus, SkillPack

PACK_DIR = Path(__file__).parent / "packs"


class SkillPackRegistry:
    def __init__(self, packs: list[SkillPack]) -> None:
        names = [p.skill_pack for p in packs]
        if len(names) != len(set(names)):
            raise ValueError("duplicate skill pack names")
        self._by_name = {p.skill_pack: p for p in packs}
        self._by_intent: dict[Intent, SkillPack] = {}
        for pack in packs:
            for intent in pack.intents:
                if intent in self._by_intent:
                    raise ValueError(f"intent {intent} claimed by two packs")
                self._by_intent[intent] = pack

    def all(self) -> list[SkillPack]:
        return sorted(self._by_name.values(), key=lambda p: (p.status.value, p.skill_pack))

    def get(self, name: str) -> SkillPack | None:
        return self._by_name.get(name)

    def for_intent(self, intent: Intent) -> SkillPack | None:
        return self._by_intent.get(intent)

    def live(self) -> list[SkillPack]:
        return [p for p in self.all() if p.status is PackStatus.LIVE]


def load_packs(directory: Path = PACK_DIR) -> SkillPackRegistry:
    packs = [
        SkillPack.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
        for path in sorted(directory.glob("*.yaml"))
    ]
    return SkillPackRegistry(packs)


@lru_cache
def get_registry() -> SkillPackRegistry:
    return load_packs()


@lru_cache
def pack_sources() -> dict[str, str]:
    """Raw YAML by pack name, for the console's Skill Pack viewer."""
    out: dict[str, str] = {}
    for path in sorted(PACK_DIR.glob("*.yaml")):
        text = path.read_text(encoding="utf-8")
        out[yaml.safe_load(text)["skill_pack"]] = text
    return out
