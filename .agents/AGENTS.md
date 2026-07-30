# Project Rules & Guidelines

## Holistic Multi-File Tracing
Whenever addressing a bug, feature update, or UI change:
- **Never fix in isolation**: Do NOT only inspect the immediate file where the issue was reported.
- **Trace the full dependency tree**: Always inspect every connected file across the entire end-to-end stack (frontend HTML templates, JS controllers, shared utilities/DataBus, CSS stylesheets, and backend PHP/API endpoints).
- **Run automated checks across all related modules**: Ensure all related files pass syntax, linting, and structural validation before concluding a task.
