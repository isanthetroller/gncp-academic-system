<?php
/**
 * Station Controller — Handles live queue board and workstation data sync directly with MySQL
 */
require_once __DIR__ . '/../models/StudentModel.php';
require_once __DIR__ . '/../../shared/backend/utils/student.php';
require_once __DIR__ . '/../../stations/backend/services/EnrollmentService.php';

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

        if (!$refNo || empty($updateData)) {
            return ['success' => false, 'message' => 'Reference number or update details missing.', 'code' => 400];
        }

        try {
            $resData = EnrollmentService::updateStudent($this->pdo, $payload);
            return [
                'success' => true,
                'message' => 'Student record updated successfully.',
                'data'    => $resData
            ];
        } catch (InvalidArgumentException $e) {
            return ['success' => false, 'message' => $e->getMessage(), 'code' => 400];
        } catch (DomainException $e) {
            return ['success' => false, 'message' => $e->getMessage(), 'code' => 403];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage(), 'code' => 500];
        }
    }
}
