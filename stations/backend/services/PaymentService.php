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
        return true;
    }
}
