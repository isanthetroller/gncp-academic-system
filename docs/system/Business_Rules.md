---
title: System Business Rules
date: 2026-08-21
tags:
  - rules/business
  - workflow/invariants
  - architecture/rules
---

# 📜 System Business Rules

> [!info]
> Linked to the master hub: [[SYSTEM_KNOWLEDGE_BASE|Master Knowledge Base]]

* **`RULE-001`**: An applicant cannot skip stations. Out-of-order completion throws a `DomainException` in `EnrollmentService`. See [[Student_Workflow|Workflow Pipeline]].
* **`RULE-002`**: Cashier payments cannot be accepted for applicants with status `PRE_REGISTERED` or `REJECTED`. Enforced in `PaymentService.php`.
* **`RULE-003`**: IT Center account promotion must execute inside an explicit `$pdo->beginTransaction()` and `$pdo->rollBack()` block. Detailed in [[Database_Schema|Database Schema]].
* **`RULE-004`**: Passwords must be hashed exclusively using PHP `password_hash($password, PASSWORD_DEFAULT)`. See [[Authentication|Authentication]].
* **`RULE-005`**: All staff accounts created via Admin must default `must_change_password = 1`.
* **`RULE-006`**: Active academic period windows strictly lock out new registrations when expired.
* **`RULE-007`**: Returning students already active in the current term cannot submit duplicate re-enrollment applications.
* **`RULE-008`**: Student password reset OTP codes expire in 30 minutes.
* **`RULE-009`**: All API operations must propagate `X-Request-ID` correlation headers.

## Related Notes
* [[Student_Workflow|Student Workflow State Machine]]
* [[Station_System|Station Invariants]]
* [[Dangerous_Areas|Dangerous Areas to Modify]]
