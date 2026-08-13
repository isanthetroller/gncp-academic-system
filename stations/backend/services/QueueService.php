<?php
/**
 * GNCP Workstations — Queue Service
 * Handles queue compilation, section scheduling mapping, and stats aggregation.
 *
 * Performance: Pre-loads programs map and curriculum cache before the main loop
 * to eliminate N+1 query patterns (was ~3N+2 queries, now ~7 queries total).
 */

class QueueService {
    public static function getQueueHash(PDO $pdo): string {
        try {
            $peStmt = $pdo->query("
                SELECT 
                    COUNT(*) AS cnt,
                    COALESCE(MAX(`id`), 0) AS max_id,
                    COALESCE(SUM(CHAR_LENGTH(CONCAT_WS(':', `status`, COALESCE(`section_code`,''), COALESCE(`or_number`,''), COALESCE(`medical_conditions`,''), COALESCE(`scholarship`,'')))), 0) AS d_hash
                FROM `pre_enrollments`
                WHERE UPPER(`status`) NOT IN ('PRE_REGISTERED', 'REJECTED', 'PROMOTED')
            ");
            $pe = $peStmt ? $peStmt->fetch(PDO::FETCH_ASSOC) : ['cnt'=>0, 'max_id'=>0, 'd_hash'=>0];

            $stStmt = $pdo->query("
                SELECT 
                    COUNT(*) AS cnt,
                    COALESCE(SUM(CHAR_LENGTH(CONCAT_WS(':', `status`, COALESCE(`section_code`,''), COALESCE(`academic_year`,'')))), 0) AS d_hash
                FROM `students`
            ");
            $st = $stStmt ? $stStmt->fetch(PDO::FETCH_ASSOC) : ['cnt'=>0, 'd_hash'=>0];

            $seed = sprintf("pe:%d:%d:%d-st:%d:%d", 
                $pe['cnt'] ?? 0, $pe['max_id'] ?? 0, $pe['d_hash'] ?? 0, 
                $st['cnt'] ?? 0, $st['d_hash'] ?? 0
            );
            return '"' . md5($seed) . '"';
        } catch (Exception $e) {
            return '"' . md5((string)time()) . '"';
        }
    }

    public static function fetchQueue(PDO $pdo) {
        // 1. Get active semester period first to scope the sections
        $activeSem = '1st Semester';
        $activePeriodId = null;
        $activePeriodQuery = $pdo->query("SELECT `id`, `semester` FROM `academic_periods` WHERE `status` = 'Active' LIMIT 1");
        if ($activePeriodQuery) {
            $apRow = $activePeriodQuery->fetch(PDO::FETCH_ASSOC);
            if ($apRow) {
                $activeSem = $apRow['semester'];
                $activePeriodId = (int)$apRow['id'];
            }
        }

        // 2. Fetch staging pre_enrollments (exclude pre-registered, rejected, promoted)
        $stmt = $pdo->query("SELECT * FROM `pre_enrollments` WHERE UPPER(`status`) NOT IN ('PRE_REGISTERED', 'REJECTED', 'PROMOTED') ORDER BY `id` DESC");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 3. Fetch permanent student directory records and index by reference ID/Email for seamless merging
        $studMap = [];
        $existingRefs = [];
        $studRows = [];
        try {
            $studStmt = $pdo->query("SELECT * FROM `students` ORDER BY `id` DESC");
            $studRows = $studStmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($studRows as $sr) {
                if (!empty($sr['temp_reference_no'])) {
                    $studMap[$sr['temp_reference_no']] = $sr;
                }
                $studMap[$sr['id']] = $sr;
                if (!empty($sr['email'])) {
                    $studMap[strtolower($sr['email'])] = $sr;
                }
            }
        } catch (Exception $e) {
            // Log silently — do not halt queue; enrolled students may be missing from view
            if (function_exists('logAppError')) {
                logAppError('QueueService: Failed to fetch students table', [
                    'error' => $e->getMessage()
                ]);
            }
        }

        // 4. Merge updated student fields from permanent directory into staging queue rows
        foreach ($rows as &$row) {
            $ref = $row['temp_student_id'];
            $email = strtolower($row['email'] ?? '');
            $sr = $studMap[$ref] ?? ($studMap[$email] ?? null);

            if ($sr) {
                $existingRefs[$ref] = true;
                $existingRefs[$sr['id']] = true;

                if (!empty($sr['medical_data']) && $sr['medical_data'] !== '{}') {
                    $row['medical_data'] = $sr['medical_data'];
                }
                if (!empty($sr['payment_data']) && $sr['payment_data'] !== '{}') {
                    $row['payment_data'] = $sr['payment_data'];
                }
                if (!empty($sr['requirements_data']) && $sr['requirements_data'] !== '{}') {
                    $row['requirements_data'] = $sr['requirements_data'];
                }
                if (!empty($sr['roadmap']) && $sr['roadmap'] !== '[]') {
                    $row['roadmap'] = $sr['roadmap'];
                }
            }
        }
        unset($row);

        // 5. Append any permanent enrolled students that do not exist in staging pre_enrollments
        foreach ($studRows as $sr) {
            $ref = !empty($sr['temp_reference_no']) ? $sr['temp_reference_no'] : $sr['id'];
            $email = strtolower($sr['email'] ?? '');
            if (!isset($existingRefs[$ref]) && !isset($existingRefs[$sr['id']]) && !isset($existingRefs[$email])) {
                $existingRefs[$ref] = true;
                $existingRefs[$sr['id']] = true;

                $personal = json_decode($sr['personal_info'] ?? '{}', true) ?: [];
                $academic = json_decode($sr['academic_info'] ?? '{}', true) ?: [];
                $nameParts = explode(' ', trim($sr['name'] ?? ''));
                $firstName = $personal['firstName'] ?? ($nameParts[0] ?? '');
                $lastName = $personal['lastName'] ?? (end($nameParts) ?: '');
                $middleName = $personal['middleName'] ?? '';

                // Recover original temp_pin from personal_info; fall back to masked placeholder
                $recoveredPin = $personal['temp_pin'] ?? $sr['temp_pin'] ?? '——';

                $rows[] = [
                    'id'                  => $sr['id'],
                    'temp_student_id'     => $ref,
                    'temp_pin'            => $recoveredPin,
                    'first_name'          => $firstName,
                    'middle_name'         => $middleName,
                    'last_name'           => $lastName,
                    'course_code'         => $sr['program'],
                    'student_type'        => 'REGULAR',
                    'phone'               => $personal['phone'] ?? '',
                    'email'               => $sr['email'],
                    'gender'              => $personal['gender'] ?? 'Other',
                    'address'             => $personal['address'] ?? '',
                    'payment_mode'        => 'Cash',
                    'created_at'          => $sr['created_at'],
                    'senior_high_school'  => $academic['seniorHighSchool'] ?? '',
                    'shs_track'           => $academic['shsTrack'] ?? '',
                    'health_status'       => 'GOOD',
                    'medical_conditions'  => '',
                    'allergies'           => 'None',
                    'current_medication'  => 0,
                    'medication_details'  => '',
                    'roadmap'             => $sr['roadmap'],
                    'requirements_data'   => $sr['requirements_data'],
                    'medical_data'        => $sr['medical_data'],
                    'scholarship_data'    => $sr['scholarship_data'],
                    'payment_data'        => $sr['payment_data'],
                    'helpdesk_data'       => $sr['helpdesk_data'],
                    'enrollment_data'     => $sr['enrollment_data'],
                    'scholarship'         => 'NONE',
                    'year_level_applied'  => $sr['year_level'],
                    'status'              => $sr['status']
                ];
            }
        }

        // 6. Fetch subject sections belonging to the active academic period
        if ($activePeriodId !== null) {
            $sectionsStmt = $pdo->prepare("
                SELECT ss.*,
                       COALESCE(s.program, ss.program) AS program,
                       COALESCE(s.year_level, ss.year_level) AS year_level
                FROM `subject_sections` ss
                LEFT JOIN `sections` s ON ss.section_id = s.id
                WHERE ss.semester = (SELECT semester FROM `academic_periods` WHERE id = :activePeriodId1 LIMIT 1)
                   OR s.academic_period_id = :activePeriodId2
            ");
            $sectionsStmt->execute([
                'activePeriodId1' => $activePeriodId,
                'activePeriodId2' => $activePeriodId
            ]);
            $sectionsRaw = $sectionsStmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            $sectionsRaw = [];
        }

        // -------------------------------------------------------------------
        // PERFORMANCE FIX: Pre-load all programs into an in-memory map.
        // This eliminates the N+1 pattern (was 1 query per student in the loop).
        // -------------------------------------------------------------------
        $progMap = [];
        $allProgsStmt = $pdo->query("SELECT `code`, `name` FROM `programs`");
        if ($allProgsStmt) {
            foreach ($allProgsStmt->fetchAll(PDO::FETCH_ASSOC) as $p) {
                $progMap[$p['code']] = $p['name'];
            }
        }

        // -------------------------------------------------------------------
        // PERFORMANCE FIX: Pre-load curriculum subjects for all unique
        // (course_code, year_level) combinations found in the queue.
        // This eliminates the N+1 getCurriculumSubjects() call per student.
        // -------------------------------------------------------------------
        $curriculumCache = [];
        $uniqueCombos = [];
        foreach ($rows as $r) {
            $yearLvl = !empty($r['year_level_applied']) ? $r['year_level_applied'] : '1st Year';
            $key = ($r['course_code'] ?? '') . '|' . $yearLvl;
            $uniqueCombos[$key] = [$r['course_code'] ?? '', $yearLvl];
        }
        foreach ($uniqueCombos as $key => [$code, $yearLvl]) {
            if ($code) {
                $curriculumCache[$key] = self::getCurriculumSubjects($pdo, $code, $yearLvl, $activeSem);
            }
        }

        // 7. Build the final queue payload — all lookups are now O(1)
        $queue = [];
        foreach ($rows as $row) {
            $nameParts = array_filter([$row['first_name'], $row['middle_name'], $row['last_name']]);
            $fullName = implode(' ', $nameParts);

            $medConditionsStr = $row['medical_conditions'] ?? '';
            $medConditionsArr = $medConditionsStr ? array_map('trim', explode(',', $medConditionsStr)) : [];

            // O(1) program name lookup — no more per-student SQL query
            $programName = $progMap[$row['course_code'] ?? ''] ?? ($row['course_code'] ?? '');

            $yearLevel = !empty($row['year_level_applied']) ? $row['year_level_applied'] : '1st Year';

            // O(1) curriculum lookup — no more per-student SQL query
            $cacheKey = ($row['course_code'] ?? '') . '|' . $yearLevel;
            $progSubjects = $curriculumCache[$cacheKey] ?? [];
            $subjectTitles = array_column($progSubjects, 'title');

            $matchingSections = [];
            foreach ($sectionsRaw as $sec) {
                if ($sec['capacity'] > 0 &&
                    in_array($sec['subject'], $subjectTitles) &&
                    (empty($sec['program']) || $sec['program'] === $programName) &&
                    (empty($sec['year_level']) || $sec['year_level'] === $yearLevel) &&
                    (empty($sec['semester']) || $sec['semester'] === $activeSem)) {

                    $matchingSections[] = [
                        'id'         => (int)$sec['id'],
                        'subject'    => $sec['subject'],
                        'code'       => $sec['code'],
                        'instructor' => $sec['instructor'],
                        'days'       => $sec['days'],
                        'time'       => $sec['time'],
                        'room'       => $sec['room'],
                        'capacity'   => (int)$sec['capacity']
                    ];
                }
            }

            $queue[] = [
                'id'                 => (int)$row['id'],
                'referenceNumber'    => $row['temp_student_id'],
                'tempPin'            => $row['temp_pin'],
                'lastName'           => $row['last_name'],
                'firstName'          => $row['first_name'],
                'middleName'         => $row['middle_name'] ?? '',
                'name'               => $fullName,
                'program'            => $row['course_code'],
                'studentType'        => $row['student_type'],
                'phone'              => $row['phone'],
                'email'              => $row['email'],
                'gender'             => $row['gender'],
                'address'            => $row['address'],
                'paymentMode'        => $row['payment_mode'] ?? 'Cash',
                'datePreRegistered'  => date('F j, Y', strtotime($row['created_at'])),
                'createdAt'          => $row['created_at'],
                'seniorHighSchool'   => $row['senior_high_school'] ?? '',
                'shsTrack'           => $row['shs_track'] ?? '',
                'orNumber'           => $row['or_number'] ?? null,
                'enrolledAt'         => $row['enrolled_at'] ?? null,
                'cashierName'        => $row['cashier_name'] ?? null,
                'form'               => [
                    'healthStatus'      => $row['health_status'] ?? 'GOOD',
                    'medicalConditions' => $medConditionsArr,
                    'allergies'         => $row['allergies'] ?? 'None',
                    'currentMedication' => (bool)($row['current_medication'] ?? false),
                    'medicationDetails' => $row['medication_details'] ?? ''
                ],
                'roadmap'            => json_decode((string)($row['roadmap'] ?? ''), true) ?: [],
                'requirements'       => json_decode((string)($row['requirements_data'] ?? ''), true) ?: new stdClass(),
                'medical'            => json_decode((string)($row['medical_data'] ?? ''), true) ?: new stdClass(),
                'scholarship'        => json_decode((string)($row['scholarship_data'] ?? ''), true) ?: new stdClass(),
                'payment'            => json_decode((string)($row['payment_data'] ?? ''), true) ?: new stdClass(),
                'helpdesk'           => array_merge(
                    ['scholarshipName' => $row['scholarship'] ?? 'NONE'],
                    json_decode((string)($row['helpdesk_data'] ?? ''), true) ?: []
                ),
                'enrollment'         => json_decode((string)($row['enrollment_data'] ?? ''), true) ?: new stdClass(),
                'prospectusSubjects' => $progSubjects,
                'availableSections'  => $matchingSections
            ];
        }

        return $queue;
    }

    public static function getEnrollmentStats(PDO $pdo) {
        $stmt = $pdo->query(
            "SELECT
                SUM(JSON_UNQUOTE(JSON_EXTRACT(roadmap, '$[5].status')) != 'COMPLETED') AS pending_activation,
                SUM(JSON_UNQUOTE(JSON_EXTRACT(roadmap, '$[4].status')) = 'COMPLETED'
                    AND JSON_UNQUOTE(JSON_EXTRACT(roadmap, '$[5].status')) != 'COMPLETED') AS ready_for_it
            FROM `pre_enrollments`
            WHERE `status` NOT IN ('PRE_REGISTERED', 'Rejected', 'PROMOTED')
            AND roadmap IS NOT NULL"
        );
        $stats = $stmt->fetch(PDO::FETCH_ASSOC);

        $totalStmt = $pdo->query("SELECT COUNT(*) FROM `students`");
        $activatedTotal = (int)$totalStmt->fetchColumn();

        // PERFORMANCE FIX: Use bound parameter instead of raw string interpolation
        $todayStmt = $pdo->prepare(
            "SELECT COUNT(*) FROM `students` WHERE DATE(`created_at`) = :today"
        );
        $todayStmt->execute(['today' => date('Y-m-d')]);
        $activatedToday = (int)$todayStmt->fetchColumn();

        return [
            'pendingActivation' => (int)($stats['pending_activation'] ?? 0),
            'activatedTotal'    => $activatedTotal,
            'readyForIt'        => (int)($stats['ready_for_it'] ?? 0),
            'activatedToday'    => $activatedToday
        ];
    }

    public static function fetchStudentAccounts(PDO $pdo) {
        $stmt = $pdo->query("SELECT `id`, `name`, `program`, `year_level`, `email`, `status`, `created_at` FROM `students` ORDER BY `name` ASC");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $students = [];
        foreach ($rows as $r) {
            $students[] = [
                'id'        => $r['id'],
                'name'      => $r['name'],
                'program'   => $r['program'],
                'yearLevel' => $r['year_level'],
                'year_level'=> $r['year_level'],
                'email'     => $r['email'] ?? '',
                'status'    => $r['status'],
                'createdAt' => $r['created_at'],
                'created_at'=> $r['created_at']
            ];
        }
        return $students;
    }

    private static function getCurriculumSubjects(PDO $pdo, string $courseCode, string $yearLevel, string $semester): array {
        try {
            // Resolve program code to program name for curriculum lookup
            $progStmt = $pdo->prepare("SELECT `name` FROM `programs` WHERE `code` = :code");
            $progStmt->execute([':code' => $courseCode]);
            $programName = $progStmt->fetchColumn() ?: $courseCode;

            $stmt = $pdo->prepare("
                SELECT s.code, s.title, s.lecture_units, s.lab_units, s.lab_fee, s.prerequisites
                FROM `curriculum` c
                JOIN `subjects` s ON (c.subject = s.title OR c.subject = s.code)
                WHERE (c.program = :progName OR c.program = :progCode)
                  AND c.year_level = :year_level
                  AND c.semester = :sem
            ");
            $stmt->execute([
                ':progName'   => $programName,
                ':progCode'   => $courseCode,
                ':year_level' => $yearLevel,
                ':sem'        => $semester
            ]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            if (function_exists('logAppError')) {
                logAppError('QueueService::getCurriculumSubjects Error', [
                    'error' => $e->getMessage(),
                    'courseCode' => $courseCode,
                    'yearLevel' => $yearLevel,
                    'semester' => $semester
                ]);
            }
            return [];
        }
    }
}

