import json
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings


class LLMServiceError(RuntimeError):
    pass


@dataclass
class LLMClient:
    api_key: str
    base_url: str
    primary_model: str
    fallback_model: str | None
    timeout_seconds: float = 45.0

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _build_response_format(self, json_schema: dict[str, Any] | None) -> dict[str, Any]:
        if json_schema:
            return {
                "type": "json_schema",
                "json_schema": {
                    "name": "insightflow_output",
                    "schema": json_schema,
                },
            }
        return {"type": "json_object"}

    def _request(self, model: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url.rstrip('/')}/chat/completions"
        body = {**payload, "model": model}
        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.post(url, headers=self._headers(), json=body)
            response.raise_for_status()
            return response.json()

    @staticmethod
    def _extract_json_content(response: dict[str, Any]) -> dict[str, Any]:
        try:
            content = response["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMServiceError("Invalid LLM response shape") from exc

        if not isinstance(content, str):
            raise LLMServiceError("LLM response content is not a string")

        try:
            return json.loads(content)
        except json.JSONDecodeError as exc:
            raise LLMServiceError("LLM response is not valid JSON") from exc

    def generate_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        json_schema: dict[str, Any] | None = None,
        temperature: float = 0.2,
        max_tokens: int = 1200,
    ) -> dict[str, Any]:
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": self._build_response_format(json_schema),
        }

        errors: list[str] = []
        for model in [self.primary_model, self.fallback_model]:
            if not model:
                continue
            try:
                raw = self._request(model=model, payload=payload)
                return self._extract_json_content(raw)
            except (httpx.HTTPError, LLMServiceError, Exception) as exc:
                errors.append(f"{model}: {exc}")

        raise LLMServiceError(f"All LLM attempts failed: {' | '.join(errors)}")


def get_llm_client() -> LLMClient:
    if not settings.GROQ_API_KEY:
        raise LLMServiceError("GROQ_API_KEY is not configured")
    return LLMClient(
        api_key=settings.GROQ_API_KEY,
        base_url=settings.GROQ_BASE_URL,
        primary_model=settings.GROQ_MODEL_PRIMARY,
        fallback_model=settings.GROQ_MODEL_FALLBACK,
        timeout_seconds=settings.GROQ_TIMEOUT_SECONDS,
    )
