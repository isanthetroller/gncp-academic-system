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

    if (!password_verify($password, $student['password'])) {
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


} else {
    sendResponse(false, null, 'Invalid action specified.', 400);
}
