# InsightFlow implementation update

This update adds persistent chat history, an evidence-first full-report endpoint, a database connections workspace, Markdown answer rendering, report/chart rendering, and recovery when an agent reaches its tool-step limit after collecting evidence.

## Apply the update

1. Extract this ZIP into the existing `D:\Work\AI_analtytics_models` project directory and allow updated files to replace older versions. The archive intentionally does not include `.env` files, so keep your local `.env` and `frontend\.env` untouched.
2. In PowerShell, from the project root, apply the new conversation-history migration:

   ```powershell
   uv run alembic upgrade head
   ```

3. Start the backend:

   ```powershell
   uv run uvicorn ai_analtytics_models.main:app --reload
   ```

4. In a second PowerShell window, start the frontend:

   ```powershell
   cd D:\Work\AI_analtytics_models\frontend
   npm install
   npm run dev
   ```

## What changed

- Agent execution now streams graph state. If a tool-step limit is reached after evidence was collected, the backend attempts a separate evidence-only synthesis; if that fails, it returns a clear fallback instead of discarding the collected tool results.
- The CSV and Excel export routes now pass the generated stored filename to the dataset path helper.
- Full Reports runs deterministic profile, missing-value, correlation/category checks, and eligible time-series analysis before asking Groq to produce a structured report. A chart is included when the data supports one.
- Database Connections now supports saving, testing, browsing schema, previewing and profiling tables, asking questions in natural language, running read-only SQL, and exporting SQL results to CSV.
- Conversation history is stored per authenticated user, associated with a dataset or database connection, and supports reopening, renaming, and deleting chats.
- Alembic metadata now imports all model classes, including the new conversation model.

## Verification performed in the build workspace

- Python files passed `compileall` syntax checks.
- Frontend TSX and API files passed TypeScript transpilation syntax checks.
- Analytics-engine smoke checks passed for dataset summary, missing values, group-by, time-series analysis, and line-chart creation.
- A full frontend build and backend integration tests could not be run in the build workspace because package dependencies were not available from the configured npm/Python package sources. Run the project commands above in your existing environment and report any error output for the final integration pass.
