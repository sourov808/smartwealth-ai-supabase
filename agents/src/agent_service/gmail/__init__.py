"""Everything the gmail agent owns: its agent, prompts, tool, and Gmail HTTP.

Follows the finance/ template, with one difference that defines the package: it
holds no database access and no write tool of any kind. This is the untrusted
side of the trust boundary — it reads mail that strangers wrote — so the absence
is the feature. See tools.py.
"""
