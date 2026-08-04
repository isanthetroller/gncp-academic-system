<?php
require_once __DIR__ . '/../../shared/backend/config/database.php';
require_once __DIR__ . '/../../shared/backend/utils/student.php';
require_once __DIR__ . '/../../shared/backend/utils/response.php';

try {
    $pdo = Database::getInstance();
} catch (Exception $e) {
    sendResponse(false, null, 'Database connection failed: ' . $e->getMessage(), 500);
}

$action = $_GET['action'] ?? '';

if ($action === 'login_student') {
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

    $personalInfo = json_decode($student['personal_info'] ?? '{}', true) ?: [];
    $nameParts = explode(' ', trim($student['name'] ?? ''));
    $fallbackLastName = end($nameParts);
    $cleanLastName = strtolower(trim(preg_replace('/[^a-zA-Z0-9]/', '', $personalInfo['lastName'] ?? $fallbackLastName)));

    $inputPassClean = strtolower(trim(preg_replace('/[^a-zA-Z0-9]/', '', $password)));

    $isValid = password_verify($password, $student['password'])
        || ($password === $student['password'])
        || (!empty($cleanLastName) && $inputPassClean === $cleanLastName);

    if (!$isValid) {
        sendResponse(false, null, 'Invalid Student ID or password.');
    }

    sendResponse(true, [
        'id'       => $student['id'],
        'name'     => $student['name'],
        'program'  => $student['program'],
        'email'    => $student['email'],
        'photo'    => $student['photo']
    ]);

} elseif ($action === 'get_student_dashboard') {
    $studentId = $_GET['studentId'] ?? '';

    if (!$studentId) {
        sendResponse(false, null, 'Student ID is required.');
    }

    // Fetch core student profile
    $stmt = $pdo->prepare("SELECT * FROM `students` WHERE `id` = :id");
    $stmt->execute(['id' => $studentId]);
    $student = $stmt->fetch();

    if (!$student) {
        sendResponse(false, null, 'Student profile not found.', 404);
    }

    // Since completed pre-enrollments are transferred and deleted, load roadmap/clearance data directly from the permanent student record
    $roadmap      = json_decode($student['roadmap'], true) ?: [];
    $requirements = json_decode($student['requirements_data'], true) ?: null;
    $medical      = json_decode($student['medical_data'], true) ?: null;
    $scholarship  = json_decode($student['scholarship_data'], true) ?: null;
    $payment      = json_decode($student['payment_data'], true) ?: null;
    $helpdesk     = json_decode($student['helpdesk_data'], true) ?: null;
    $enrollment   = json_decode($student['enrollment_data'], true) ?: null;
    $personalInfo = json_decode($student['personal_info'], true) ?: null;

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

    // Resolve the active semester from academic_periods instead of hardcoding
    $semStmt = $pdo->query("SELECT `semester` FROM `academic_periods` WHERE `status` = 'Active' LIMIT 1");
    $activePeriod = $semStmt->fetch();
    $activeSemester = $activePeriod ? $activePeriod['semester'] : '1st Semester';

    // Fetch mapped prospectus subjects for the student's course, year level, and active semester
    $subjects = getCurriculumSubjects($pdo, $student['program'], $student['year_level'], $activeSemester);

    sendResponse(true, [
        'profile'      => [
            'id'          => $student['id'],
            'name'        => $student['name'],
            'program'     => $student['program'],
            'email'       => $student['email'],
            'photo'       => $student['photo'],
            'yearLevel'   => $student['year_level'],
            'status'      => $student['status'],
            'personalInfo'=> $personalInfo,   // phone, address, birthDate, gender, personal email
        ],
        'roadmap'      => $roadmap,
        'requirements' => $requirements,
        'medical'      => $medical,
        'scholarship'  => $scholarship,
        'payment'      => $payment,
        'helpdesk'     => $helpdesk,
        'enrollment'   => $enrollment,
        'subjects'     => $subjects
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

    // Also update pre_enrollments staging queue record if reference exists
    if (!empty($student['temp_reference_no'])) {
        $ref = $student['temp_reference_no'];
        $pPhone = $personalInfo['phone'] ?? null;
        $pEmail = $personalInfo['email'] ?? null;
        $pAddr  = $personalInfo['address'] ?? null;

        $peSets = [];
        $peParams = ['ref' => $ref];
        if ($pPhone !== null) { $peSets[] = "`phone` = :phone"; $peParams['phone'] = $pPhone; }
        if ($pEmail !== null) { $peSets[] = "`email` = :email"; $peParams['email'] = $pEmail; }
        if ($pAddr !== null)  { $peSets[] = "`address` = :addr"; $peParams['addr'] = $pAddr; }

        if (!empty($peSets)) {
            $sqlPe = "UPDATE `pre_enrollments` SET " . implode(', ', $peSets) . " WHERE `temp_student_id` = :ref";
            $pdo->prepare($sqlPe)->execute($peParams);
        }
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

} else {
    sendResponse(false, null, 'Invalid action specified.', 400);
}
