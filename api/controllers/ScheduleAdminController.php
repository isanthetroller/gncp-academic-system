<?php
/**
 * Schedule Admin Controller — Handles section scheduling and academic period terms management
 */
require_once __DIR__ . '/../models/SectionModel.php';

class ScheduleAdminController {
    private $sectionModel;

    public function __construct(PDO $pdo) {
        $this->sectionModel = new SectionModel($pdo);
    }

    public function getSections(): array {
        return ['success' => true, 'data' => $this->sectionModel->getAllSections()];
    }

    public function getTerms(): array {
        return ['success' => true, 'data' => $this->sectionModel->getAllTerms()];
    }

    public function saveSection(array $payload): array {
        return ['success' => true, 'data' => $this->sectionModel->saveSection($payload['section'] ?? [])];
    }

    public function saveTerm(array $payload): array {
        return ['success' => true, 'data' => $this->sectionModel->saveTerm($payload['term'] ?? [])];
    }
}
