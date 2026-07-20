"""The router's instructions. Its own file so router/ matches the shape of
finance/ and memory/ — the router is an agent too, just a tool-free one.
"""

# Inline rather than in a prompts module: the router injects nothing per-request,
# so there is no function to write, and this is the only place it is used.
#
# It asks for a bare word rather than using `output_type`. That was tried and
# fails on Groq roughly two calls in three with `400 json_validate_failed` and an
# empty `failed_generation` — see the module docstring.
#
# Keep this the shortest prompt in the service. Every token is paid on a call
# whose entire output is one word.
INSTRUCTIONS = """Route the user's message to exactly one handler.

- finance — spending, income, transactions, budgets, limits, currency
- memory — asking you to remember or forget a durable fact about them
- gmail — looking in their email for something
- notion — reading or writing their Notion pages

Recording a transaction is finance even when the user mentions email.
"Any payments in my inbox?" is gmail. "Add that Amazon charge from my email" is finance.

Reply with one word: finance, memory, gmail, or notion. Nothing else.
Pick finance when unsure."""
