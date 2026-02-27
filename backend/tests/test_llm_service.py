from app.services.llm import LLMClient


def test_llm_client_parses_json_response():
    client = LLMClient(
        api_key="test",
        base_url="https://api.groq.com/openai/v1",
        primary_model="model-a",
        fallback_model="model-b",
    )

    def fake_request(model, payload):
        return {"choices": [{"message": {"content": '{"ok": true, "model": "' + model + '"}'}}]}

    client._request = fake_request  # type: ignore[method-assign]
    result = client.generate_json(system_prompt="sys", user_prompt="usr")
    assert result["ok"] is True
    assert result["model"] == "model-a"


def test_llm_client_uses_fallback_model():
    client = LLMClient(
        api_key="test",
        base_url="https://api.groq.com/openai/v1",
        primary_model="model-a",
        fallback_model="model-b",
    )
    calls = []

    def fake_request(model, payload):
        calls.append(model)
        if model == "model-a":
            raise RuntimeError("primary failed")
        return {"choices": [{"message": {"content": '{"ok": true}'}}]}

    client._request = fake_request  # type: ignore[method-assign]
    result = client.generate_json(system_prompt="sys", user_prompt="usr")
    assert result == {"ok": True}
    assert calls == ["model-a", "model-b"]

