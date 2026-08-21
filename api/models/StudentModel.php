<?php
/**
 * Student Model — Handles pre_enrollments and students tables queries
 */
class StudentModel {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function generateReferenceNumber() {
        $year = date('Y');
        $prefix = "REF-{$year}-";
        $stmt = $this->pdo->prepare("SELECT `temp_student_id` FROM `pre_enrollments` WHERE `temp_student_id` LIKE :prefix ORDER BY `id` DESC LIMIT 1");
        $stmt->execute(['prefix' => "{$prefix}%"]);
        $last = $stmt->fetchColumn();

        if ($last) {
            $num = (int)substr($last, strrpos($last, '-') + 1) + 1;
        } else {
            $num = 1001;
        }
        return $prefix . str_pad($num, 4, '0', STR_PAD_LEFT);
    }

    public function createPreEnrollment($data) {
        $refNo = $this->generateReferenceNumber();
        $tempPin = str_pad((string)rand(0, 9999), 4, '0', STR_PAD_LEFT);
        
        $sql = "INSERT INTO `pre_enrollments` (
            `temp_student_id`, `first_name`, `middle_name`, `last_name`, `email`, `phone`,
            `birth_date`, `gender`, `address`, `student_type`, `shs_track`, `previous_college`, `course_code`, `year_level_applied`,
            `elementary_school`, `junior_high_school`, `senior_high_school`, `honors`,
            `health_status`, `medical_conditions`, `allergies`, `current_medication`, `medication_details`,
            `fitness_participation`, `emergency_contact_name`, `emergency_contact_phone`,
            `payment_mode`, `scholarship`, `temp_pin`, `nstp`, `status`,
            `requirements_data`, `medical_data`, `scholarship_data`, `payment_data`, `helpdesk_data`, `roadmap`
        ) VALUES (
            :ref, :fn, :mn, :ln, :email, :phone,
            :bd, :gender, :addr, :stype, :track, :prev_college, :ccode, :year,
            :elem, :jhs, :shs, :honors,
            :health_status, :medical_conditions, :allergies, :current_medication, :medication_details,
            :fitness_participation, :emergency_contact_name, :emergency_contact_phone,
            :payment_mode, :scholarship, :pin, :nstp, 'PRE_REGISTERED',
            :reqs, :medical_data, :scholarship_data, :payment_data, :helpdesk_data, :roadmap
        )";

        $defaultRoadmap = json_encode([
            ['id' => 1, 'stepId' => 'online_prereg', 'name' => 'Online Pre-Reg', 'status' => 'COMPLETED'],
            ['id' => 2, 'stepId' => 'registrar_verification', 'name' => 'Registrar Verification', 'status' => 'PENDING'],
            ['id' => 3, 'stepId' => 'advising_assessment', 'name' => 'Academic Advising', 'status' => 'LOCKED'],
            ['id' => 4, 'stepId' => 'clinic_checkup', 'name' => 'Medical Clearance', 'status' => 'LOCKED'],
            ['id' => 5, 'stepId' => 'scholarship_validation', 'name' => 'Scholarship', 'status' => 'LOCKED'],
            ['id' => 6, 'stepId' => 'cashier_payment', 'name' => 'Cashier Payment', 'status' => 'LOCKED'],
            ['id' => 7, 'stepId' => 'it_activation', 'name' => 'IT Center ID', 'status' => 'LOCKED']
        ]);

        $conditionsStr = is_array($data['medicalConditions'] ?? null) 
            ? implode(', ', $data['medicalConditions']) 
            : (string)($data['medicalConditions'] ?? $data['medical_conditions'] ?? '');

        $hasMedication = !empty($data['currentMedication']) || !empty($data['current_medication']) ? 1 : 0;
        $fitnessPart = isset($data['fitnessParticipation']) || isset($data['fitness_participation']) 
            ? (int)($data['fitnessParticipation'] ?? $data['fitness_participation']) 
            : 1;

        $emergencyName = !empty($data['emergencyContactName']) 
            ? $data['emergencyContactName'] 
            : (!empty($data['emergency_contact_name']) ? $data['emergency_contact_name'] : ($data['firstName'] . ' ' . $data['lastName'] . ' Guardian'));

        $emergencyPhone = !empty($data['emergencyContactPhone']) 
            ? $data['emergencyContactPhone'] 
            : (!empty($data['emergency_contact_phone']) ? $data['emergency_contact_phone'] : ($data['phone'] ?? '09170000000'));

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'ref' => $refNo,
            'fn' => $data['firstName'],
            'mn' => $data['middleName'] ?? null,
            'ln' => $data['lastName'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? '',
            'bd' => !empty($data['birthDate']) ? $data['birthDate'] : (!empty($data['birth_date']) ? $data['birth_date'] : '2000-01-01'),
            'gender' => $data['gender'] ?? 'MALE',
            'addr' => $data['address'] ?? 'Campus City',
            'stype' => $data['studentType'] ?? ($data['student_type'] ?? 'FRESHMAN'),
            'track' => $data['shsTrack'] ?? ($data['shs_track'] ?? ''),
            'prev_college' => $data['previousCollege'] ?? ($data['previous_college'] ?? null),
            'ccode' => $data['courseCode'] ?? ($data['course_code'] ?? 'BSIT'),
            'year' => $data['yearLevelApplied'] ?? ($data['year_level_applied'] ?? '1st Year'),
            'elem' => $data['elementarySchool'] ?? ($data['elementary_school'] ?? ''),
            'jhs' => $data['juniorHighSchool'] ?? ($data['junior_high_school'] ?? ''),
            'shs' => $data['seniorHighSchool'] ?? ($data['senior_high_school'] ?? ''),
            'honors' => $data['honors'] ?? null,
            'health_status' => $data['healthStatus'] ?? ($data['health_status'] ?? 'GOOD'),
            'medical_conditions' => $conditionsStr ?: null,
            'allergies' => $data['allergies'] ?? null,
            'current_medication' => $hasMedication,
            'medication_details' => $data['medicationDetails'] ?? ($data['medication_details'] ?? null),
            'fitness_participation' => $fitnessPart,
            'emergency_contact_name' => $emergencyName,
            'emergency_contact_phone' => $emergencyPhone,
            'payment_mode' => $data['paymentMode'] ?? ($data['payment_mode'] ?? 'CASH'),
            'scholarship' => $data['scholarship'] ?? 'NONE',
            'pin' => $tempPin,
            'nstp' => $data['nstp'] ?? 'CWTS',
            'reqs' => json_encode($data['requirements'] ?? []),
            'medical_data' => json_encode($data['medical'] ?? []),
            'scholarship_data' => json_encode($data['scholarship_data'] ?? []),
            'payment_data' => json_encode($data['payment'] ?? []),
            'helpdesk_data' => json_encode($data['helpdesk'] ?? []),
            'roadmap' => $defaultRoadmap
        ]);

        return [
            'referenceNumber' => $refNo,
            'tempPin' => $tempPin
        ];
    }

    public function findByReferenceNumber($refNo) {
        // First check pre_enrollments
        $stmt = $this->pdo->prepare("SELECT * FROM `pre_enrollments` WHERE `temp_student_id` = :ref");
        $stmt->execute(['ref' => $refNo]);
        $pre = $stmt->fetch();
        if ($pre) {
            return $this->formatQueueItem($pre);
        }

        // If promoted, check permanent students table
        $stmt = $this->pdo->prepare("SELECT * FROM `students` WHERE `temp_reference_no` = :ref_temp OR `id` = :ref_id");
        $stmt->execute(['ref_temp' => $refNo, 'ref_id' => $refNo]);
        $stud = $stmt->fetch();
        if ($stud) {
            return $this->formatStudentItem($stud);
        }

        return null;
    }

    public function getQueue() {
        // Delegate to QueueService for dual-table aggregation (pre_enrollments + students),
        // proper status filtering, and N+1-free performance.
        require_once __DIR__ . '/../../stations/backend/services/QueueService.php';
        return QueueService::fetchQueue($this->pdo);
    }

    public function updatePreEnrollment($refNo, $updateData) {
        $stmt = $this->pdo->prepare("SELECT * FROM `pre_enrollments` WHERE `temp_student_id` = :ref");
        $stmt->execute(['ref' => $refNo]);
        $current = $stmt->fetch();
        if (!$current) return false;

        $fields = [];
        $params = ['ref' => $refNo];

        if (isset($updateData['roadmap'])) {
            $fields[] = "`roadmap` = :roadmap";
            $params['roadmap'] = is_string($updateData['roadmap']) ? $updateData['roadmap'] : json_encode($updateData['roadmap']);
        }
        if (isset($updateData['status'])) {
            $fields[] = "`status` = :status";
            $params['status'] = $updateData['status'];
        }
        if (isset($updateData['section_code']) || isset($updateData['sectionCode'])) {
            $sec = $updateData['section_code'] ?? $updateData['sectionCode'];
            $fields[] = "`section_code` = :sec";
            $params['sec'] = $sec;
        }
        if (isset($updateData['requirements'])) {
            $fields[] = "`requirements_data` = :reqs";
            $params['reqs'] = is_string($updateData['requirements']) ? $updateData['requirements'] : json_encode($updateData['requirements']);
        }
        if (isset($updateData['helpdesk'])) {
            $fields[] = "`helpdesk_data` = :helpdesk";
            $params['helpdesk'] = is_string($updateData['helpdesk']) ? $updateData['helpdesk'] : json_encode($updateData['helpdesk']);
        }
        if (isset($updateData['medical'])) {
            $fields[] = "`medical_data` = :medical";
            $params['medical'] = is_string($updateData['medical']) ? $updateData['medical'] : json_encode($updateData['medical']);
        }
        if (isset($updateData['scholarship'])) {
            $fields[] = "`scholarship_data` = :scholarship";
            $params['scholarship'] = is_string($updateData['scholarship']) ? $updateData['scholarship'] : json_encode($updateData['scholarship']);
        }
        if (isset($updateData['payment'])) {
            $fields[] = "`payment_data` = :payment";
            $params['payment'] = is_string($updateData['payment']) ? $updateData['payment'] : json_encode($updateData['payment']);
        }

        if (empty($fields)) return true;

        $sql = "UPDATE `pre_enrollments` SET " . implode(', ', $fields) . " WHERE `temp_student_id` = :ref";
        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute($params);
    }

    private function formatQueueItem($row) {
        return [
            'id' => (int)$row['id'],
            'referenceNumber' => $row['temp_student_id'] ?? ($row['reference_number'] ?? ''),
            'firstName' => $row['first_name'],
            'middleName' => $row['middle_name'],
            'lastName' => $row['last_name'],
            'email' => $row['email'],
            'phone' => $row['phone'],
            'birthDate' => $row['birth_date'],
            'gender' => $row['gender'],
            'address' => $row['address'],
            'studentType' => $row['student_type'],
            'shsTrack' => $row['shs_track'],
            'previousCollege' => $row['previous_college'] ?? '',
            'courseCode' => $row['course_code'],
            'yearLevelApplied' => $row['year_level_applied'] ?? '1st Year',
            'sectionCode' => $row['section_code'] ?? '',
            'tempPin' => $row['temp_pin'] ?? '',
            'status' => $row['status'],
            'requirements' => json_decode($row['requirements_data'] ?? '[]', true),
            'roadmap' => json_decode($row['roadmap'] ?? '[]', true),
            'helpdesk' => json_decode($row['helpdesk_data'] ?? '{}', true),
            'medical' => json_decode($row['medical_data'] ?? '{}', true),
            'scholarship' => json_decode($row['scholarship_data'] ?? '{}', true),
            'payment' => json_decode($row['payment_data'] ?? '{}', true),
            'created_at' => $row['created_at']
        ];
    }

    private function formatStudentItem($row) {
        $personal = json_decode($row['personal_info'] ?? '{}', true);
        return [
            'id' => $row['id'],
            'referenceNumber' => $row['temp_reference_no'] ?? $row['id'],
            'firstName' => $personal['firstName'] ?? '',
            'middleName' => $personal['middleName'] ?? '',
            'lastName' => $personal['lastName'] ?? $row['name'],
            'email' => $row['email'],
            'program' => $row['program'],
            'yearLevel' => $row['year_level'],
            'status' => 'ENROLLED',
            'photo' => $row['photo'],
            'roadmap' => json_decode($row['roadmap'] ?? '[]', true),
            'requirements' => json_decode($row['requirements_data'] ?? '[]', true),
            'helpdesk' => json_decode($row['helpdesk_data'] ?? '{}', true),
            'medical' => json_decode($row['medical_data'] ?? '{}', true),
            'payment' => json_decode($row['payment_data'] ?? '{}', true),
            'enrollment' => json_decode($row['enrollment_data'] ?? '{}', true)
        ];
    }

    public function deleteTestRecords($pattern = 'test.student.%@gncp.edu.ph') {
        $deleted = 0;
        try {
            $stmt1 = $this->pdo->prepare("DELETE FROM `pre_enrollments` WHERE `email` LIKE :pattern1 OR `email` LIKE 'test.%@gncp.edu.ph' OR `first_name` LIKE 'Test%'");
            $stmt1->execute(['pattern1' => $pattern]);
            $deleted += $stmt1->rowCount();

            $stmt2 = $this->pdo->prepare("DELETE FROM `students` WHERE `email` LIKE :pattern2 OR `email` LIKE 'test.%@gncp.edu.ph' OR `name` LIKE 'Test%'");
            $stmt2->execute(['pattern2' => $pattern]);
            $deleted += $stmt2->rowCount();
        } catch (Exception $e) {
            if (function_exists('logAppError')) {
                logAppError("deleteTestRecords Error: " . $e->getMessage());
            }
        }
        return $deleted;
    }
}
