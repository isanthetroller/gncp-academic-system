<?php
/**
 * GNCP Workstations — Unified API Gateway Router
 * Handles SQL database reads and writes for all validation stations.
 */

require_once __DIR__ . '/../../shared/backend/config/database.php';
require_once __DIR__ . '/../../shared/backend/utils/response.php';
require_once __DIR__ . '/../../shared/backend/utils/student.php';

$action = $_GET['action'] ?? '';

try {
    $pdo = Database::getInstance();

    if ($action === 'fetch_queue') {
        // Get active semester period first to scope the sections
        $activeSem = '1st Semester';
        $activePeriodId = null;
        $activePeriodQuery = $pdo->query("SELECT `id`, `semester` FROM `academic_periods` WHERE `status` = 'Active' LIMIT 1");
        if ($activePeriodQuery) {
            $apRow = $activePeriodQuery->fetch(PDO::FETCH_ASSOC);
            if ($apRow) {
                $activeSem = $apRow['semester'];
                $activePeriodId = (int)$apRow['id'];
            }
        }

        // Fetch only approved/enrolled student records (exclude pre-registered or rejected)
        $stmt = $pdo->query("SELECT * FROM `pre_enrollments` WHERE `status` NOT IN ('PRE_REGISTERED', 'Rejected') ORDER BY `id` DESC");
        $rows = $stmt->fetchAll();

        // Fetch subject sections belonging to the active academic period to avoid mixing old schedules.
        // Use LEFT JOIN so subject_sections that aren't linked to a cohort block still appear.
        if ($activePeriodId !== null) {
            $sectionsStmt = $pdo->prepare("
                SELECT ss.*, 
                       COALESCE(s.program, ss.program) AS program, 
                       COALESCE(s.year_level, ss.year_level) AS year_level 
                FROM `subject_sections` ss 
                LEFT JOIN `sections` s ON ss.section_id = s.id 
                WHERE ss.semester = (SELECT semester FROM `academic_periods` WHERE id = :activePeriodId1 LIMIT 1)
                   OR s.academic_period_id = :activePeriodId2
            ");
            $sectionsStmt->execute([
                'activePeriodId1' => $activePeriodId,
                'activePeriodId2' => $activePeriodId
            ]);
            $sectionsRaw = $sectionsStmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            $sectionsRaw = [];
        }

        $queue = [];
        foreach ($rows as $row) {
            // Reconstruct full student name
            $nameParts = array_filter([$row['first_name'], $row['middle_name'], $row['last_name']]);
            $fullName = implode(' ', $nameParts);

            $medConditionsStr = $row['medical_conditions'] ?? '';
            $medConditionsArr = $medConditionsStr ? array_map('trim', explode(',', $medConditionsStr)) : [];

            // Get program full name from program code
            $progNameStmt = $pdo->prepare("SELECT `name` FROM `programs` WHERE `code` = :code");
            $progNameStmt->execute(['code' => $row['course_code']]);
            $programName = $progNameStmt->fetchColumn() ?: $row['course_code'];

            // Student year level (default to '1st Year' for pre-enrollment)
            $yearLevel = !empty($row['year_level_applied']) ? $row['year_level_applied'] : '1st Year';

            // Get prospectus subjects for this program, year, and semester
            $progSubjects = getCurriculumSubjects($pdo, $row['course_code'], $yearLevel, $activeSem);
            $subjectTitles = array_column($progSubjects, 'title');

            // Map available class sections matching these subjects, program, year level, and semester
            $matchingSections = [];
            foreach ($sectionsRaw as $sec) {
                if ($sec['capacity'] > 0 &&
                    in_array($sec['subject'], $subjectTitles) &&
                    (empty($sec['program']) || $sec['program'] === $programName) &&
                    (empty($sec['year_level']) || $sec['year_level'] === $yearLevel) &&
                    (empty($sec['semester']) || $sec['semester'] === $activeSem)) {
                    
                    $matchingSections[] = [
                        'id'         => (int)$sec['id'],
                        'subject'    => $sec['subject'],
                        'code'       => $sec['code'],
                        'instructor' => $sec['instructor'],
                        'days'       => $sec['days'],
                        'time'       => $sec['time'],
                        'room'       => $sec['room'],
                        'capacity'   => (int)$sec['capacity']
                    ];
                }
            }

            // Reconstruct the Unified JSON format matching Vue controllers
            $queue[] = [
                'id'                 => (int)$row['id'],
                'referenceNumber'    => $row['temp_student_id'],
                'tempPin'            => $row['temp_pin'],          // needed for COR print URL
                'lastName'           => $row['last_name'],
                'firstName'          => $row['first_name'],
                'middleName'         => $row['middle_name'] ?? '',
                'name'               => $fullName,
                'program'            => $row['course_code'],
                'studentType'        => $row['student_type'],
                'phone'              => $row['phone'],
                'email'              => $row['email'],
                'gender'             => $row['gender'],
                'address'            => $row['address'],
                'paymentMode'        => $row['payment_mode'] ?? 'Cash',
                'datePreRegistered'  => date('F j, Y', strtotime($row['created_at'])),
                'createdAt'          => $row['created_at'],
                'seniorHighSchool'   => $row['senior_high_school'] ?? '',
                'shsTrack'           => $row['shs_track'] ?? '',
                'orNumber'           => $row['or_number'] ?? null,
                'enrolledAt'         => $row['enrolled_at'] ?? null,
                'cashierName'        => $row['cashier_name'] ?? null,
                'form'               => [
                    'healthStatus'      => $row['health_status'] ?? 'GOOD',
                    'medicalConditions' => $medConditionsArr,
                    'allergies'         => $row['allergies'] ?? 'None',
                    'currentMedication' => (bool)($row['current_medication'] ?? false),
                    'medicationDetails' => $row['medication_details'] ?? ''
                ],
                
                // Decode JSON columns, fallback to empty arrays/objects if null
                'roadmap'            => json_decode((string)($row['roadmap'] ?? ''), true) ?: [],
                'requirements'       => json_decode((string)($row['requirements_data'] ?? ''), true) ?: new stdClass(),
                'medical'            => json_decode((string)($row['medical_data'] ?? ''), true) ?: new stdClass(),
                'scholarship'        => json_decode((string)($row['scholarship_data'] ?? ''), true) ?: new stdClass(),
                'payment'            => json_decode((string)($row['payment_data'] ?? ''), true) ?: new stdClass(),
                'helpdesk'           => array_merge(
                    ['scholarshipName' => $row['scholarship'] ?? 'NONE'],
                    json_decode((string)($row['helpdesk_data'] ?? ''), true) ?: []
                ),
                'enrollment'         => json_decode((string)($row['enrollment_data'] ?? ''), true) ?: new stdClass(),
                'prospectusSubjects' => $progSubjects,
                'availableSections'  => $matchingSections
            ];
        }

        sendResponse(true, $queue);

    } elseif ($action === 'update_student') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendResponse(false, null, 'Method not allowed. Use POST.', 405);
        }

        $rawInput = file_get_contents('php://input');
        $payload = json_decode($rawInput, true);

        if (!$payload || !isset($payload['referenceNumber'])) {
            sendResponse(false, null, 'Invalid payload or missing referenceNumber.', 400);
        }

        $refNo = $payload['referenceNumber'];
        $updateData = $payload['updateData'] ?? null;

        if (!$updateData) {
            sendResponse(false, null, 'No student update details provided.', 400);
        }

        // Fetch existing record first (selecting all columns)
        $checkExist = $pdo->prepare("SELECT * FROM `pre_enrollments` WHERE `temp_student_id` = :ref");
        $checkExist->execute(['ref' => $refNo]);
        $existingRecord = $checkExist->fetch();

        if (!$existingRecord) {
            // Check if the student was already promoted to the permanent students directory
            $checkStudent = $pdo->prepare("SELECT `status` FROM `students` WHERE `id` = :ref OR `temp_reference_no` = :ref");
            $checkStudent->execute(['ref' => $refNo]);
            $studentInfo = $checkStudent->fetch();
            
            if ($studentInfo) {
                sendResponse(true, ['status' => $studentInfo['status']], 'Student is already enrolled and promoted.');
            }
            sendResponse(false, null, "Student record not found for: $refNo", 404);
        }

        if (strcasecmp($existingRecord['status'], 'Rejected') === 0) {
            sendResponse(false, null, 'This application has been permanently rejected.', 403);
            exit;
        }

        // Check if all steps in the roadmap are completed or skipped
        $allDone = true;
        $roadmapSteps = $updateData['roadmap'] ?? json_decode($existingRecord['roadmap'], true) ?? [];
        if (empty($roadmapSteps)) {
            $allDone = false;
        } else {
            foreach ($roadmapSteps as $step) {
                $statusVal = $step['status'] ?? '';
                if ($statusVal !== 'COMPLETED' && $statusVal !== 'SKIPPED') {
                    $allDone = false;
                    break;
                }
            }
        }

        $incomingStatus = $updateData['status'] ?? null;
        $overallStatus = $existingRecord['status'];
        if ($incomingStatus === 'ENROLLED' || $incomingStatus === 'Approved' || $incomingStatus === 'APPROVED') {
            $overallStatus = $incomingStatus;
        }
        if ($allDone) {
            $overallStatus = 'ENROLLED';
        }

        $helpdeskData = $updateData['helpdesk'] ?? json_decode($existingRecord['helpdesk_data'] ?? '[]', true) ?? [];
        $scholarshipName = $helpdeskData['scholarshipName'] ?? 'NONE';

        $roadmapJson = isset($updateData['roadmap']) ? json_encode($updateData['roadmap']) : $existingRecord['roadmap'];
        $enrollmentJson = isset($updateData['enrollment']) ? json_encode($updateData['enrollment']) : $existingRecord['enrollment_data'];

        // Perform dynamic transactional update of only provided fields (preventing concurrent overrides)
        $sets = [];
        $params = ['ref' => $refNo];

        if (isset($updateData['roadmap'])) {
            $sets[] = "`roadmap` = :roadmap";
            $params['roadmap'] = $roadmapJson;
        }
        if (isset($updateData['requirements'])) {
            $sets[] = "`requirements_data` = :requirements_data";
            $params['requirements_data'] = json_encode($updateData['requirements']);
        }
        if (isset($updateData['medical'])) {
            $sets[] = "`medical_data` = :medical_data";
            $params['medical_data'] = json_encode($updateData['medical']);
        }
        if (isset($updateData['scholarship'])) {
            $sets[] = "`scholarship_data` = :scholarship_data";
            $params['scholarship_data'] = json_encode($updateData['scholarship']);
        }
        if (isset($updateData['payment'])) {
            $sets[] = "`payment_data` = :payment_data";
            $params['payment_data'] = json_encode($updateData['payment']);

            // Sync to permanent students table as well if student record exists
            try {
                $upStud = $pdo->prepare("UPDATE `students` SET `payment_data` = :payment_data WHERE `temp_reference_no` = :ref OR `id` = :ref");
                $upStud->execute([
                    'payment_data' => json_encode($updateData['payment']),
                    'ref' => $refNo
                ]);
            } catch (Exception $e) {
                // Ignore if student has not been promoted yet
            }
        }
        if (isset($updateData['helpdesk'])) {
            $sets[] = "`helpdesk_data` = :helpdesk_data";
            $params['helpdesk_data'] = json_encode($updateData['helpdesk']);
            
            $scholarshipName = $updateData['helpdesk']['scholarshipName'] ?? 'NONE';
            $sets[] = "`scholarship` = :scholarship";
            $params['scholarship'] = $scholarshipName;
        }
        if (isset($updateData['enrollment'])) {
            $sets[] = "`enrollment_data` = :enrollment_data";
            $params['enrollment_data'] = $enrollmentJson;
        }
        if (isset($updateData['section_code'])) {
            $sets[] = "`section_code` = :section_code";
            $params['section_code'] = $updateData['section_code'];
        }
        if (isset($updateData['status'])) {
            $sets[] = "`status` = :status";
            $params['status'] = $overallStatus;
        } elseif ($allDone) {
            $sets[] = "`status` = :status";
            $params['status'] = 'ENROLLED';
        }

        if (!empty($sets)) {
            $sql = "UPDATE `pre_enrollments` SET " . implode(', ', $sets) . " WHERE `temp_student_id` = :ref";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }

        // Automatically create or update a permanent student directory record upon IT Center activation
        $resData = ['referenceNumber' => $refNo, 'status' => $overallStatus];
        if ($overallStatus === 'ENROLLED') {
            $fetchStmt = $pdo->prepare("SELECT * FROM `pre_enrollments` WHERE `temp_student_id` = :ref");
            $fetchStmt->execute(['ref' => $refNo]);
            $appDetails = $fetchStmt->fetch();

            if ($appDetails) {
                $itData = json_decode($enrollmentJson, true) ?: [];
                $promoResult = promotePreEnrollmentToStudent($pdo, $appDetails, $refNo, $roadmapJson, $itData);

                // Prevent ghost capacity decrements if the student was already enrolled before this transaction
                $wasAlreadyEnrolled = ($existingRecord && $existingRecord['status'] === 'ENROLLED');

                if (!$wasAlreadyEnrolled) {
                    // Decrement capacity of assigned sections in subject_sections
                    $assignedSections = $itData['sections'] ?? [];
                    if (!empty($assignedSections) && is_array($assignedSections)) {
                        foreach ($assignedSections as $secCode) {
                            $upSecStmt = $pdo->prepare("UPDATE `subject_sections` SET `capacity` = GREATEST(0, `capacity` - 1) WHERE `code` = :code");
                            $upSecStmt->execute(['code' => $secCode]);
                        }
                    }
                }

                $resData['permanentId']        = $promoResult['permanentId'] ?? '';
                $resData['institutionalEmail'] = $promoResult['institutionalEmail'] ?? '';
                $resData['password']           = $promoResult['password'] ?? '';
            }
        }

        sendResponse(true, $resData, 'Student record updated successfully.');

    } elseif ($action === 'get_next_student_id') {
        $nextId = generateUniqueStudentId($pdo, '2026');
        sendResponse(true, ['nextStudentId' => $nextId]);

// ── IT CENTER: Upload and persist student portrait photo ─────────────────
    } elseif ($action === 'upload_photo') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendResponse(false, null, 'Method not allowed. Use POST.', 405);
        }

        $rawInput = file_get_contents('php://input');
        $payload  = json_decode($rawInput, true);

        $refNo       = trim($payload['referenceNumber'] ?? '');
        $base64Data  = $payload['photoData'] ?? '';
        $fileName    = preg_replace('/[^a-zA-Z0-9_\-.]/', '_', $payload['fileName'] ?? 'portrait.png');

        if (!$refNo || !$base64Data) {
            sendResponse(false, null, 'referenceNumber and photoData are required.', 400);
        }

        // Strip the base64 data URI prefix if present
        if (preg_match('/^data:image\/\w+;base64,/', $base64Data)) {
            $base64Data = preg_replace('/^data:image\/\w+;base64,/', '', $base64Data);
        }

        $imageData = base64_decode($base64Data);
        if ($imageData === false) {
            sendResponse(false, null, 'Invalid base64 image data.', 400);
        }

        // Save to /uploads/portraits/ relative to the stations root
        $uploadDir = __DIR__ . '/../../uploads/portraits/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Namespace file by reference number to prevent collisions
        $safeRef   = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $refNo);
        $finalName = 'portrait_' . $safeRef . '_' . time() . '.png';
        $filePath  = $uploadDir . $finalName;

        if (file_put_contents($filePath, $imageData) === false) {
            sendResponse(false, null, 'Failed to write portrait file to disk.', 500);
        }

        // Return the web-accessible relative path
        $webPath = '/systemforsia/uploads/portraits/' . $finalName;

        sendResponse(true, [
            'referenceNumber' => $refNo,
            'fileName'        => $finalName,
            'webPath'         => $webPath
        ]);

    // ── DASHBOARD: Enrollment statistics aggregate ────────────────────────────
    } elseif ($action === 'get_enrollment_stats') {
        // Count students per IT Center roadmap step status
        $stmt = $pdo->query(
            "SELECT
                SUM(JSON_UNQUOTE(JSON_EXTRACT(roadmap, '$[5].status')) != 'COMPLETED') AS pending_activation,
                SUM(JSON_UNQUOTE(JSON_EXTRACT(roadmap, '$[4].status')) = 'COMPLETED'
                    AND JSON_UNQUOTE(JSON_EXTRACT(roadmap, '$[5].status')) != 'COMPLETED') AS ready_for_it
            FROM `pre_enrollments`
            WHERE `status` NOT IN ('PRE_REGISTERED', 'Rejected')
            AND roadmap IS NOT NULL"
        );
        $stats = $stmt->fetch();

        // Count activations done today and total from the permanent students table
        $totalStmt = $pdo->query("SELECT COUNT(*) FROM `students`");
        $activatedTotal = (int)$totalStmt->fetchColumn();

        $todayStmt = $pdo->query(
            "SELECT COUNT(*) FROM `students`
             WHERE DATE(`created_at`) = '" . date('Y-m-d') . "'"
        );
        $activatedToday = (int)$todayStmt->fetchColumn();

        sendResponse(true, [
            'pendingActivation' => (int)($stats['pending_activation'] ?? 0),
            'activatedTotal'    => $activatedTotal,
            'readyForIt'        => (int)($stats['ready_for_it'] ?? 0),
            'activatedToday'    => $activatedToday
        ]);

    } elseif ($action === 'fetch_student_accounts') {
        $stmt = $pdo->query("SELECT `id`, `name`, `program`, `year_level`, `email`, `status`, `created_at` FROM `students` ORDER BY `name` ASC");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $students = [];
        foreach ($rows as $r) {
            $students[] = [
                'id'        => $r['id'],
                'name'      => $r['name'],
                'program'   => $r['program'],
                'yearLevel' => $r['year_level'],
                'year_level'=> $r['year_level'],
                'email'     => $r['email'] ?? '',
                'status'    => $r['status'],
                'createdAt' => $r['created_at'],
                'created_at'=> $r['created_at']
            ];
        }
        sendResponse(true, $students);

    } else {
        sendResponse(false, null, 'Invalid action specified.', 400);
    }

} catch (PDOException $e) {
    error_log("Database transaction failed in API router: " . $e->getMessage());
    sendResponse(false, null, "Database transaction error: " . $e->getMessage(), 500);
}
