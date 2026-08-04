<?php
/**
 * Admin Controller — Handles administrative catalog, terms, scheduling, and user management
 */
require_once __DIR__ . '/../models/CourseModel.php';
require_once __DIR__ . '/../models/SectionModel.php';
require_once __DIR__ . '/../models/UserModel.php';
require_once __DIR__ . '/../../shared/backend/services/EmailService.php';

class AdminController {
    private $courseModel;
    private $sectionModel;
    private $userModel;

    public function __construct($pdo) {
        $this->courseModel = new CourseModel($pdo);
        $this->sectionModel = new SectionModel($pdo);
        $this->userModel = new UserModel($pdo);
    }

    public function getCatalog() {
        return ['success' => true, 'data' => $this->courseModel->getFullCatalog()];
    }

    public function getSections() {
        return ['success' => true, 'data' => $this->sectionModel->getAllSections()];
    }

    public function getTerms() {
        return ['success' => true, 'data' => $this->sectionModel->getAllTerms()];
    }

    public function getUsers() {
        return ['success' => true, 'data' => $this->userModel->getAllUsers()];
    }

    public function saveProgram($payload) {
        return ['success' => true, 'data' => $this->courseModel->saveProgram($payload['program'] ?? [])];
    }

    public function saveSubject($payload) {
        return ['success' => true, 'data' => $this->courseModel->saveSubject($payload['subject'] ?? [])];
    }

    public function saveSection($payload) {
        return ['success' => true, 'data' => $this->sectionModel->saveSection($payload['section'] ?? [])];
    }

    public function saveTerm($payload) {
        return ['success' => true, 'data' => $this->sectionModel->saveTerm($payload['term'] ?? [])];
    }

    public function saveUser($payload) {
        $userData = $payload['user'] ?? [];
        if (empty($userData['username']) || empty($userData['name']) || empty($userData['role'])) {
            return ['success' => false, 'message' => 'Username, name, and role are required.', 'code' => 400];
        }

        // Auto-generate temp password if not explicitly supplied
        $rawPassword = !empty($userData['password']) ? $userData['password'] : 'Gncp#' . rand(1000, 9999) . '!';
        $userData['password'] = $rawPassword;
        $userData['must_change_password'] = 1;

        try {
            $userId = $this->userModel->createUser($userData);
            
            // Dispatch credentials email via Gmail/SMTP EmailService
            $mailResult = ['success' => false, 'message' => 'No email provided.'];
            if (!empty($userData['email'])) {
                $mailResult = EmailService::sendUserCredentials(
                    $userData['email'],
                    $userData['name'],
                    $userData['username'],
                    $rawPassword,
                    $userData['role']
                );
            }

            return [
                'success' => true,
                'data' => [
                    'userId'               => $userId,
                    'username'             => $userData['username'],
                    'email'                => $userData['email'] ?? null,
                    'emailSent'            => $mailResult['success'],
                    'emailMessage'         => $mailResult['message'] ?? '',
                    'must_change_password' => true
                ],
                'message' => 'User account created successfully.'
            ];
        } catch (PDOException $e) {
            // Check for duplicate username key violation
            if ($e->getCode() === '23000') {
                return ['success' => false, 'message' => "An operator account with username '" . ($userData['username'] ?? '') . "' already exists. Please choose a unique username.", 'code' => 400];
            }
            logAppError("Admin SaveUser Error: " . $e->getMessage(), ['user' => $userData]);
            return ['success' => false, 'message' => 'Failed to create operator account. Please verify user details and try again.', 'code' => 500];
        }
    }

    public function cleanupTestUsers($payload) {
        $pattern = $payload['pattern'] ?? 'test_%_auto_%';
        $deleted = $this->userModel->deleteTestUsers($pattern);
        return ['success' => true, 'data' => ['deleted' => $deleted], 'message' => "Purged $deleted test user account(s)."];
    }
}
