<?php
/**
 * GNCP Workstations — Payment Service
 * Handles cashier payment validation, fee integrity checks, and OR issuance.
 */

class PaymentService {
    /**
     * Validates whether a student is eligible for cashier payment.
     * Prevents issuing Official Receipts for unverified or unapproved applicants.
     */
    public static function validatePaymentEligibility(array $existingRecord) {
        $status = strtoupper($existingRecord['status'] ?? '');
        if ($status === 'PRE_REGISTERED') {
            throw new Exception("Student documents must be verified by the Registrar before accepting payment.");
        }
        if ($status === 'REJECTED') {
            throw new Exception("Cannot process payment for a rejected applicant.");
        }

        $roadmap = json_decode($existingRecord['roadmap'] ?? '[]', true) ?: [];
        foreach ($roadmap as $step) {
            $stepId = $step['stepId'] ?? '';
            if (in_array($stepId, ['registrar_verification', 'advising_assessment', 'clinic_checkup'], true)) {
                $stepStatus = strtoupper($step['status'] ?? '');
                if ($stepStatus !== 'COMPLETED' && $stepStatus !== 'SKIPPED') {
                    throw new Exception("Prior workstation steps (Advising/Medical) must be completed before accepting cashier payment.");
                }
            }
        }

        return true;
    }
}
