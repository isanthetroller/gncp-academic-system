<?php
/**
 * Section Service — Manages block sections, cohorts, subject sections, and capacity tracking.
 */

class SectionService {

    public static function fetchSections(PDO $pdo) {
        $subjectSectionsRaw = $pdo->query("SELECT * FROM `subject_sections` ORDER BY `id` DESC")->fetchAll(PDO::FETCH_ASSOC);
        $subjectSections = array_map(function($ss) {
            return [
                'id' => (int)$ss['id'],
                'program' => $ss['program'] ?? '',
                'yearLevel' => $ss['year_level'] ?? '',
                'semester' => $ss['semester'] ?? '',
                'subject' => $ss['subject'],
                'code' => $ss['code'],
                'instructor' => $ss['instructor'],
                'days' => $ss['days'],
                'time' => $ss['time'],
                'room' => $ss['room'],
                'capacity' => (int)$ss['capacity']
            ];
        }, $subjectSectionsRaw);

        $sectionsRaw = $pdo->query("
            SELECT s.* 
            FROM `sections` s
            JOIN `academic_periods` ap ON s.academic_period_id = ap.id
            WHERE ap.status = 'Active'
            ORDER BY s.code ASC
        ")->fetchAll(PDO::FETCH_ASSOC);

        $sections = [];
        foreach ($sectionsRaw as $s) {
            $sections[] = [
                'id' => (int)$s['id'],
                'code' => $s['code'],
                'program' => $s['program'],
                'yearLevel' => $s['year_level'],
                'capacity' => (int)$s['capacity'],
                'adviser' => $s['adviser'] ?? 'Unassigned'
            ];
        }

        if (empty($sections)) {
            $cohortsRaw = $pdo->query("
                SELECT DISTINCT program, year_level, SUBSTRING_INDEX(code, '-', -1) as cohort 
                FROM `subject_sections`
                ORDER BY program, year_level, cohort ASC
            ")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($cohortsRaw as $c) {
                $sections[] = [
                    'id' => 0,
                    'code' => $c['cohort'],
                    'program' => $c['program'],
                    'yearLevel' => $c['year_level'],
                    'capacity' => 40,
                    'adviser' => 'Unassigned'
                ];
            }
        }

        return [
            'sections' => $sections,
            'subjectSections' => $subjectSections
        ];
    }

    public static function getSectionsForProgram(PDO $pdo, $prog, $year = '1st Year', $sem = '1st Semester') {
        if (!$prog) {
            return ['success' => false, 'message' => 'Program code is required.', 'code' => 400];
        }

        $progInput = trim($prog);
        $aliasCode = (strtoupper($progInput) === 'BSCPE' || strtoupper($progInput) === 'BSCOE') ? 'BSCOE' : $progInput;
        $aliasAlt  = (strtoupper($progInput) === 'BSCPE' || strtoupper($progInput) === 'BSCOE') ? 'BSCpE' : $progInput;
        $aliasName = (strtoupper($progInput) === 'BSCPE' || strtoupper($progInput) === 'BSCOE') ? 'BS Computer Engineering' : $progInput;

        $stmt = $pdo->prepare("SELECT `name`, `code` FROM `programs` WHERE `code` = :code OR `name` = :name OR `code` = :aliasCode OR `name` = :aliasName OR `code` = :aliasAlt");
        $stmt->execute(['code' => $progInput, 'name' => $progInput, 'aliasCode' => $aliasCode, 'aliasName' => $aliasName, 'aliasAlt' => $aliasAlt]);
        $progRow = $stmt->fetch(PDO::FETCH_ASSOC);

        $progName = $progRow['name'] ?? $aliasName;
        $progCode = $progRow['code'] ?? $aliasCode;

        $progLike = '%' . $progCode . '%';
        $stmt = $pdo->prepare("
            SELECT s.*,
                   COALESCE(ap.semester, '1st Semester') AS semester,
                   COALESCE(ap.academic_year, '2026-2027') AS school_year,
                   (
                       COALESCE(
                           (SELECT COUNT(*) FROM `pre_enrollments` pe
                            WHERE pe.section_code = s.code
                              AND (pe.course_code = :progCode1 OR pe.course_code = :progName1 OR pe.course_code = :progInput1 OR pe.course_code = :progAlt1)
                              AND pe.status NOT IN ('Rejected','PRE_REGISTERED')),
                           0
                       ) + COALESCE(
                           (SELECT COUNT(*) FROM `students` st
                             WHERE JSON_UNQUOTE(JSON_EXTRACT(st.enrollment_data, '$.assignedSection')) = s.code
                               AND (st.program = :progName2 OR st.program = :progCode2 OR st.program = :progInput2 OR st.program = :progAlt2)),
                            0
                       )
                   ) AS enrolled_count
            FROM `sections` s
            LEFT JOIN `academic_periods` ap ON s.academic_period_id = ap.id
            WHERE (s.program = :progName3 OR s.program = :progCode3 OR s.program = :progInput3 OR s.program = :progAlt3 OR s.program LIKE :progLike3)
            ORDER BY s.code ASC
        ");
        $stmt->execute([
            'progName1'     => $progName,
            'progCode1'     => $progCode,
            'progInput1'    => $progInput,
            'progAlt1'      => $aliasAlt,
            'progName2'     => $progName,
            'progCode2'     => $progCode,
            'progInput2'    => $progInput,
            'progAlt2'      => $aliasAlt,
            'progName3'     => $progName,
            'progCode3'     => $progCode,
            'progInput3'    => $progInput,
            'progAlt3'      => $aliasAlt,
            'progLike3'     => $progLike
        ]);
        $sections = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $formatted = [];
        foreach ($sections as $s) {
            $enrolled  = (int)($s['enrolled_count'] ?? 0);
            $capacity  = (int)($s['capacity'] ?? 40);
            $slots     = max(0, $capacity - $enrolled);
            $pct       = $capacity > 0 ? round(($enrolled / $capacity) * 100) : 0;

            $formatted[] = [
                'id'                => (int)($s['id'] ?? 0),
                'program'           => $s['program'] ?? $progName,
                'yearLevel'         => $s['year_level'] ?? $year,
                'code'              => $s['code'],
                'sectionName'       => ($s['program'] ?? $progName) . ' — Section ' . $s['code'],
                'capacity'          => $capacity,
                'enrolledCount'     => $enrolled,
                'availableSlots'    => $slots,
                'occupancyPct'      => $pct,
                'adviser'           => $s['adviser'] ?? 'Unassigned',
                'curriculumVersion' => $s['curriculum_version'] ?? '—',
                'semester'          => $s['semester'] ?? $sem,
                'schoolYear'        => $s['school_year'] ?? '—'
            ];
        }
        return ['success' => true, 'data' => $formatted];
    }
}
