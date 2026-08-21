---
title: Student Lifecycle State Machine
date: 2026-08-21
tags:
  - workflow/state-machine
  - workflow/lifecycle
  - student/enrollment
---

# 🎓 Student Lifecycle & Workflow State Machine

> [!info]
> Linked to the master hub: [[SYSTEM_KNOWLEDGE_BASE|Master Knowledge Base]]

## 6-Stage Pipeline

```mermaid
stateDiagram-v2
    [*] --> PRE_REGISTERED: 1. Public Registration (enrollment-system/)
    PRE_REGISTERED --> VERIFIED: 2. Registrar Verification (registrar/)
    VERIFIED --> ADVISED: 3. TLC Helpdesk Advising (stations/tlc-helpdesk/)
    ADVISED --> MEDICAL_CLEARED: 4. Clinic Medical Exam (stations/medical-checkup/)
    MEDICAL_CLEARED --> PAID: 5. Cashier Payment (stations/payment-processing/)
    PAID --> ENROLLED: 6. IT Center Promotion (stations/it-center/)
    ENROLLED --> [*]: 7. Active Student Portal Access
```

* **Sequential Invariant**: Out-of-order execution is strictly blocked by `EnrollmentService.php` (see [[Business_Rules|RULE-001]]).
* **Cashier Invariant**: Unverified or rejected applicants cannot pay (see [[Business_Rules|RULE-002]]).
* **IT Promotion**: Transactionally moves staging records to permanent directory (see [[Database_Schema|Database Schema]]).

## Related Notes
* [[Station_System|Station Subsystems]]
* [[Business_Rules|System Business Rules]]
* [[Roles_and_Permissions|Roles and Authorizations]]
* [[Dangerous_Areas|Dangerous State Mutations]]
