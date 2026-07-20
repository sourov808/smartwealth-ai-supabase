"""The decorator every tool in this package is built with.

Two rules hold for every tool, and this is where they are enforced once.

1. `strict_mode=False` is MANDATORY. The SDK defaults to True, which breaks this
   design two ways, both verified against live Groq:
     - It forces optional arguments into the schema's `required` list, so the
       model invents values for filters the user never mentioned.
     - `Optional[SomeEnum]` becomes `anyOf: [Enum, null]`, which Groq rejects:
       "400 ... anyOf branches must be disambiguated via a required discriminator"

2. A failed tool call is data for the model, not a crash. `failure_error_function`
   hands the exception back as a tool result the model can act on — it can
   explain the problem or try another approach. Raising would 500 the request.

Separately, and not expressible here: every db call inside a tool must go through
`asyncio.to_thread`. supabase-py is synchronous, and calling it directly from an
async tool blocks the event loop.
"""

from agents import RunContextWrapper, function_tool


def tool_error(ctx: RunContextWrapper, error: Exception) -> str:
    return f"The tool failed: {type(error).__name__}: {error}"


tool = function_tool(strict_mode=False, failure_error_function=tool_error)
