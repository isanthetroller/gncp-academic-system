<?php
/**
 * Catalog Admin Controller — Handles academic programs, subjects, and curriculum catalog actions
 */
require_once __DIR__ . '/../models/CourseModel.php';

class CatalogAdminController {
    private $courseModel;

    public function __construct(PDO $pdo) {
        $this->courseModel = new CourseModel($pdo);
    }

    public function getCatalog(): array {
        return ['success' => true, 'data' => $this->courseModel->getFullCatalog()];
    }

    public function saveProgram(array $payload): array {
        $prog = $payload['program'] ?? [];
        $code = strtoupper(trim($prog['code'] ?? ''));
        $name = trim($prog['name'] ?? '');
        $dept = trim($prog['department'] ?? '');

        if (empty($code) || empty($name)) {
            return ['success' => false, 'message' => 'Program code and name are required.', 'code' => 400];
        }

        $prog['code'] = $code;
        $prog['name'] = $name;
        $prog['department'] = $dept;
        return ['success' => true, 'data' => $this->courseModel->saveProgram($prog)];
    }

    public function saveSubject(array $payload): array {
        $subj = $payload['subject'] ?? [];
        $code = strtoupper(trim($subj['code'] ?? ''));
        $title = trim($subj['title'] ?? '');
        $dept = trim($subj['department'] ?? '');
        $lec = max(0, (int)($subj['lectureUnits'] ?? 0));
        $lab = max(0, (int)($subj['labUnits'] ?? 0));

        if (empty($code) || empty($title)) {
            return ['success' => false, 'message' => 'Subject code and title are required.', 'code' => 400];
        }
        if (($lec + $lab) <= 0) {
            return ['success' => false, 'message' => 'Total units (lecture + lab) must be greater than zero.', 'code' => 400];
        }

        $subj['code'] = $code;
        $subj['title'] = $title;
        $subj['department'] = $dept;
        $subj['lectureUnits'] = $lec;
        $subj['labUnits'] = $lab;
        return ['success' => true, 'data' => $this->courseModel->saveSubject($subj)];
    }
}
