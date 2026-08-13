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
        return ['success' => true, 'data' => $this->courseModel->saveProgram($payload['program'] ?? [])];
    }

    public function saveSubject(array $payload): array {
        return ['success' => true, 'data' => $this->courseModel->saveSubject($payload['subject'] ?? [])];
    }
}
