---
name: generate-reports-plan
description: Triggers a comprehensive over-engineering analysis of system modules, generating 2 reports (investigation & analyzation), an implementation plan, and a task list.
---

# Generate System Reports & Implementation Plan Workflow

Use this skill when the user asks to analyze the codebase for architectural design flaws, over-engineering, or system complexities, or when they explicitly request the "reports + plan + tasks" generation workflow.

## Steps to Execute:

### 1. Perform Codebase Research
- Inspect backend routing patterns (`shared/backend/login.php`, controller APIs).
- Analyze Vue app configurations and shared storage/logic bus modules (`DataBus.js`).
- Examine SQL schemas and table relationship files.
- Locate duplicate layout assets, redundant overlays, and empty pattern interfaces.

### 2. Compile Investigation Report
Create [investigation_report.md](file:///C:/Users/ethan/.gemini/antigravity-ide/brain/b2380764-493f-47db-a8af-d74fda7498e0/investigation_report.md) in the active conversation's brain directory to summarize:
- High-level overview of findings.
- System architectural conflicts.
- Summary of redundant modules/files.

### 3. Compile Deep-dive Analyzation Report
Create [analyzation_report.md](file:///C:/Users/ethan/.gemini/antigravity-ide/brain/b2380764-493f-47db-a8af-d74fda7498e0/analyzation_report.md) in the active conversation's brain directory to document:
- Exact file paths and line ranges containing redundant code.
- Detailed logic breakdowns (e.g. data flows, controller MVC abstractions, database serializations).
- Specific severity ratings (Low/Medium/High) for each identified item.

### 4. Create Technical Implementation Plan
Create [implementation_plan.md](file:///C:/Users/ethan/.gemini/antigravity-ide/brain/b2380764-493f-47db-a8af-d74fda7498e0/implementation_plan.md) mapping out:
- Specific file modifications, creations, and deletions.
- Simpler design alternatives that preserve existing functionality.
- Automated and manual verification methods.
- Set `request_feedback: true` and `user_facing: true` on the artifact metadata.

### 5. Create Task List
Create [task.md](file:///C:/Users/ethan/.gemini/antigravity-ide/brain/b2380764-493f-47db-a8af-d74fda7498e0/task.md) containing:
- Specific checkbox items grouped by file/component layers.
- Completion track progress indicators.
