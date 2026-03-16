"""Shared tool registry for agent execution."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Awaitable, Callable


ToolHandler = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


@dataclass(slots=True)
class ToolDefinition:
    name: str
    description: str
    input_schema: dict[str, str]
    handler: ToolHandler
    retryable: bool = False


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolDefinition] = {}

    def register(self, tool: ToolDefinition) -> None:
        self._tools[tool.name] = tool

    def list_tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema,
                "retryable": tool.retryable,
            }
            for tool in self._tools.values()
        ]

    def get(self, tool_name: str) -> ToolDefinition:
        if tool_name not in self._tools:
            raise KeyError(f"Tool not registered: {tool_name}")
        return self._tools[tool_name]

    async def invoke(self, tool_name: str, payload: dict[str, Any]) -> dict[str, Any]:
        tool = self.get(tool_name)
        return await tool.handler(payload)
