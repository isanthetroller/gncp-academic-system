<?php
/**
 * GNCP Workstations — Enrollment Service
 * Handles transactional student updates, IT center finalization, and photo uploads.
 */

require_once __DIR__ . '/../../../shared/backend/services/AssessmentService.php';

class EnrollmentService {
    public static function updateStudent(PDO $pdo, array $payload) {
        $refNo = $payload['referenceNumber'] ?? '';
        $updateData = $payload['updateData'] ?? null;

        if (!$refNo || !$updateData) {
            throw new InvalidArgumentException('Invalid payload or missing update details.');
        }

        // Fetch existing record first
        $checkExist = $pdo->prepare("SELECT * FROM `pre_enrollments` WHERE `temp_student_id` = :ref");
        $checkExist->execute(['ref' => $refNo]);
        $existingRecord = $checkExist->fetch(PDO::FETCH_ASSOC);

        if (!$existingRecord) {
            // Check permanent students directory
            $checkStudent = $pdo->prepare("SELECT * FROM `students` WHERE `id` = :r1 OR `temp_reference_no` = :r2");
            $checkStudent->execute(['r1' => $refNo, 'r2' => $refNo]);
            $studentInfo = $checkStudent->fetch(PDO::FETCH_ASSOC);

            if ($studentInfo) {
                $studentSets = [];
                $studentParams = ['ref1' => $refNo, 'ref2' => $refNo];

                if (isset($updateData['roadmap'])) {
                    $studentSets[] = "`roadmap` = :roadmap";
                    $studentParams['roadmap'] = json_encode($updateData['roadmap']);
                }
                if (isset($updateData['medical'])) {
                    $studentSets[] = "`medical_data` = :medical_data";
                    $studentParams['medical_data'] = json_encode($updateData['medical']);
                }
                if (isset($updateData['requirements'])) {
                    $studentSets[] = "`requirements_data` = :requirements_data";
                    $studentParams['requirements_data'] = json_encode($updateData['requirements']);
                }
                if (isset($updateData['payment'])) {
                    $studentSets[] = "`payment_data` = :payment_data";
                    $studentParams['payment_data'] = json_encode($updateData['payment']);
                }
                if (isset($updateData['helpdesk'])) {
                    $studentSets[] = "`helpdesk_data` = :helpdesk_data";
                    $studentParams['helpdesk_data'] = json_encode($updateData['helpdesk']);
                }
                if (isset($updateData['enrollment'])) {
                    $studentSets[] = "`enrollment_data` = :enrollment_data";
                    $studentParams['enrollment_data'] = json_encode($updateData['enrollment']);
                }

                if (!empty($studentSets)) {
                    $sqlStud = "UPDATE `students` SET " . implode(', ', $studentSets) . " WHERE `temp_reference_no` = :ref1 OR `id` = :ref2";
                    $stmtStud = $pdo->prepare($sqlStud);
                    $stmtStud->execute($studentParams);
                }
                return ['referenceNumber' => $refNo, 'status' => $studentInfo['status']];
            }
            throw new RuntimeException("Student record not found for: $refNo");
        }

        if (strcasecmp($existingRecord['status'], 'Rejected') === 0) {
            throw new DomainException('This application has been permanently rejected.');
        }

        // Validate payment eligibility if payment update is provided
        if (isset($updateData['payment'])) {
            PaymentService::validatePaymentEligibility($existingRecord);
        }

        // Check if all steps in the roadmap are completed or skipped & validate sequential order
        $allDone = true;
        $roadmapSteps = $updateData['roadmap'] ?? json_decode($existingRecord['roadmap'] ?? '[]', true) ?? [];
        if (empty($roadmapSteps)) {
            $allDone = false;
        } else {
            $prevDone = true;
            foreach ($roadmapSteps as $idx => $step) {
                $statusVal = strtoupper($step['status'] ?? '');
                if ($statusVal === 'COMPLETED' && !$prevDone) {
                    throw new DomainException("Roadmap step '" . ($step['stepId'] ?? $idx) . "' cannot be completed out of order.");
                }
                if ($statusVal !== 'COMPLETED' && $statusVal !== 'SKIPPED') {
                    $prevDone = false;
                    $allDone = false;
                }
            }
        }

        $incomingStatus = $updateData['status'] ?? null;
        $overallStatus = $existingRecord['status'];
        if ($incomingStatus === 'ENROLLED' || $incomingStatus === 'Approved' || $incomingStatus === 'APPROVED') {
            $overallStatus = $incomingStatus;
        }
        if ($allDone) {
            $overallStatus = 'ENROLLED';
        }

        $roadmapJson = isset($updateData['roadmap']) ? json_encode($updateData['roadmap']) : $existingRecord['roadmap'];
        $enrollmentJson = isset($updateData['enrollment']) ? json_encode($updateData['enrollment']) : $existingRecord['enrollment_data'];

        // Begin atomic PDO transaction
        $pdo->beginTransaction();

        try {
            $sets = [];
            $params = ['ref' => $refNo];

            if (isset($updateData['roadmap'])) {
                $sets[] = "`roadmap` = :roadmap";
                $params['roadmap'] = $roadmapJson;
            }
            if (isset($updateData['requirements'])) {
                $sets[] = "`requirements_data` = :requirements_data";
                $params['requirements_data'] = json_encode($updateData['requirements']);
            }
            if (isset($updateData['medical'])) {
                $sets[] = "`medical_data` = :medical_data";
                $params['medical_data'] = json_encode($updateData['medical']);
            }
            if (isset($updateData['scholarship'])) {
                $sets[] = "`scholarship_data` = :scholarship_data";
                $params['scholarship_data'] = json_encode($updateData['scholarship']);
            }
            if (isset($updateData['payment'])) {
                $paymentPayload = $updateData['payment'];
                if (empty($paymentPayload['assessmentSnapshot'])) {
                    $helpdesk = json_decode($existingRecord['helpdesk_data'] ?? '{}', true) ?: [];
                    $advisedSubjects = $helpdesk['advisedSubjects'] ?? [];
                    $nstp = strtoupper($existingRecord['nstp'] ?? 'NONE');
                    $scholarshipData = json_decode($existingRecord['scholarship_data'] ?? '{}', true) ?: [];
                    $discount = (float)($scholarshipData['discount'] ?? 0.00);

                    $paymentPayload['assessmentSnapshot'] = AssessmentService::calculateAssessment($pdo, $advisedSubjects, $nstp, $discount);
                    $updateData['payment'] = $paymentPayload;
                }
                $sets[] = "`payment_data` = :payment_data";
                $params['payment_data'] = json_encode($updateData['payment']);
            }
            if (isset($updateData['helpdesk'])) {
                $sets[] = "`helpdesk_data` = :helpdesk_data";
                $params['helpdesk_data'] = json_encode($updateData['helpdesk']);
                
                $scholarshipName = $updateData['helpdesk']['scholarshipName'] ?? 'NONE';
                $sets[] = "`scholarship` = :scholarship";
                $params['scholarship'] = $scholarshipName;

                // Freeze assessment snapshot immediately upon Academic Advising (Pre-Payment Protection)
                $advisedSubjects = $updateData['helpdesk']['advisedSubjects'] ?? [];
                $nstp = strtoupper($existingRecord['nstp'] ?? 'NONE');
                $scholarshipData = json_decode($existingRecord['scholarship_data'] ?? '{}', true) ?: [];
                $discount = (float)($scholarshipData['discount'] ?? 0.00);

                $existingPayment = json_decode($existingRecord['payment_data'] ?? '{}', true) ?: [];
                if (empty($existingPayment['assessmentSnapshot']) && !empty($advisedSubjects)) {
                    $existingPayment['assessmentSnapshot'] = AssessmentService::calculateAssessment($pdo, $advisedSubjects, $nstp, $discount);
                    $sets[] = "`payment_data` = :payment_data";
                    $params['payment_data'] = json_encode($existingPayment);
                }
            }
            if (isset($updateData['enrollment'])) {
                $sets[] = "`enrollment_data` = :enrollment_data";
                $params['enrollment_data'] = $enrollmentJson;
            }
            if (isset($updateData['section_code'])) {
                $sets[] = "`section_code` = :section_code";
                $params['section_code'] = $updateData['section_code'];
            }
            if (isset($updateData['status'])) {
                $sets[] = "`status` = :status";
                $params['status'] = $overallStatus;
            } elseif ($allDone) {
                $sets[] = "`status` = :status";
                $params['status'] = 'ENROLLED';
            }

            if (!empty($sets)) {
                $sql = "UPDATE `pre_enrollments` SET " . implode(', ', $sets) . " WHERE `temp_student_id` = :ref";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);

                // Synchronize updates to permanent students directory if student record exists
                $studentSets = [];
                $studentParams = ['ref1' => $refNo, 'ref2' => $refNo];

                if (isset($updateData['roadmap'])) {
                    $studentSets[] = "`roadmap` = :roadmap";
                    $studentParams['roadmap'] = $roadmapJson;
                }
                if (isset($updateData['medical'])) {
                    $studentSets[] = "`medical_data` = :medical_data";
                    $studentParams['medical_data'] = json_encode($updateData['medical']);
                }
                if (isset($updateData['requirements'])) {
                    $studentSets[] = "`requirements_data` = :requirements_data";
                    $studentParams['requirements_data'] = json_encode($updateData['requirements']);
                }
                if (isset($updateData['payment'])) {
                    $studentSets[] = "`payment_data` = :payment_data";
                    $studentParams['payment_data'] = json_encode($updateData['payment']);
                }
                if (isset($updateData['helpdesk'])) {
                    $studentSets[] = "`helpdesk_data` = :helpdesk_data";
                    $studentParams['helpdesk_data'] = json_encode($updateData['helpdesk']);
                }

                if (!empty($studentSets)) {
                    $sqlStud = "UPDATE `students` SET " . implode(', ', $studentSets) . " WHERE `temp_reference_no` = :ref1 OR `id` = :ref2";
                    $stmtStud = $pdo->prepare($sqlStud);
                    $stmtStud->execute($studentParams);
                }
            }

            // Automatically create or update permanent student directory record upon IT Center activation
            $resData = ['referenceNumber' => $refNo, 'status' => $overallStatus];
            if ($overallStatus === 'ENROLLED') {
                $fetchStmt = $pdo->prepare("SELECT * FROM `pre_enrollments` WHERE `temp_student_id` = :ref");
                $fetchStmt->execute(['ref' => $refNo]);
                $appDetails = $fetchStmt->fetch(PDO::FETCH_ASSOC);

                if ($appDetails) {
                    $itData = json_decode($enrollmentJson, true) ?: [];
                    $promoResult = promotePreEnrollmentToStudent($pdo, $appDetails, $refNo, $roadmapJson, $itData);

                    $wasAlreadyEnrolled = ($existingRecord && $existingRecord['status'] === 'ENROLLED');

                    if (!$wasAlreadyEnrolled) {
                        $assignedSections = $itData['sections'] ?? [];
                        if (!empty($assignedSections) && is_array($assignedSections)) {
                            foreach ($assignedSections as $secCode) {
                                $upSecStmt = $pdo->prepare("UPDATE `subject_sections` SET `capacity` = GREATEST(0, `capacity` - 1) WHERE `code` = :code");
                                $upSecStmt->execute(['code' => $secCode]);
                            }
                        }
                    }

                    $resData['permanentId']        = $promoResult['permanentId'] ?? '';
                    $resData['institutionalEmail'] = $promoResult['institutionalEmail'] ?? '';
                    $resData['password']           = $promoResult['password'] ?? '';
                }
            }

            // Audit Trail: Record workstation mutation in audit_logs table
            $sessionUser = $_SESSION['gncp_admin_user']['username'] ?? $_SESSION['gncp_station_user']['username'] ?? 'SYSTEM';
            $sessionRole = $_SESSION['gncp_admin_user']['role'] ?? $_SESSION['gncp_station_user']['role'] ?? 'WORKSTATION';
            $auditStmt = $pdo->prepare("
                INSERT INTO `audit_logs` (`reference_number`, `operator_username`, `station_role`, `action_performed`, `previous_state`, `new_state`)
                VALUES (:ref, :operator, :role, :action, :prev, :new)
            ");
            $auditStmt->execute([
                'ref'      => $refNo,
                'operator' => $sessionUser,
                'role'     => $sessionRole,
                'action'   => 'UPDATE_STUDENT_MILESTONE',
                'prev'     => json_encode($existingRecord['status'] ?? 'UNKNOWN'),
                'new'      => json_encode($resData)
            ]);

            // Commit atomic transaction
            $pdo->commit();
            return $resData;


        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public static function uploadPhoto(array $payload) {
        $refNo       = trim($payload['referenceNumber'] ?? '');
        $base64Data  = $payload['photoData'] ?? '';
        $fileName    = preg_replace('/[^a-zA-Z0-9_\-.]/', '_', $payload['fileName'] ?? 'portrait.png');

        if (!$refNo || !$base64Data) {
            throw new InvalidArgumentException('referenceNumber and photoData are required.');
        }

        if (preg_match('/^data:image\/\w+;base64,/', $base64Data)) {
            $base64Data = preg_replace('/^data:image\/\w+;base64,/', '', $base64Data);
        }

        $imageData = base64_decode($base64Data);
        if ($imageData === false) {
            throw new InvalidArgumentException('Invalid base64 image data.');
        }

        $uploadDir = __DIR__ . '/../../../uploads/portraits/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $safeRef   = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $refNo);
        $finalName = 'portrait_' . $safeRef . '_' . time() . '.png';
        $filePath  = $uploadDir . $finalName;

        if (file_put_contents($filePath, $imageData) === false) {
            throw new RuntimeException('Failed to write portrait file to disk.');
        }

        $webPath = '/systemtest/uploads/portraits/' . $finalName;

        return [
            'referenceNumber' => $refNo,
            'fileName'        => $finalName,
            'webPath'         => $webPath
        ];
    }
}
