<?php
/**
 * GNCP Registrar Portal — Central API Controller
 * Provides clean CRUD actions for courses, students, sections, and application reviews.
 */

require_once __DIR__ . '/../../shared/backend/config/database.php';
require_once __DIR__ . '/../../shared/backend/utils/response.php';
require_once __DIR__ . '/../../shared/backend/utils/student.php';

// Get the requested action (support both GET parameters and JSON inputs)
$action = $_GET['action'] ?? null;

// Parse JSON input body if it's a raw POST/PATCH request
$rawInput = file_get_contents('php://input');
$inputData = json_decode($rawInput, true);

if ($rawInput && json_last_error() !== JSON_ERROR_NONE) {
    sendResponse(false, null, 'Invalid JSON payload received.', 400);
}

if (!$action && isset($inputData['action'])) {
    $action = $inputData['action'];
}

if (!$action) {
    sendResponse(false, null, 'Action parameter is required.', 400);
}

try {
    $pdo = Database::getInstance();


    switch ($action) {
        
        // ─────────────────────────────────────────────────────────────
        // FETCH ALL DATA (INITIAL LOAD)
        // ─────────────────────────────────────────────────────────────
        case 'fetch_all_data':
            // 0. Auto-cleanup: Delete pre-enrollments older than 30 days that never completed
            try {
                $pdo->query("DELETE FROM `pre_enrollments` 
                             WHERE `status` != 'ENROLLED' 
                             AND `created_at` < NOW() - INTERVAL 30 DAY");
            } catch (Exception $ex) {
                // Silently ignore database lock/permission errors
            }

            // 1. Fetch courses (Redundant courses table removed; returns empty array for compatibility)
            $courses = [];

            // Fetch new entities
            $programs = $pdo->query("SELECT * FROM `programs` ORDER BY `id` DESC")->fetchAll();
            $subjectsRaw = $pdo->query("SELECT * FROM `subjects` ORDER BY `id` DESC")->fetchAll();
            $subjects = [];
            foreach ($subjectsRaw as $sub) {
                $subjects[] = [
                    'id' => (int)$sub['id'],
                    'code' => $sub['code'],
                    'title' => $sub['title'],
                    'description' => $sub['description'],
                    'lectureUnits' => (int)$sub['lecture_units'],
                    'labUnits' => (int)$sub['lab_units'],
                    'labFee' => (float)$sub['lab_fee'],
                    'department' => $sub['department'],
                    'prerequisites' => $sub['prerequisites']
                ];
            }
            $curriculumRaw = $pdo->query("SELECT c.*, s.code as subject_code, s.lecture_units, s.lab_units, s.lab_fee, s.prerequisites 
                                          FROM `curriculum` c
                                          LEFT JOIN `subjects` s ON c.subject = s.title
                                          ORDER BY c.id DESC")->fetchAll();
            $curriculum = [];
            foreach ($curriculumRaw as $cur) {
                $curriculum[] = [
                    'id' => (int)$cur['id'],
                    'program' => $cur['program'],
                    'subject' => $cur['subject'],
                    'subjectCode' => $cur['subject_code'] ?? '',
                    'lectureUnits' => (int)($cur['lecture_units'] ?? 0),
                    'labUnits' => (int)($cur['lab_units'] ?? 0),
                    'labFee' => (float)($cur['lab_fee'] ?? 0.00),
                    'prerequisites' => $cur['prerequisites'] ?? 'None',
                    'yearLevel' => $cur['year_level'],
                    'semester' => $cur['semester'],
                    'elective' => (bool)$cur['elective']
                ];
            }
            $academicPeriodsRaw = $pdo->query("SELECT * FROM `academic_periods` ORDER BY `id` DESC")->fetchAll();
            $academicPeriods = [];
            foreach ($academicPeriodsRaw as $ap) {
                $academicPeriods[] = [
                    'id' => (int)$ap['id'],
                    'name' => $ap['name'],
                    'academicYear' => $ap['academic_year'],
                    'semester' => $ap['semester'],
                    'enrollmentStart' => $ap['enrollment_start'],
                    'enrollmentEnd' => $ap['enrollment_end'],
                    'status' => $ap['status']
                ];
            }
            $subjectSectionsRaw = $pdo->query("SELECT * FROM `subject_sections` ORDER BY `id` DESC")->fetchAll();
            $subjectSections = [];
            foreach ($subjectSectionsRaw as $ss) {
                $subjectSections[] = [
                    'id' => (int)$ss['id'],
                    'program' => $ss['program'] ?? '',
                    'yearLevel' => $ss['year_level'] ?? '',
                    'semester' => $ss['semester'] ?? '',
                    'subject' => $ss['subject'],
                    'code' => $ss['code'],
                    'instructor' => $ss['instructor'],
                    'days' => $ss['days'],
                    'time' => $ss['time'],
                    'room' => $ss['room'],
                    'capacity' => (int)$ss['capacity']
                ];
            }
            $feeScheduleRaw = $pdo->query("SELECT * FROM `fee_schedule` ORDER BY `id` DESC")->fetchAll();
            $feeSchedule = [];
            foreach ($feeScheduleRaw as $fs) {
                $feeSchedule[] = [
                    'id' => (int)$fs['id'],
                    'type' => $fs['type'],
                    'label' => $fs['label'],
                    'amount' => (float)$fs['amount'],
                    'perUnit' => (bool)$fs['per_unit']
                ];
            }

            // 2. Fetch students with decoded JSON info
            $studentsRaw = $pdo->query("SELECT * FROM `students` ORDER BY `id` DESC")->fetchAll();
            $students = [];
            foreach ($studentsRaw as $s) {
                $students[] = [
                    'id'                => $s['id'],
                    'name'              => $s['name'],
                    'program'           => $s['program'],
                    'email'             => $s['email'],
                    'photo'             => $s['photo'],
                    'year_level'        => $s['year_level'],
                    'status'            => $s['status'],
                    'temp_reference_no' => $s['temp_reference_no'],
                    'personalInfo'      => json_decode((string)($s['personal_info'] ?? ''), true) ?: null,
                    'academicInfo'      => json_decode((string)($s['academic_info'] ?? ''), true) ?: null,
                    'roadmap'           => json_decode((string)($s['roadmap'] ?? ''), true) ?: [],
                    'requirementsData'  => json_decode((string)($s['requirements_data'] ?? ''), true) ?: null,
                    'medicalData'       => json_decode((string)($s['medical_data'] ?? ''), true) ?: null,
                    'scholarshipData'   => json_decode((string)($s['scholarship_data'] ?? ''), true) ?: null,
                    'paymentData'       => json_decode((string)($s['payment_data'] ?? ''), true) ?: null,
                    'helpdeskData'      => json_decode((string)($s['helpdesk_data'] ?? ''), true) ?: null
                ];
            }

            // 3. Fetch active block sections (cohort sections)
            $sectionsRaw = $pdo->query("
                SELECT s.* 
                FROM `sections` s
                JOIN `academic_periods` ap ON s.academic_period_id = ap.id
                WHERE ap.status = 'Active'
                ORDER BY s.code ASC
            ")->fetchAll();
            $sections = [];
            foreach ($sectionsRaw as $s) {
                $sections[] = [
                    'id' => (int)$s['id'],
                    'code' => $s['code'],
                    'program' => $s['program'],
                    'yearLevel' => $s['year_level'],
                    'capacity' => (int)$s['capacity'],
                    'adviser' => $s['adviser'] ?? 'Unassigned'
                ];
            }

            // Fallback to extracting cohorts from subject_sections if no sections are registered yet
            if (empty($sections)) {
                $cohortsRaw = $pdo->query("
                    SELECT DISTINCT program, year_level, SUBSTRING_INDEX(code, '-', -1) as cohort 
                    FROM `subject_sections`
                    ORDER BY program, year_level, cohort ASC
                ")->fetchAll();
                foreach ($cohortsRaw as $c) {
                    $sections[] = [
                        'id' => 0,
                        'code' => $c['cohort'],
                        'program' => $c['program'],
                        'yearLevel' => $c['year_level'],
                        'capacity' => 40,
                        'adviser' => 'Unassigned'
                    ];
                }
            }

            // 4. Fetch enrollments
            $enrollments = $pdo->query("SELECT * FROM `enrollments` ORDER BY `id` DESC")->fetchAll();

            // 5. Fetch pending applications from enrollment portal db (pre_enrollments table)
            $preEnrollments = $pdo->query("SELECT * FROM `pre_enrollments` ORDER BY `created_at` DESC")->fetchAll();
            
            $pendingApplications = [];
            foreach ($preEnrollments as $row) {
                // Map DB columns to UI expected object formats
                $fullName = trim($row['first_name'] . ' ' . ($row['middle_name'] ? $row['middle_name'] . ' ' : '') . $row['last_name']);
                
                // Track if application was reviewed today (either Approved or Rejected)
                // In a stateless backend, we check if modified today (simulated as reviewedToday for demo status)
                $isReviewedToday = in_array($row['status'], ['Approved', 'Rejected']);
                
                // Dynamic requirements mapping based on student type and pathway
                $studentType = $row['student_type'] ?? 'FRESHMAN';
                $shsTrack = $row['shs_track'] ?? '';
                $requirements = getRequirementsForType($studentType, $shsTrack);

                $requirementsData = json_decode((string)($row['requirements_data'] ?? ''), true) ?: [
                    'status' => 'PENDING',
                    'docs' => [
                        'psa' => 'not-submitted',
                        'reportCard' => 'not-submitted',
                        'goodMoral' => 'not-submitted'
                    ],
                    'notes' => '',
                    'verifiedBy' => '',
                    'dateVerified' => ''
                ];

                $pendingApplications[] = [
                    'referenceNumber' => $row['temp_student_id'],
                    'tempPin'         => $row['temp_pin'],
                    'applicantName'   => $fullName ?: 'New Applicant',
                    'program'         => $row['course_code'],
                    'yearLevel'       => $row['year_level_applied'] ?? '1st Year',
                    'studentType'     => $row['student_type'] ?? 'FRESHMAN',
                    'previousCollege' => $row['previous_college'] ?? null,
                    'nstp'            => $row['nstp'] ?? 'N/A',
                    'dateSubmitted'   => date('Y-m-d', strtotime($row['created_at'])),
                    'status'          => $row['status'],
                    'reviewedToday'   => $isReviewedToday,
                    'sectionCode'     => $row['section_code'] ?? null,
                    'personalInfo'    => [
                        'birthDate' => $row['birth_date'],
                        'gender'    => $row['gender'],
                        'address'   => $row['address']
                    ],
                    'contactInfo'     => [
                        'email'    => $row['email'],
                        'phone'    => $row['phone'],
                        'guardian' => $row['emergency_contact_name']
                    ],
                    'requirements'    => $requirements,
                    'requirementsData'=> $requirementsData,
                    'roadmap'         => json_decode((string)($row['roadmap'] ?? ''), true) ?: [],
                    'registrarNotes'  => $row['registrar_notes'] ?? ($row['roadmap'] ? 'Tracking steps established' : 'Awaiting review.')
                ];
            }

            sendResponse(true, [
                'courses'             => $courses,
                'students'            => $students,
                'sections'            => $sections,
                'enrollments'         => $enrollments,
                'pendingApplications' => $pendingApplications,
                'programs'            => $programs,
                'subjects'            => $subjects,
                'curriculum'          => $curriculum,
                'academicPeriods'     => $academicPeriods,
                'subjectSections'     => $subjectSections,
                'feeSchedule'         => $feeSchedule
            ]);
            break;


        // ─────────────────────────────────────────────────────────────
        // UPDATE APPLICATION STATUS
        // ─────────────────────────────────────────────────────────────
        case 'update_application_status':
            $refNum = $inputData['referenceNumber'] ?? null;
            $status = $inputData['status'] ?? null;
            $notes  = $inputData['registrarNotes'] ?? '';
            $reqData = $inputData['requirementsData'] ?? null;
            $sectionCode = $inputData['sectionCode'] ?? null;

            if (!$refNum || !$status) {
                sendResponse(false, null, 'Reference number and status are required.', 400);
            }

            // Fetch current record
            $stmt = $pdo->prepare("SELECT * FROM `pre_enrollments` WHERE `temp_student_id` = :ref");
            $stmt->execute(['ref' => $refNum]);
            $record = $stmt->fetch();

            if (!$record) {
                sendResponse(false, null, 'Pre-enrollment not found.', 404);
            }

            if (strcasecmp($record['status'], 'Rejected') === 0) {
                sendResponse(false, null, 'This application has been permanently rejected and status changes are prohibited.', 403);
                exit;
            }

            $roadmap = json_decode((string)($record['roadmap'] ?? ''), true) ?: [];

            // When Registrar Coordinator approves, set Step 1 (Registrar Verification) to COMPLETED,
            // and Step 2 (Academic Advising & NSTP Confirmation) to IN_PROGRESS.
            if (strcasecmp($status, 'Approved') === 0) {
                foreach ($roadmap as &$step) {
                    if ($step['stepId'] === 'registrar_verification') {
                        $step['status'] = 'COMPLETED';
                        $step['updatedAt'] = date('c');
                    }
                    if ($step['stepId'] === 'advising_assessment' && $step['status'] === 'PENDING') {
                        $step['status'] = 'IN_PROGRESS';
                        $step['updatedAt'] = date('c');
                    }
                }
            }

            $roadmapJson = json_encode($roadmap);

            // 1. Update application in pre_enrollments (including section_code)
            $stmt = $pdo->prepare("UPDATE `pre_enrollments` 
                                   SET `status` = :status, `roadmap` = :roadmap, `registrar_notes` = :notes, `requirements_data` = :req_data, `section_code` = :sect_code 
                                   WHERE `temp_student_id` = :ref");
            $stmt->execute([
                'status'  => $status,
                'roadmap' => $roadmapJson,
                'notes'   => $notes,
                'req_data'=> $reqData ? json_encode($reqData) : $record['requirements_data'],
                'sect_code'=> $sectionCode !== null ? $sectionCode : $record['section_code'],
                'ref'     => $refNum
            ]);

            // Fetch updated details to return consistent object
            $stmt = $pdo->prepare("SELECT * FROM `pre_enrollments` WHERE `temp_student_id` = :ref");
            $stmt->execute(['ref' => $refNum]);
            $updatedRow = $stmt->fetch();

            $fullName = trim($updatedRow['first_name'] . ' ' . ($updatedRow['middle_name'] ? $updatedRow['middle_name'] . ' ' : '') . $updatedRow['last_name']);
            $isReviewedToday = in_array($updatedRow['status'], ['Approved', 'Rejected']);
            
            // Dynamic requirements
            $studentType = $updatedRow['student_type'] ?? 'FRESHMAN';
            $requirements = getRequirementsForType($studentType, $updatedRow['shs_track'] ?? '');

            $updatedReqData = json_decode((string)($updatedRow['requirements_data'] ?? ''), true) ?: [
                'status' => 'PENDING',
                'docs' => [
                    'psa' => 'not-submitted',
                    'reportCard' => 'not-submitted',
                    'goodMoral' => 'not-submitted'
                ],
                'notes' => '',
                'verifiedBy' => '',
                'dateVerified' => ''
            ];

            sendResponse(true, [
                'referenceNumber' => $updatedRow['temp_student_id'],
                'applicantName'   => $fullName ?: 'New Applicant',
                'program'         => $updatedRow['course_code'],
                'studentType'     => $updatedRow['student_type'] ?? 'FRESHMAN',
                'nstp'            => $updatedRow['nstp'] ?? 'N/A',
                'dateSubmitted'   => date('Y-m-d', strtotime($updatedRow['created_at'])),
                'status'          => $updatedRow['status'],
                'reviewedToday'   => $isReviewedToday,
                'sectionCode'     => $updatedRow['section_code'],
                'personalInfo'    => [
                    'birthDate' => $updatedRow['birth_date'],
                    'gender'    => $updatedRow['gender'],
                    'address'   => $updatedRow['address']
                ],
                'contactInfo'     => [
                    'email'    => $updatedRow['email'],
                    'phone'    => $updatedRow['phone'],
                    'guardian' => $updatedRow['emergency_contact_name']
                ],
                'requirements'    => $requirements,
                'requirementsData'=> $updatedReqData,
                'roadmap'         => $roadmap,
                'registrarNotes'  => $updatedRow['registrar_notes'] ?? ($updatedRow['roadmap'] ? 'Tracking steps established' : 'Awaiting review.')
            ]);
            break;

        // ─────────────────────────────────────────────────────────────
        // UPDATE ROADMAP STEP
        // ─────────────────────────────────────────────────────────────
        case 'update_roadmap_step':
            $refNum = $inputData['referenceNumber'] ?? null;
            $stepId = $inputData['stepId'] ?? null;
            $status = $inputData['status'] ?? null;

            if (!$refNum || !$stepId || !$status) {
                sendResponse(false, null, 'Reference number, step ID, and status are required.', 400);
            }

            // Fetch current record
            $stmt = $pdo->prepare("SELECT * FROM `pre_enrollments` WHERE `temp_student_id` = :ref");
            $stmt->execute(['ref' => $refNum]);
            $record = $stmt->fetch();

            if (!$record) {
                sendResponse(false, null, 'Pre-enrollment not found.', 404);
            }

            if (strcasecmp($record['status'], 'Rejected') === 0) {
                sendResponse(false, null, 'This application has been permanently rejected and status changes are prohibited.', 403);
                exit;
            }

            $roadmap = json_decode((string)($record['roadmap'] ?? ''), true) ?: [];

            // Update step status
            $allDone = true;
            foreach ($roadmap as &$step) {
                if ($step['stepId'] === $stepId) {
                    $step['status'] = $status;
                    $step['updatedAt'] = date('c');
                }
                if ($step['status'] !== 'COMPLETED' && $step['status'] !== 'SKIPPED') {
                    $allDone = false;
                }
            }

            $roadmapJson = json_encode($roadmap);
            $dbStatus = $record['status'];
            $shouldDeletePreEnrollment = false;

            // If all roadmap steps are completed or skipped, overall status is ENROLLED
            if ($allDone && $dbStatus !== 'ENROLLED') {
                $dbStatus = 'ENROLLED';

                // Automatically create a student account profile!
                $responseDetails = promotePreEnrollmentToStudent($pdo, $record, $refNum, $roadmapJson);
                sendResponse(true, $responseDetails, 'Roadmap step updated and student enrollment finalized.');
            }

            $updateStmt = $pdo->prepare("UPDATE `pre_enrollments` 
                                         SET `roadmap` = :roadmap, `status` = :status 
                                         WHERE `temp_student_id` = :ref");
            $updateStmt->execute([
                'roadmap' => $roadmapJson,
                'status'  => $dbStatus,
                'ref'     => $refNum
            ]);

            // Fetch and return the updated application details
            $stmt = $pdo->prepare("SELECT * FROM `pre_enrollments` WHERE `temp_student_id` = :ref");
            $stmt->execute(['ref' => $refNum]);
            $updatedRow = $stmt->fetch();

            $fullName = trim($updatedRow['first_name'] . ' ' . ($updatedRow['middle_name'] ? $updatedRow['middle_name'] . ' ' : '') . $updatedRow['last_name']);
            $isReviewedToday = in_array($updatedRow['status'], ['Approved', 'Rejected']);
            
            // Dynamic requirements
            $studentType = $updatedRow['student_type'] ?? 'FRESHMAN';
            $requirements = getRequirementsForType($studentType, $updatedRow['shs_track'] ?? '');

            sendResponse(true, [
                'referenceNumber' => $updatedRow['temp_student_id'],
                'applicantName'   => $fullName ?: 'New Applicant',
                'program'         => $updatedRow['course_code'],
                'studentType'     => $updatedRow['student_type'] ?? 'FRESHMAN',
                'nstp'            => $updatedRow['nstp'] ?? 'N/A',
                'dateSubmitted'   => date('Y-m-d', strtotime($updatedRow['created_at'])),
                'status'          => $updatedRow['status'],
                'reviewedToday'   => $isReviewedToday,
                'personalInfo'    => [
                    'birthDate' => $updatedRow['birth_date'],
                    'gender'    => $updatedRow['gender'],
                    'address'   => $updatedRow['address']
                ],
                'contactInfo'     => [
                    'email'    => $updatedRow['email'],
                    'phone'    => $updatedRow['phone'],
                    'guardian' => $updatedRow['emergency_contact_name']
                ],
                'requirements'    => $requirements,
                'roadmap'         => $roadmap,
                'registrarNotes'  => $updatedRow['registrar_notes'] ?? ($updatedRow['roadmap'] ? 'Tracking steps established' : 'Awaiting review.')
            ]);
            break;

        // ─────────────────────────────────────────────────────────────
        // DELEGATE ADMIN SUBMODULES
        // ─────────────────────────────────────────────────────────────
        case 'save_program':
        case 'delete_program':
        case 'save_subject':
        case 'delete_subject':
        case 'save_curriculum':
        case 'delete_curriculum':
        case 'save_academic_period':
        case 'delete_academic_period':
        case 'clone_previous_term':
        case 'save_section':
        case 'delete_section':
        case 'save_subject_section':
        case 'delete_subject_section':
        case 'bulk_generate_sections':
        case 'save_fee':
        case 'delete_fee':
            $submodules = [
                __DIR__ . '/../../admin/backend/catalog/catalog.php',
                __DIR__ . '/../../admin/backend/term/term.php',
                __DIR__ . '/../../admin/backend/scheduling/scheduling.php'
            ];
            foreach ($submodules as $sub) {
                if (file_exists($sub)) {
                    include $sub;
                }
            }
            break;

        case 'get_sections_for_program':
            $prog = $_GET['program'] ?? '';
            $year = $_GET['year_level'] ?? '1st Year';
            $sem  = $_GET['semester']   ?? '1st Semester';

            if (!$prog) {
                sendResponse(false, null, 'Program code is required.', 400);
            }

            // Map program code (e.g. BSIT) to full name stored in sections table
            $stmt = $pdo->prepare("SELECT `name` FROM `programs` WHERE `code` = :code");
            $stmt->execute(['code' => $prog]);
            $progName = $stmt->fetchColumn() ?: $prog;

            // Fetch cohort sections WITH real-time enrolled count (both approved queue applicants and finalized student profiles)
            $stmt = $pdo->prepare("
                SELECT s.*,
                       ap.semester,
                       ap.academic_year AS school_year,
                       (
                           COALESCE(
                               (SELECT COUNT(*) FROM `pre_enrollments` pe
                                WHERE pe.section_code = s.code
                                  AND pe.course_code   = :prog_code
                                  AND pe.status NOT IN ('Rejected','PRE_REGISTERED')),
                               0
                           ) + COALESCE(
                               (SELECT COUNT(*) FROM `students` st
                                WHERE (st.enrollment_data LIKE CONCAT('%\"assignedSection\":\"', s.code, '\"%')
                                       OR JSON_UNQUOTE(JSON_EXTRACT(st.enrollment_data, '$.assignedSection')) = s.code)
                                  AND st.program = :progName),
                               0
                           )
                       ) AS enrolled_count
                FROM `sections` s
                JOIN `academic_periods` ap ON s.academic_period_id = ap.id
                WHERE s.program    = :prog
                  AND s.year_level = :year
                  AND ap.status    = 'Active'
                ORDER BY s.code ASC
            ");
            $stmt->execute([
                'prog'      => $progName,
                'progName'  => $progName,
                'year'      => $year,
                'prog_code' => $prog
            ]);
            $sections = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Fallback: extract unique section suffixes from subject_sections if no cohort rows exist yet
            if (empty($sections)) {
                $subStmt = $pdo->prepare("
                    SELECT DISTINCT TRIM(SUBSTRING_INDEX(code, '-', -1)) AS cohort
                    FROM `subject_sections`
                    WHERE `program`    = :prog
                      AND `year_level` = :year
                      AND `semester`   = :sem
                    ORDER BY cohort ASC
                ");
                $subStmt->execute(['prog' => $progName, 'year' => $year, 'sem' => $sem]);
                $cohorts = $subStmt->fetchAll(PDO::FETCH_COLUMN);

                $sections = [];
                foreach ($cohorts as $c) {
                    $stmtCount = $pdo->prepare("
                        SELECT 
                            (SELECT COUNT(*) FROM `pre_enrollments` 
                             WHERE `section_code` = :c1 
                               AND `course_code` = :prog1 
                               AND `status` NOT IN ('Rejected','PRE_REGISTERED'))
                            +
                            (SELECT COUNT(*) FROM `students` 
                             WHERE (`enrollment_data` LIKE :c_like
                                    OR JSON_UNQUOTE(JSON_EXTRACT(`enrollment_data`, '$.assignedSection')) = :c2)
                               AND `program` = :progName)
                    ");
                    $stmtCount->execute([
                        'c1'        => $c,
                        'prog1'     => $prog,
                        'c_like'    => '%"assignedSection":"' . $c . '"%',
                        'c2'        => $c,
                        'progName'  => $progName
                    ]);
                    $enrolledFallback = (int)$stmtCount->fetchColumn();

                    $sections[] = [
                        'id'                 => 0,
                        'code'               => $c,
                        'program'            => $progName,
                        'year_level'         => $year,
                        'capacity'           => 40,
                        'adviser'            => 'Unassigned',
                        'curriculum_version' => '—',
                        'semester'           => $sem,
                        'school_year'        => '—',
                        'enrolled_count'     => $enrolledFallback
                    ];
                }
            }

            $formatted = [];
            foreach ($sections as $s) {
                $enrolled  = (int)($s['enrolled_count'] ?? 0);
                $capacity  = (int)($s['capacity'] ?? 40);
                $slots     = max(0, $capacity - $enrolled);
                $pct       = $capacity > 0 ? round(($enrolled / $capacity) * 100) : 0;

                $formatted[] = [
                    'id'                => (int)($s['id'] ?? 0),
                    'program'           => $s['program'] ?? $progName,
                    'yearLevel'         => $s['year_level'] ?? $year,
                    'code'              => $s['code'],
                    'sectionName'       => ($s['program'] ?? $progName) . ' — Section ' . $s['code'],
                    'capacity'          => $capacity,
                    'enrolledCount'     => $enrolled,
                    'availableSlots'    => $slots,
                    'occupancyPct'      => $pct,
                    'adviser'           => $s['adviser'] ?? 'Unassigned',
                    'curriculumVersion' => $s['curriculum_version'] ?? '—',
                    'semester'          => $s['semester'] ?? $sem,
                    'schoolYear'        => $s['school_year'] ?? '—'
                ];
            }
            sendResponse(true, $formatted);
            break;


        default:
            sendResponse(false, null, 'Unknown action.', 400);
            break;
    }

} catch (PDOException $e) {
    error_log("Registrar API failed: " . $e->getMessage());
    sendResponse(false, null, 'Database operation error occurred.', 500);
}
