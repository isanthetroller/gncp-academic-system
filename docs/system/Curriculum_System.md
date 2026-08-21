---
title: Curriculum System Mechanics
date: 2026-08-21
tags:
  - curriculum/academic
  - curriculum/subjects
  - database/curriculum
---

# 📚 Curriculum System & Subject Mapping

> [!info]
> Linked to the master hub: [[SYSTEM_KNOWLEDGE_BASE|Master Knowledge Base]]

## Academic Hierarchy
$$\text{Department} \longrightarrow \text{Program} \longrightarrow \text{Curriculum} \longrightarrow \text{Academic Period} \longrightarrow \text{Year Level} \longrightarrow \text{Semester} \longrightarrow \text{Subject} \longrightarrow \text{Section}$$

* Handled in [[Database_Schema|Database Schema]] via `curriculum`, `subjects`, and `programs`.
* Dynamic subject resolution handled by `getCurriculumSubjects()` in `shared/backend/utils/student.php`.
* Price freeze occurs at [[Station_System|TLC Helpdesk Advising]] where an `assessmentSnapshot` is locked into the payment ledger.

## Related Notes
* [[Database_Schema|Database Schema & Entity Map]]
* [[Station_System|Station Processing (Advising)]]
* [[Business_Rules|Business Rules]]
* [[Dangerous_Areas|Dangerous Areas (Subject Joining)]]
