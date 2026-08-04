<?php
/**
 * Station Controller — Handles live queue board and workstation data sync directly with MySQL
 */
require_once __DIR__ . '/../models/StudentModel.php';
require_once __DIR__ . '/../../shared/backend/utils/student.php';

class StationController {
    private $studentModel;
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
        $this->studentModel = new StudentModel($pdo);
    }

    public function getQueue() {
        return [
            'success' => true,
            'data' => $this->studentModel->getQueue()
        ];
    }

    public function updateStudent($payload) {
        $refNo = $payload['referenceNumber'] ?? '';
        $updateData = $payload['updateData'] ?? [];

        if (!$refNo) {
            return ['success' => false, 'message' => 'Reference number missing.', 'code' => 400];
        }

        // Check if student was promoted / enrolled
        $curr = $this->studentModel->findByReferenceNumber($refNo);
        if (!$curr) {
            return ['success' => false, 'message' => 'Student record not found.', 'code' => 404];
        }

        // Handle IT Center promotion step if status is set to ENROLLED
        if (($updateData['status'] ?? '') === 'ENROLLED' && ($curr['status'] ?? '') !== 'ENROLLED') {
            $stmt = $this->pdo->prepare("SELECT * FROM `pre_enrollments` WHERE `temp_student_id` = :ref");
            $stmt->execute(['ref' => $refNo]);
            $record = $stmt->fetch();
            if ($record) {
                $promoResult = promotePreEnrollmentToStudent($this->pdo, $record, $refNo, json_encode($updateData['roadmap'] ?? $curr['roadmap']), $updateData['enrollment'] ?? []);
                return [
                    'success' => true,
                    'message' => 'Student promoted to enrolled profile successfully.',
                    'data'    => $promoResult
                ];
            }
        }

        $res = $this->studentModel->updatePreEnrollment($refNo, $updateData);
        if ($res) {
            return ['success' => true, 'message' => 'Student record updated successfully.', 'data' => $this->studentModel->findByReferenceNumber($refNo)];
        }
        return ['success' => false, 'message' => 'Failed to update student.', 'code' => 500];
    }
}
