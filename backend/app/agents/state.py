"""Agent state definition for the LangGraph workflow."""
from typing import Annotated, Any

from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage
from typing_extensions import TypedDict


class AgentState(TypedDict):
    """Shared state across all agent nodes."""
    # Core conversation
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: int
    user_input: str

    # Router output
    intent: str  # log_meal / query_nutrition / ask_knowledge / recommend_recipe / general_chat

    # Food parsing
    parsed_foods: list[dict]

    # SQL agent results
    query_results: list[dict]

    # Nutrition analysis
    nutrition_analysis: str

    # RAG context
    rag_context: str

    # Recipe suggestions
    recipe_suggestions: list[dict]

    # User context
    user_profile: dict
    daily_summary: dict

    # Final output
    final_response: str
