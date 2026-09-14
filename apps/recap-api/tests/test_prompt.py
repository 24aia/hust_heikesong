from app.prompts.recap import build_recap_prompt

from conftest import make_input


def test_bridge_mode_uses_bridge_object_example() -> None:
    prompt = build_recap_prompt(make_input(mode="bridge"), "recap-v1")

    assert '"bridge": {"text":"衔接说明","evidence":' in prompt
    assert "bridge 不得为 null、字符串或数组" in prompt


def test_brief_mode_keeps_null_bridge_example() -> None:
    prompt = build_recap_prompt(make_input(mode="brief"), "recap-v1")

    assert '"bridge": null' in prompt
    assert "bridge 必须为 null" in prompt
