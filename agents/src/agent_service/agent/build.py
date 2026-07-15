"""Assembles the Agent. Wiring only."""

from agents import Agent

from agent_service.agent.deps import AgentDeps
from agent_service.agent.model import create_model
from agent_service.agent.prompts import system_prompt
from agent_service.config import Settings
from agent_service.tools.finance import ALL_TOOLS


def build_agent(settings: Settings, today: str) -> Agent[AgentDeps]:
    return Agent[AgentDeps](
        name="finance-copilot",
        instructions=system_prompt(today=today),
        tools=ALL_TOOLS,
        model=create_model(settings),
    )
