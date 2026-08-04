<?php
/**
 * Student Controller — Handles public pre-registration, application tracking, and student lookup
 */
require_once __DIR__ . '/../models/StudentModel.php';

class StudentController {
    private $studentModel;

    public function __construct($pdo) {
        $this->studentModel = new StudentModel($pdo);
    }

    public function register($payload) {
        if (empty($payload['firstName']) || empty($payload['lastName']) || empty($payload['courseCode'])) {
            return ['success' => false, 'message' => 'First name, last name, and course choice are required.', 'code' => 400];
        }

        try {
            $res = $this->studentModel->createPreEnrollment($payload);
            return [
                'success' => true,
                'data' => $res,
                'message' => 'Application submitted successfully.'
            ];
        } catch (Exception $e) {
            logAppError("Student Registration Error: " . $e->getMessage(), ['payload' => $payload]);
            return ['success' => false, 'message' => 'We encountered an issue submitting your application. Please check your details or try again shortly.', 'code' => 500];
        }
    }

    public function track($refNo) {
        if (!$refNo) {
            return ['success' => false, 'message' => 'Reference number is required.', 'code' => 400];
        }

        $student = $this->studentModel->findByReferenceNumber($refNo);
        if (!$student) {
            return ['success' => false, 'message' => 'Application record not found.', 'code' => 404];
        }

        return [
            'success' => true,
            'data' => $student
        ];
    }
}
