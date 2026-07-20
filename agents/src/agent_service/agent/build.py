"""Assembles the Agent. Wiring only."""

from agents import Agent

from agent_service.agent.deps import AgentDeps
from agent_service.agent.model import create_model
from agent_service.agent.prompts import system_prompt
from agent_service.config import Settings
from agent_service.tools.finance import ALL_TOOLS
from agent_service.tools.memory import MEMORY_TOOLS


def build_agent(
    settings: Settings, today: str, memories: list[dict] | None = None
) -> Agent[AgentDeps]:
    return Agent[AgentDeps](
        name="finance-copilot",
        instructions=system_prompt(today=today, memories=memories),
        tools=ALL_TOOLS + MEMORY_TOOLS,
        model=create_model(settings),
    )
