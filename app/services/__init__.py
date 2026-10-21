"""Service layer: everything that is not HTTP.

Modules
-------
config              paths, limits and provider/environment settings
db                  SQLite schema/connections for the accounts database
accounts            users, sessions, email tokens, per-user synced state
security            password hashing and token helpers (standard library)
mail                SMTP sending with a local-outbox development fallback
data                CSV loading, filtering and public serialization
text_extraction     PDF / DOCX / TXT / MD / ODT text extraction
ai_client           thin wrapper around the OpenAI-compatible provider
ai_analysis         resume scoring and feedback
resume_ai           resume generation
resume_render       resume HTML rendering
letters_ai          cover letters and application emails
chat_ai             career-assistant conversation handling
"""
