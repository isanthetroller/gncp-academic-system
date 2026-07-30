---
name: generate-technical-documentation
description: Generates a comprehensive technical documentation report for the entire system, covering frontend architecture, backend business logic, database schema, APIs, connectivity flows, system-wide dependencies, and an analysis guide.
---

# Comprehensive System Technical Documentation Generator

Use this skill when the user requests a complete, deep-dive technical documentation report of their entire application, or when they ask to map out how the frontend, backend, APIs, and database communicate and depend on each other.

---

## Instructions for the Agent

When this skill is triggered, you must perform a comprehensive, step-by-step codebase inspection and generate a detailed report addressing all the following sections. Do not make assumptions; base all findings strictly on the physical code, files, and database tables found in the workspace.

---

## Report Outline & Structure

Generate the output report as one or more detailed Markdown files in the artifacts directory. Organize the content into the following nine parts:

### Part 1 — Frontend Report
- **Overall Architecture:** Folder layout, Vue component hierarchy, page routing, shared UI layouts, and reusable components.
- **UI Flow:** For each page/kiosk, describe its purpose, user interactions, navigation, inputs/outputs, state properties, and dependent components.
- **Styling:** Shared CSS styling systems (variables, custom design tokens, typography, layouts).
- **Data Flow:** Map the data lifecycle for each page:
  `User Action → Component Event → Local State Update → API Service Request → Backend Response → Local State Sync → UI Rendering`.

### Part 2 — Backend Report
- **Overall Architecture:** Folder structures, class/method hierarchies, service interfaces, models, middleware, and backend helpers.
- **Detailed Module Mapping:** For every PHP class or router action block, document its:
  - Purpose & Responsibilities
  - Inputs & Outputs
  - Core Business Logic & Process Flow
  - Dependencies & External Helpers

### Part 3 — Frontend ↔ Backend Connectivity
- **Communication Flow:** For each system feature, document the complete request-response round-trip:
  `Page/Kiosk → Vue Event Handler → DataBus/Service Call → API HTTP Request → PHP Backend Route → Controller/Helper → Database Query → JSON Response Payload → Client Callback → Local UI State Update`.
- **API Communication Details:** Request/response payloads, field validations, HTTP status code usage, and local loading/error-state handling.

### Part 4 — Database Report
- **Schema Mapping:** Detail every SQL table in the schema with its purpose, columns, primary/foreign keys, unique constraints, and indexes.
- **Data Modeling & Flows:** Explain how data moves through the tables (e.g. queue state transitions, student creation/promotions).
- **APIs and Pages:** Detail which PHP backend actions perform writes/reads on each table, and which frontend views display this data.

### Part 5 — API Report
- **Endpoint Reference:** Grouped by backend module, list every API endpoint with:
  - HTTP Method & URL Route
  - Purpose & Authentication Requirements
  - Query parameters & Request Body schemas
  - Internal processing (controller file, helper utility, SQL statements)
  - Successful response body & error response payloads
  - Dependent frontend files

### Part 6 — System Workflow Report
- **End-to-End Walkthroughs:** For every core user path (e.g. registration, kiosk advising, cashier payment, enrollment finalization), provide a step-by-step timeline detailing user triggers, client storage synchronization, API updates, and SQL database transactions.

### Part 7 — System Dependency Report
- **Dependency Map:** Compile a detailed dependency analysis listing:
  - Critical file linkages (which files load or import others).
  - Shared assets and packages (e.g. shared JavaScript libraries, common utilities).
  - Single points of failure (e.g. missing databases, central routes).

### Part 8 — System-Wide Architecture Report
- **High-Level Systems Overview:** Summarize the architectural style of the system, including component interaction schemas, data flows, and security loops.

### Part 9 — Step-by-Step Analysis Guide
- **Codebase Onboarding Guide:** Provide a step-by-step roadmap for future developers or agentic AIs to review and understand this specific repository efficiently. Detail what files are involved and what depends on them for each step.
