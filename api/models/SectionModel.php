<?php
/**
 * Section Model — Handles sections, subject_sections, academic_terms
 */
class SectionModel {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function getAllSections() {
        $stmt = $this->pdo->query("SELECT * FROM `sections` ORDER BY `id` DESC");
        return $stmt->fetchAll();
    }

    public function getActiveTerm() {
        $stmt = $this->pdo->query("SELECT * FROM `academic_terms` WHERE `is_active` = 1 LIMIT 1");
        return $stmt->fetch();
    }

    public function getAllTerms() {
        $stmt = $this->pdo->query("SELECT * FROM `academic_terms` ORDER BY `id` DESC");
        return $stmt->fetchAll();
    }

    public function saveSection($sec) {
        if (!empty($sec['id'])) {
            $stmt = $this->pdo->prepare("UPDATE `sections` SET `name`=:name, `code`=:code, `program`=:prog, `year_level`=:yl, `capacity`=:cap, `status`=:status WHERE `id`=:id");
            $stmt->execute([
                'name'   => $sec['name'],
                'code'   => $sec['code'],
                'prog'   => $sec['program'],
                'yl'     => $sec['yearLevel'] ?? '1st Year',
                'cap'    => (int)($sec['capacity'] ?? 40),
                'status' => $sec['status'] ?? 'Open',
                'id'     => (int)$sec['id']
            ]);
        } else {
            $stmt = $this->pdo->prepare("INSERT INTO `sections` (`name`, `code`, `program`, `year_level`, `capacity`, `enrolled_count`, `status`) VALUES (:name, :code, :prog, :yl, :cap, 0, :status)");
            $stmt->execute([
                'name'   => $sec['name'],
                'code'   => $sec['code'],
                'prog'   => $sec['program'],
                'yl'     => $sec['yearLevel'] ?? '1st Year',
                'cap'    => (int)($sec['capacity'] ?? 40),
                'status' => $sec['status'] ?? 'Open'
            ]);
        }
        return $this->getAllSections();
    }

    public function saveTerm($term) {
        if (!empty($term['isActive'])) {
            $this->pdo->query("UPDATE `academic_terms` SET `is_active` = 0");
        }
        $stmt = $this->pdo->prepare("INSERT INTO `academic_terms` (`school_year`, `semester`, `is_active`) VALUES (:sy, :sem, :active)");
        $stmt->execute([
            'sy'     => $term['schoolYear'],
            'sem'    => $term['semester'],
            'active' => !empty($term['isActive']) ? 1 : 0
        ]);
        return $this->getAllTerms();
    }
}
