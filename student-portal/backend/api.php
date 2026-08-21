<?php
require_once __DIR__ . '/../../shared/backend/utils/logger.php';
require_once __DIR__ . '/../../shared/backend/config/database.php';
require_once __DIR__ . '/../../shared/backend/utils/student.php';
require_once __DIR__ . '/../../shared/backend/utils/response.php';
require_once __DIR__ . '/../../shared/backend/services/EmailService.php';
require_once __DIR__ . '/../../shared/backend/services/AssessmentService.php';

function maskEmailAddress($email) {
    if (!$email || strpos($email, '@') === false) return '***@***.com';
    list($name, $domain) = explode('@', $email, 2);
    $len = strlen($name);
    if ($len <= 2) {
        $maskedName = substr($name, 0, 1) . '*';
    } else {
        $maskedName = substr($name, 0, 1) . str_repeat('*', min(5, $len - 2)) . substr($name, -1);
    }
    return $maskedName . '@' . $domain;
}

$reqId = getRequestId();
header('X-Request-ID: ' . $reqId);

try {
    $pdo = Database::getInstance();
} catch (Exception $e) {
    logAppError("Student Portal DB Connection Failed: " . $e->getMessage());
    sendResponse(false, null, 'Database connection failed: ' . $e->getMessage(), 500);
}

$action = $_GET['action'] ?? '';

if ($action === 'login' || $action === 'login_student') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        sendResponse(false, null, 'Method not allowed. Use POST.', 405);
    }

    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    $studentId = trim($payload['studentId'] ?? '');
    $password  = trim($payload['password'] ?? '');

    if (!$studentId || !$password) {
        sendResponse(false, null, 'Student ID and password are required.');
    }

    // Lookup in students directory
    $stmt = $pdo->prepare("SELECT * FROM `students` WHERE `id` = :id");
    $stmt->execute(['id' => $studentId]);
    $student = $stmt->fetch();

    if (!$student) {
        sendResponse(false, null, 'Invalid Student ID or password.');
    }

    // Secure password verification — bcrypt only
    $isValid = password_verify($password, $student['password']);

    // One-time legacy migration: if stored password is NOT a bcrypt hash, try direct match and rehash
    if (!$isValid && !empty($student['password']) && substr($student['password'], 0, 4) !== '$2y$') {
        if ($password === $student['password']) {
            $isValid = true;
            // Immediately rehash to bcrypt so this fallback is never needed again
            $rehashed = password_hash($password, PASSWORD_DEFAULT);
            $pdo->prepare("UPDATE `students` SET `password` = :pwd WHERE `id` = :id")
                ->execute(['pwd' => $rehashed, 'id' => $student['id']]);
        }
    }

    if (!$isValid) {
        sendResponse(false, null, 'Invalid Student ID or password.');
    }

    $mustChange = (bool)($student['must_change_password'] ?? false);

    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $_SESSION['gncp_student'] = [
        'id'                   => $student['id'],
        'name'                 => $student['name'],
        'email'                => $student['email'],
        'must_change_password' => $mustChange
    ];

    sendResponse(true, [
        'id'                   => $student['id'],
        'name'                 => $student['name'],
        'program'              => $student['program'],
        'email'                => $student['email'],
        'photo'                => $student['photo'],
        'must_change_password' => $mustChange
    ]);

} elseif ($action === 'get_student_dashboard') {
    $studentId = $_GET['studentId'] ?? '';

    if (!$studentId) {
        sendResponse(false, null, 'Student ID is required.');
    }

    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $studentSess = $_SESSION['gncp_student'] ?? null;
    $adminSess = $_SESSION['gncp_admin_user'] ?? null;
    $stationSess = $_SESSION['gncp_station_user'] ?? null;
    $sessStudentId = is_array($studentSess) ? ($studentSess['id'] ?? '') : '';

    if (!$adminSess && !$stationSess && (!$sessStudentId || strcasecmp($sessStudentId, $studentId) !== 0)) {
        sendResponse(false, null, 'Unauthorized access to student dashboard.', 401);
    }

    // Fetch core student profile
    $stmt = $pdo->prepare("SELECT * FROM `students` WHERE `id` = :id");
    $stmt->execute(['id' => $studentId]);
    $student = $stmt->fetch();

    if (!$student) {
        sendResponse(false, null, 'Student profile not found.', 404);
    }

    // Load roadmap/clearance data
    $roadmap      = json_decode($student['roadmap'] ?? '[]', true) ?: [];
    $requirements = json_decode($student['requirements_data'] ?? '{}', true) ?: null;
    $medical      = json_decode($student['medical_data'] ?? '{}', true) ?: null;
    $scholarship  = json_decode($student['scholarship_data'] ?? '{}', true) ?: null;
    $payment      = json_decode($student['payment_data'] ?? '{}', true) ?: null;
    $helpdesk     = json_decode($student['helpdesk_data'] ?? '{}', true) ?: null;
    $enrollment   = json_decode($student['enrollment_data'] ?? '{}', true) ?: null;
    $personalInfo = json_decode($student['personal_info'] ?? '{}', true) ?: [];

    // Dual-table fallback: If student directory JSON blobs are incomplete, fallback-merge from pre_enrollments staging queue
    $refLookup = !empty($student['temp_reference_no']) ? $student['temp_reference_no'] : $student['id'];
    $peStmt = $pdo->prepare("SELECT * FROM `pre_enrollments` WHERE `temp_student_id` = :r1 OR `existing_student_id` = :r2 LIMIT 1");
    $peStmt->execute(['r1' => $refLookup, 'r2' => $student['id']]);
    $preEnrollment = $peStmt->fetch();

    if ($preEnrollment) {
        if (empty($personalInfo['firstName']))             $personalInfo['firstName']             = $preEnrollment['first_name'] ?? '';
        if (empty($personalInfo['middleName']))            $personalInfo['middleName']            = $preEnrollment['middle_name'] ?? '';
        if (empty($personalInfo['lastName']))              $personalInfo['lastName']              = $preEnrollment['last_name'] ?? '';
        if (empty($personalInfo['phone']))                 $personalInfo['phone']                 = $preEnrollment['phone'] ?? '';
        if (empty($personalInfo['birthDate']))             $personalInfo['birthDate']             = $preEnrollment['birth_date'] ?? '';
        if (empty($personalInfo['gender']))                $personalInfo['gender']                = $preEnrollment['gender'] ?? '';
        if (empty($personalInfo['address']))               $personalInfo['address']               = $preEnrollment['address'] ?? '';
        if (empty($personalInfo['emergencyContactName']))  $personalInfo['emergencyContactName']  = $preEnrollment['emergency_contact_name'] ?? '';
        if (empty($personalInfo['emergencyContactPhone'])) $personalInfo['emergencyContactPhone'] = $preEnrollment['emergency_contact_phone'] ?? '';

        if (empty($helpdesk) && !empty($preEnrollment['helpdesk_data'])) {
            $helpdesk = json_decode($preEnrollment['helpdesk_data'], true) ?: null;
        }
        if (empty($payment) && !empty($preEnrollment['payment_data'])) {
            $payment = json_decode($preEnrollment['payment_data'], true) ?: null;
        }
        if (empty($medical) && !empty($preEnrollment['medical_data'])) {
            $medical = json_decode($preEnrollment['medical_data'], true) ?: null;
        }
        if (empty($requirements) && !empty($preEnrollment['requirements_data'])) {
            $requirements = json_decode($preEnrollment['requirements_data'], true) ?: null;
        }
        if (empty($scholarship) && !empty($preEnrollment['scholarship_data'])) {
            $scholarship = json_decode($preEnrollment['scholarship_data'], true) ?: null;
        }
        if (empty($roadmap) && !empty($preEnrollment['roadmap'])) {
            $roadmap = json_decode($preEnrollment['roadmap'], true) ?: [];
        }
    }

    // Parse name parts with robust fallback chain
    $nameParts = explode(' ', trim($student['name'] ?? ''));
    $lastName  = !empty($personalInfo['lastName']) ? $personalInfo['lastName'] : (!empty($preEnrollment['last_name']) ? $preEnrollment['last_name'] : (count($nameParts) > 1 ? end($nameParts) : $student['name']));
    $firstName = !empty($personalInfo['firstName']) ? $personalInfo['firstName'] : (!empty($preEnrollment['first_name']) ? $preEnrollment['first_name'] : (count($nameParts) > 1 ? implode(' ', array_slice($nameParts, 0, -1)) : $student['name']));
    $middleName= !empty($personalInfo['middleName']) ? $personalInfo['middleName'] : (!empty($preEnrollment['middle_name']) ? $preEnrollment['middle_name'] : '');

    // Auto-heal / synchronize roadmap step status with medical clearance record
    if ($medical && (!empty($medical['status']) && in_array(strtolower($medical['status']), ['fit', 'cleared', 'conditional']) || !empty($medical['verifiedBy']))) {
        foreach ($roadmap as &$step) {
            if (($step['stepId'] ?? '') === 'clinic_checkup') {
                $step['status'] = 'COMPLETED';
                if (!empty($medical['dateVerified'])) {
                    $step['updatedAt'] = $medical['dateVerified'];
                }
            }
        }
        unset($step);
    }

    // Active semester & academic year
    $semStmt = $pdo->query("SELECT `semester`, `academic_year` FROM `academic_periods` WHERE `status` = 'Active' LIMIT 1");
    $activePeriod = $semStmt ? $semStmt->fetch() : null;
    $activeSemester = $activePeriod ? $activePeriod['semester'] : '1st Semester';
    $academicYear   = $activePeriod ? $activePeriod['academic_year'] : '2026-2027';

    // Program name
    $progStmt = $pdo->prepare("SELECT name FROM `programs` WHERE code = :code");
    $progStmt->execute(['code' => $student['program']]);
    $progRow = $progStmt->fetch();
    $programName = $progRow ? $progRow['name'] : $student['program'];

    // Prospectus subjects with batch curriculum versioning
    $curriculumVersion = $student['curriculum_version'] ?? ($preEnrollment['curriculum_version'] ?? '2026 Revised Curriculum');
    $subjects = getCurriculumSubjects($pdo, $student['program'], $student['year_level'], $activeSemester, $curriculumVersion);

    // Build schedule & fee calculations for official COR form
    $advisedSubjects = !empty($helpdesk['advisedSubjects']) ? $helpdesk['advisedSubjects'] : $subjects;
    $schedule = [];
    $totalUnits = 0.00;
    $totalLabFee = 0.00;

    $studentSection = !empty($enrollment['assignedSection']) ? $enrollment['assignedSection'] 
                    : (!empty($helpdesk['section']) ? $helpdesk['section'] 
                    : (!empty($student['section_code']) ? $student['section_code'] 
                    : (!empty($preEnrollment['section_code']) ? $preEnrollment['section_code'] : '')));
    
    foreach ($advisedSubjects as $sub) {
        $subTitle = $sub['title'] ?? $sub['name'] ?? '';
        $subCode = $sub['code'] ?? '';

        $sectionRow = null;
        if (!empty($studentSection)) {
            $cleanSec = preg_replace('/^(BSCpE|BSCOE|BSIT|BSCS|BSBA|BSED)-[1-4][A-Z]-?/i', '', $studentSection);
            $secStmtSect = $pdo->prepare("
                SELECT * FROM `subject_sections` 
                WHERE (`code` LIKE :sect_pattern OR `code` LIKE :clean_pattern) AND (`subject` = :title OR `code` LIKE :code_pattern)
                LIMIT 1
            ");
            $secStmtSect->execute([
                'sect_pattern' => '%' . $studentSection . '%',
                'clean_pattern' => '%' . $cleanSec . '%',
                'title' => $subTitle,
                'code_pattern' => '%' . $subCode . '%'
            ]);
            $sectionRow = $secStmtSect ? $secStmtSect->fetch() : null;
        }
        if (!$sectionRow) {
            $secStmt = $pdo->prepare("
                SELECT * FROM `subject_sections` 
                WHERE (`subject` = :title OR `code` LIKE :code_pattern)
                LIMIT 1
            ");
            $secStmt->execute([
                'title' => $subTitle,
                'code_pattern' => '%' . $subCode . '%'
            ]);
            $sectionRow = $secStmt ? $secStmt->fetch() : null;
        }

        $lec = isset($sub['lecture_units']) ? (float)$sub['lecture_units'] : (isset($sub['lectureUnits']) ? (float)$sub['lectureUnits'] : 3.00);
        $lab = isset($sub['lab_units']) ? (float)$sub['lab_units'] : (isset($sub['labUnits']) ? (float)$sub['labUnits'] : 0.00);
        $units = $lec + $lab;
        $totalUnits += $units;
        $totalLabFee += isset($sub['lab_fee']) ? (float)$sub['lab_fee'] : (isset($sub['labFee']) ? (float)$sub['labFee'] : 0.00);

        $resolvedSection = !empty($studentSection) ? $studentSection : (!empty($sectionRow['code']) ? $sectionRow['code'] : 'TBA');

        if ($sectionRow) {
            $timeStr = $sectionRow['time'] ?? 'TBA';
            $startTime = ''; $endTime = '';
            if (strpos($timeStr, ' - ') !== false) {
                $timeParts = explode(' - ', $timeStr);
                $startTime = $timeParts[0];
                $endTime = $timeParts[1];
            } else {
                $startTime = $timeStr;
            }
            $schedule[] = [
                'code' => $subCode,
                'description' => $subTitle,
                'units' => number_format($units, 2),
                'type' => $lab > 0 ? 'Lec/Lab' : 'Lec',
                'days' => $sectionRow['days'] ?? 'MWF',
                'start' => $startTime ?: '08:00 AM',
                'end' => $endTime ?: '11:00 AM',
                'section' => $resolvedSection,
                'room' => $sectionRow['room'] ?? 'Lab 1',
                'instructor' => $sectionRow['instructor'] ?? 'Prof. Staff',
                's' => ''
            ];
        } else {
            $schedule[] = [
                'code' => $subCode,
                'description' => $subTitle,
                'units' => number_format($units, 2),
                'type' => $lab > 0 ? 'Lec/Lab' : 'Lec',
                'days' => 'TBA',
                'start' => 'TBA',
                'end' => 'TBA',
                'section' => $resolvedSection,
                'room' => 'TBA',
                'instructor' => 'TBA',
                's' => ''
            ];
        }
    }

    // Delegate fee calculation to authoritative AssessmentService
    $nstpType = strtoupper($preEnrollment['nstp'] ?? $student['nstp'] ?? 'NONE');
    $discount = (float)($scholarship['discount'] ?? 0.00);
    $snapshot = $enrollmentData['assessmentSnapshot'] ?? $payment['assessmentSnapshot'] ?? null;

    $assessment = AssessmentService::calculateAssessment($pdo, $advisedSubjects, $nstpType, $discount, $snapshot);

    $tuitionRate       = $assessment['tuitionRate'];
    $tuitionFee        = $assessment['tuitionFee'];
    $totalLabFee       = $assessment['totalLabFee'];
    $miscFee           = $assessment['miscFee'];
    $lmsFee            = $assessment['lmsFee'];
    $nstpFee           = $assessment['nstpFee'];
    $omrFee            = $assessment['omrFee'];
    $cashTotal         = $assessment['cashTotal'];
    $installmentCharge = $assessment['installmentCharge'];
    $installmentTotal  = $assessment['installmentTotal'];

    $orNumber = $payment['orNumber'] ?? $payment['or_number'] ?? $student['or_number'] ?? null;
    $encoder  = $payment['processedBy'] ?? $student['cashier_name'] ?? 'sbaltazar3';
    $paymentMode = $payment['paymentMode'] ?? $student['payment_mode'] ?? 'Full';

    $corData = [
        'studentNo'        => $student['id'],
        'tempReferenceNo'  => $student['temp_reference_no'] ?? $student['id'],
        'lastName'         => $lastName,
        'firstName'        => $firstName,
        'middleName'       => $middleName,
        'courseCode'       => $student['program'],
        'programName'      => $programName,
        'curriculumVersion'=> $curriculumVersion,
        'address'          => $personalInfo['address'] ?? '---',
        'phone'            => $personalInfo['phone'] ?? '---',
        'yearLevel'        => $student['year_level'] ?? '1st Year',
        'gender'           => $personalInfo['gender'] ?? '---',
        'semester'         => $activeSemester,
        'academicYear'     => $academicYear,
        'schedule'         => $schedule,
        'totalUnits'       => number_format($totalUnits, 2),
        'tuitionFee'       => $tuitionFee,
        'totalLabFee'      => $totalLabFee,
        'miscFee'          => $miscFee,
        'lmsFee'           => $lmsFee,
        'nstpFee'          => $nstpFee,
        'omrFee'           => $omrFee,
        'discount'         => $discount,
        'cashTotal'        => $cashTotal,
        'installmentCharge'=> $installmentCharge,
        'installmentTotal' => $installmentTotal,
        'paymentMode'      => $paymentMode,
        'orNumber'         => $orNumber,
        'encoder'          => $encoder,
        'createdAt'        => $student['created_at'] ?? date('Y-m-d H:i:s')
    ];

    sendResponse(true, [
        'profile'      => [
            'id'                  => $student['id'],
            'name'                => $student['name'],
            'program'             => $student['program'],
            'email'               => $student['email'],
            'photo'               => $student['photo'],
            'yearLevel'           => $student['year_level'],
            'status'              => $student['status'],
            'must_change_password'=> (bool)($student['must_change_password'] ?? false),
            'personalInfo'        => $personalInfo,
        ],
        'roadmap'      => $roadmap,
        'requirements' => $requirements,
        'medical'      => $medical,
        'scholarship'  => $scholarship,
        'payment'      => $payment,
        'helpdesk'     => $helpdesk,
        'enrollment'   => $enrollment,
        'subjects'     => $subjects,
        'corData'      => $corData,
        'activePeriod' => $activePeriod,
        'milestones'   => (function() use ($pdo, $activePeriod) {
            require_once __DIR__ . '/../../shared/backend/services/MilestoneService.php';
            $periodId = $activePeriod['id'] ?? null;
            $res = MilestoneService::getMilestones($pdo, $periodId ? ['academic_period_id' => $periodId] : []);
            if ($res['success'] && !empty($res['data'])) {
                return $res['data'];
            }
            // Fallback to all milestones if period specific is empty
            $allRes = MilestoneService::getMilestones($pdo);
            return $allRes['success'] ? $allRes['data'] : [];
        })()
    ]);



} elseif ($action === 'update_student_profile') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        sendResponse(false, null, 'Method not allowed. Use POST.', 405);
    }

    $rawInput = file_get_contents('php://input');
    $payload  = json_decode($rawInput, true);

    $studentId = trim($payload['studentId'] ?? '');
    if (!$studentId) {
        sendResponse(false, null, 'Student ID is required.', 400);
    }

    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $studentSess = $_SESSION['gncp_student'] ?? null;
    $adminSess = $_SESSION['gncp_admin_user'] ?? null;
    $stationSess = $_SESSION['gncp_station_user'] ?? null;
    $sessStudentId = is_array($studentSess) ? ($studentSess['id'] ?? '') : '';

    if (!$adminSess && !$stationSess && (!$sessStudentId || strcasecmp($sessStudentId, $studentId) !== 0)) {
        sendResponse(false, null, 'Unauthorized access to update student profile.', 401);
    }

    $stmt = $pdo->prepare("SELECT * FROM `students` WHERE `id` = :id");
    $stmt->execute(['id' => $studentId]);
    $student = $stmt->fetch();

    if (!$student) {
        sendResponse(false, null, 'Student record not found.', 404);
    }

    $personalInfo = json_decode($student['personal_info'] ?? '{}', true) ?: [];

    if (isset($payload['phone'])) {
        $personalInfo['phone'] = trim($payload['phone']);
    }
    if (isset($payload['personalEmail'])) {
        $personalInfo['email'] = trim($payload['personalEmail']);
    }
    if (isset($payload['address'])) {
        $personalInfo['address'] = trim($payload['address']);
    }
    if (isset($payload['emergencyContactName'])) {
        $personalInfo['emergencyContactName'] = trim($payload['emergencyContactName']);
    }
    if (isset($payload['emergencyContactPhone'])) {
        $personalInfo['emergencyContactPhone'] = trim($payload['emergencyContactPhone']);
    }

    $photoFile = $student['photo'];
    if (!empty($payload['photoData'])) {
        $base64Data = $payload['photoData'];
        $ext = 'png';
        if (preg_match('/^data:image\/(\w+);base64,/', $base64Data, $type)) {
            $base64Data = substr($base64Data, strpos($base64Data, ',') + 1);
            $rawExt = strtolower($type[1]);
            if (in_array($rawExt, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
                $ext = $rawExt;
            }
        }
        $imageData = base64_decode($base64Data);
        if ($imageData !== false) {
            $uploadDir1 = __DIR__ . '/../../stations/it-center/assets/uploads/';
            $uploadDir2 = __DIR__ . '/../../shared/assets/uploads/';
            if (!is_dir($uploadDir1)) @mkdir($uploadDir1, 0777, true);
            if (!is_dir($uploadDir2)) @mkdir($uploadDir2, 0777, true);
            $safeId = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $studentId);
            $filename = 'portrait_' . $safeId . '_' . time() . '.' . $ext;
            @file_put_contents($uploadDir1 . $filename, $imageData);
            @file_put_contents($uploadDir2 . $filename, $imageData);
            $photoFile = $filename;
        }
    }

    // Save updated info to students table
    $upd = $pdo->prepare("UPDATE `students` SET `personal_info` = :pinfo, `photo` = :photo WHERE `id` = :id");
    $upd->execute([
        'pinfo' => json_encode($personalInfo),
        'photo' => $photoFile,
        'id'    => $studentId
    ]);

    // Also update pre_enrollments staging queue record if reference exists or matching student ID
    $ref = $student['temp_reference_no'] ?? $studentId;
    $pPhone = $personalInfo['phone'] ?? null;
    $pEmail = $personalInfo['email'] ?? null;
    $pAddr  = $personalInfo['address'] ?? null;

    $peSets = [];
    $peParams = ['ref' => $ref, 'sid' => $studentId];
    if ($pPhone !== null) { $peSets[] = "`phone` = :phone"; $peParams['phone'] = $pPhone; }
    if ($pEmail !== null) { $peSets[] = "`email` = :email"; $peParams['email'] = $pEmail; }
    if ($pAddr !== null)  { $peSets[] = "`address` = :addr"; $peParams['addr'] = $pAddr; }

    if (!empty($peSets)) {
        $sqlPe = "UPDATE `pre_enrollments` SET " . implode(', ', $peSets) . " WHERE `temp_student_id` = :ref OR `existing_student_id` = :sid";
        $pdo->prepare($sqlPe)->execute($peParams);
    }

    sendResponse(true, [
        'id'           => $student['id'],
        'name'         => $student['name'],
        'program'      => $student['program'],
        'email'        => $student['email'],
        'photo'        => $photoFile,
        'yearLevel'    => $student['year_level'],
        'status'       => $student['status'],
        'personalInfo' => $personalInfo
    ], 'Profile updated successfully.');

} elseif ($action === 'change_student_password') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        sendResponse(false, null, 'Method not allowed. Use POST.', 405);
    }

    $rawInput = file_get_contents('php://input');
    $payload  = json_decode($rawInput, true);

    $studentId       = trim($payload['studentId'] ?? $payload['student_id'] ?? $payload['username'] ?? $payload['id'] ?? '');
    $currentPassword = trim($payload['currentPassword'] ?? $payload['current_password'] ?? '');
    $newPassword     = trim($payload['newPassword'] ?? $payload['new_password'] ?? '');

    if (!$studentId || !$currentPassword || !$newPassword) {
        sendResponse(false, null, 'Student ID, current password, and new password are required.', 400);
    }

    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $studentSess = $_SESSION['gncp_student'] ?? null;
    $adminSess = $_SESSION['gncp_admin_user'] ?? null;
    $stationSess = $_SESSION['gncp_station_user'] ?? null;
    $sessStudentId = is_array($studentSess) ? ($studentSess['id'] ?? '') : '';

    if (!$adminSess && !$stationSess && (!$sessStudentId || strcasecmp($sessStudentId, $studentId) !== 0)) {
        sendResponse(false, null, 'Unauthorized access to change password.', 401);
    }

    if (strlen($newPassword) < 6) {
        sendResponse(false, null, 'New password must be at least 6 characters.', 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM `students` WHERE `id` = :id");
    $stmt->execute(['id' => $studentId]);
    $student = $stmt->fetch();

    if (!$student) {
        sendResponse(false, null, 'Student record not found.', 404);
    }

    // Secure password verification — bcrypt only
    $isValid = password_verify($currentPassword, $student['password']);

    // One-time legacy migration fallback for unhashed passwords
    if (!$isValid && !empty($student['password']) && substr($student['password'], 0, 4) !== '$2y$') {
        if ($currentPassword === $student['password']) {
            $isValid = true;
        }
    }

    if (!$isValid) {
        sendResponse(false, null, 'Current password is incorrect.', 401);
    }

    $hashed = password_hash($newPassword, PASSWORD_DEFAULT);
    $pdo->prepare("UPDATE `students` SET `password` = :pwd, `must_change_password` = 0 WHERE `id` = :id")
        ->execute(['pwd' => $hashed, 'id' => $studentId]);

    if (isset($_SESSION['gncp_student'])) {
        $_SESSION['gncp_student']['must_change_password'] = false;
    }

    sendResponse(true, [
        'studentId'            => $studentId,
        'must_change_password' => false
    ], 'Password changed successfully.');

} elseif ($action === 'request_password_reset') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        sendResponse(false, null, 'Method not allowed. Use POST.', 405);
    }

    $rawInput = file_get_contents('php://input');
    $payload  = json_decode($rawInput, true);
    $identifier = trim($payload['identifier'] ?? '');

    if (!$identifier) {
        sendResponse(false, null, 'Student ID or Email address is required.', 400);
    }

    // 1. Search students table first
    $stmt = $pdo->prepare("
        SELECT * FROM `students` 
        WHERE `id` = :id 
           OR `email` = :email 
           OR `temp_reference_no` = :ref 
           OR JSON_UNQUOTE(JSON_EXTRACT(`personal_info`, '$.email')) = :pemail
        LIMIT 1
    ");
    $stmt->execute([
        'id'     => $identifier,
        'email'  => $identifier,
        'ref'    => $identifier,
        'pemail' => $identifier
    ]);
    $student = $stmt->fetch();

    $targetEmail = '';
    $studentName = '';
    $studentId   = '';

    if ($student) {
        $studentId   = $student['id'];
        $studentName = $student['name'];
        $pInfo       = json_decode($student['personal_info'] ?? '{}', true) ?: [];
        $personalEmail = !empty($pInfo['email']) ? trim($pInfo['email']) : '';
        $schoolEmail   = !empty($student['email']) ? trim($student['email']) : '';
        
        // If personal_info email is empty or institutional (@gncp.edu.ph), lookup original personal email from pre_enrollments
        if (empty($personalEmail) || str_contains(strtolower($personalEmail), '@gncp.edu.ph')) {
            $peQuery = $pdo->prepare("SELECT `email` FROM `pre_enrollments` WHERE `existing_student_id` = :sid OR `temp_student_id` = :ref LIMIT 1");
            $peQuery->execute(['sid' => $student['id'], 'ref' => $student['temp_reference_no'] ?? $student['id']]);
            $peRow = $peQuery->fetch(PDO::FETCH_ASSOC);
            if ($peRow && !empty($peRow['email'])) {
                $personalEmail = trim($peRow['email']);
            }
        }
        
        // If the user specifically entered their school email, send directly to school email
        if (strcasecmp($identifier, $schoolEmail) === 0 || str_ends_with(strtolower($identifier), '@gncp.edu.ph')) {
            $targetEmail = !empty($schoolEmail) ? $schoolEmail : (!empty($personalEmail) ? $personalEmail : '');
        } else {
            // Otherwise, default to personal email with fallback to school email
            $targetEmail = !empty($personalEmail) ? $personalEmail : (!empty($schoolEmail) ? $schoolEmail : '');
        }
    } else {
        // Fallback search in pre_enrollments staging table
        $peStmt = $pdo->prepare("
            SELECT * FROM `pre_enrollments` 
            WHERE `temp_student_id` = :ref 
               OR `email` = :email 
               OR `existing_student_id` = :sid 
            LIMIT 1
        ");
        $peStmt->execute(['ref' => $identifier, 'email' => $identifier, 'sid' => $identifier]);
        $pre = $peStmt->fetch();
        if ($pre) {
            $studentId   = $pre['temp_student_id'];
            $studentName = trim(($pre['first_name'] ?? '') . ' ' . ($pre['last_name'] ?? ''));
            $targetEmail = $pre['email'] ?? '';
        }
    }

    if (!$targetEmail) {
        sendResponse(false, null, 'No account found matching that Student ID or Email address.', 404);
    }

    // Ensure password_resets table exists
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `password_resets` (
            `id`         INT AUTO_INCREMENT PRIMARY KEY,
            `email`      VARCHAR(150) NOT NULL,
            `token`      VARCHAR(255) NOT NULL,
            `code`       VARCHAR(6) NOT NULL,
            `user_type`  VARCHAR(20) DEFAULT 'STUDENT',
            `expires_at` DATETIME NOT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_email` (`email`),
            INDEX `idx_code` (`code`)
        ) ENGINE=InnoDB;
    ");

    // Invalidate old active codes for this email
    $pdo->prepare("DELETE FROM `password_resets` WHERE `email` = :email")->execute(['email' => $targetEmail]);

    // Generate 6-digit OTP code & secure token
    $resetCode  = sprintf('%06d', rand(100000, 999999));
    $resetToken = bin2hex(random_bytes(16));

    $insStmt = $pdo->prepare("
        INSERT INTO `password_resets` (`email`, `token`, `code`, `user_type`, `expires_at`)
        VALUES (:email, :token, :code, 'STUDENT', DATE_ADD(NOW(), INTERVAL 30 MINUTE))
    ");
    $insStmt->execute([
        'email' => $targetEmail,
        'token' => password_hash($resetToken, PASSWORD_DEFAULT),
        'code'  => $resetCode
    ]);

    // Dispatch SMTP Email via EmailService
    $mailResult = EmailService::sendPasswordResetCode($targetEmail, $studentName ?: 'Student', $resetCode);

    if (!$mailResult['success']) {
        sendResponse(false, null, 'Failed to dispatch password reset email via SMTP: ' . ($mailResult['message'] ?? 'SMTP Error'), 500);
    }

    $masked = maskEmailAddress($targetEmail);

    sendResponse(true, [
        'maskedEmail' => $masked,
        'studentId'   => $studentId,
        'targetEmail' => $targetEmail
    ], "Password reset verification code has been sent to $masked. Please check your email inbox.");

} elseif ($action === 'reset_password_with_code') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        sendResponse(false, null, 'Method not allowed. Use POST.', 405);
    }

    $rawInput = file_get_contents('php://input');
    $payload  = json_decode($rawInput, true);

    $identifier  = trim($payload['identifier'] ?? '');
    $code        = trim($payload['code'] ?? '');
    $newPassword = trim($payload['newPassword'] ?? '');

    if (!$identifier || !$code || !$newPassword) {
        sendResponse(false, null, 'Student ID/Email, verification code, and new password are required.', 400);
    }

    if (strlen($newPassword) < 6) {
        sendResponse(false, null, 'New password must be at least 6 characters.', 400);
    }

    // Locate student first
    $stmt = $pdo->prepare("
        SELECT * FROM `students` 
        WHERE `id` = :id 
           OR `email` = :email 
           OR `temp_reference_no` = :ref 
           OR JSON_UNQUOTE(JSON_EXTRACT(`personal_info`, '$.email')) = :pemail
        LIMIT 1
    ");
    $stmt->execute([
        'id'     => $identifier,
        'email'  => $identifier,
        'ref'    => $identifier,
        'pemail' => $identifier
    ]);
    $student = $stmt->fetch();

    $emailsToCheck = [];
    if ($student) {
        if (!empty($student['email'])) $emailsToCheck[] = trim($student['email']);
        $pInfo = json_decode($student['personal_info'] ?? '{}', true) ?: [];
        if (!empty($pInfo['email'])) $emailsToCheck[] = trim($pInfo['email']);
        
        // Also check pre_enrollments email
        $peQuery = $pdo->prepare("SELECT `email` FROM `pre_enrollments` WHERE `existing_student_id` = :sid OR `temp_student_id` = :ref LIMIT 1");
        $peQuery->execute(['sid' => $student['id'], 'ref' => $student['temp_reference_no'] ?? $student['id']]);
        $peRow = $peQuery->fetch(PDO::FETCH_ASSOC);
        if ($peRow && !empty($peRow['email'])) {
            $emailsToCheck[] = trim($peRow['email']);
        }
    } else {
        $peStmt = $pdo->prepare("SELECT * FROM `pre_enrollments` WHERE `temp_student_id` = :ref OR `email` = :email LIMIT 1");
        $peStmt->execute(['ref' => $identifier, 'email' => $identifier]);
        $pre = $peStmt->fetch();
        if ($pre && !empty($pre['email'])) {
            $emailsToCheck[] = trim($pre['email']);
        }
    }

    $emailsToCheck = array_values(array_unique(array_filter($emailsToCheck)));

    if (empty($emailsToCheck)) {
        sendResponse(false, null, 'Student account record not found.', 404);
    }

    // Verify code in password_resets table where expires_at > NOW()
    $placeholders = implode(',', array_fill(0, count($emailsToCheck), '?'));
    $chkStmt = $pdo->prepare("
        SELECT * FROM `password_resets` 
        WHERE `email` IN ($placeholders) AND `code` = ? AND `expires_at` > NOW()
        ORDER BY `id` DESC LIMIT 1
    ");
    $params = array_merge($emailsToCheck, [$code]);
    $chkStmt->execute($params);
    $resetRow = $chkStmt->fetch();

    if (!$resetRow) {
        sendResponse(false, null, 'Invalid or expired 6-digit verification code. Please request a new code.', 400);
    }

    // Hash new password & update students table
    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);

    if ($student) {
        $upd = $pdo->prepare("UPDATE `students` SET `password` = :pwd, `must_change_password` = 0 WHERE `id` = :id");
        $upd->execute(['pwd' => $hashedPassword, 'id' => $student['id']]);
    }

    // Invalidate reset codes for this student's emails
    $delStmt = $pdo->prepare("DELETE FROM `password_resets` WHERE `email` IN ($placeholders)");
    $delStmt->execute($emailsToCheck);

    sendResponse(true, null, 'Password reset successfully! You can now log into your GNCP Student Portal with your new password.');

} elseif ($action === 'fetch_announcements') {
    require_once __DIR__ . '/../../shared/backend/services/AnnouncementService.php';
    $res = AnnouncementService::getAnnouncements($pdo, ['status' => 'PUBLISHED', 'target_audience' => 'STUDENTS']);
    sendResponse($res['success'], $res['data'] ?? [], $res['message'] ?? '');

} elseif ($action === 'fetch_milestones') {
    require_once __DIR__ . '/../../shared/backend/services/MilestoneService.php';
    $res = MilestoneService::getMilestones($pdo, $_GET);
    sendResponse($res['success'], $res['data'] ?? [], $res['message'] ?? '');

} elseif ($action === 'logout') {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params["path"] ?? '/',
            $params["domain"] ?? '',
            $params["secure"] ?? false,
            $params["httponly"] ?? true
        );
    }
    session_unset();
    session_destroy();
    sendResponse(true, null, 'Logged out successfully.');

} else {
    sendResponse(false, null, 'Invalid action specified.', 400);
}
