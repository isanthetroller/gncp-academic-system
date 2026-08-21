<?php
/**
 * Assessment Service — Authoritative Single-Source-of-Truth Financial Calculation Engine
 * Designed for Philippine College / University enrollment & tuition assessment standards.
 * 
 * Features:
 * - Strict database-driven fee selection (No dangerous hardcoded fallbacks).
 * - Per-unit tuition vs. flat fee distinction.
 * - Early snapshot creation upon academic advising (Before payment is made).
 * - Multi-payment transaction ledger support with voiding protection.
 * - Centralized 8% installment plan surcharge calculations.
 */

class AssessmentService {

    /**
     * Calculates or retrieves the complete itemized financial assessment for a student.
     * 
     * @param PDO $pdo Unified database connection instance
     * @param array $schedule List of enrolled subjects (each with lecture_units/units, lab_units, lab_fee)
     * @param string $nstp Choice of NSTP ('ROTC', 'CWTS', 'LTS', 'NONE')
     * @param float $discount Applied scholarship discount amount (default 0.00)
     * @param array|null $existingSnapshot Optional frozen snapshot if reconstructing historical assessment
     * @return array Complete itemized assessment breakdown
     * @throws Exception If mandatory tuition rate per unit is unconfigured in fee_schedule
     */
    public static function calculateAssessment(PDO $pdo, array $schedule = [], string $nstp = 'NONE', float $discount = 0.00, ?array $existingSnapshot = null): array {
        // If an immutable frozen snapshot exists for an advised/enrolled student, preserve historical assessment integrity!
        if (!empty($existingSnapshot) && isset($existingSnapshot['cashTotal']) && (float)$existingSnapshot['cashTotal'] >= 0 && !empty($existingSnapshot['tuitionRate'])) {
            $existingSnapshot['isSnapshot'] = true;
            return $existingSnapshot;
        }

        // 1. Calculate Total Units and Total Lab Fees from enrolled subjects
        $totalUnits = 0.00;
        $totalLabFee = 0.00;
        foreach ($schedule as $sub) {
            $lec = (float)($sub['lecture_units'] ?? $sub['lectureUnits'] ?? $sub['units'] ?? 0);
            $lab = (float)($sub['lab_units'] ?? $sub['labUnits'] ?? 0);
            $totalUnits += ($lec + $lab);
            
            $labFee = (float)($sub['lab_fee'] ?? $sub['labFee'] ?? 0.00);
            $totalLabFee += $labFee;
        }

        // 2. Query Authoritative Fee Schedule from MariaDB
        // Fetch explicit Per-Unit Tuition Rate first
        $tuitionStmt = $pdo->query("
            SELECT `amount` FROM `fee_schedule` 
            WHERE `per_unit` = 1 AND UPPER(`type`) = 'TUITION' 
            ORDER BY `id` ASC LIMIT 1
        ");
        $tuitionRow = $tuitionStmt ? $tuitionStmt->fetch(PDO::FETCH_ASSOC) : null;

        if (!$tuitionRow) {
            // Fallback lookup: Any row marked per_unit = 1
            $fallbackTuition = $pdo->query("SELECT `amount` FROM `fee_schedule` WHERE `per_unit` = 1 ORDER BY `id` ASC LIMIT 1");
            $tuitionRow = $fallbackTuition ? $fallbackTuition->fetch(PDO::FETCH_ASSOC) : null;
        }

        if (!$tuitionRow) {
            throw new Exception("Unable to calculate assessment: Tuition rate per unit is not configured in fee schedule.");
        }

        $tuitionRate = (float)$tuitionRow['amount'];

        // Query Flat Institutional Fees
        $allFeesStmt = $pdo->query("SELECT * FROM `fee_schedule` ORDER BY `id` ASC");
        $allFees = $allFeesStmt ? $allFeesStmt->fetchAll(PDO::FETCH_ASSOC) : [];

        $miscFee = 0.00;
        $lmsFee = 0.00;
        $omrFee = 0.00;
        $nstpFee = 0.00;

        $nstpType = strtoupper(trim($nstp));
        $hasNstp = ($nstpType !== 'NONE' && $nstpType !== 'N/A' && $nstpType !== '');

        foreach ($allFees as $f) {
            $fType  = strtoupper(trim($f['type']));
            $fLabel = strtoupper(trim($f['label']));
            $fAmt   = (float)$f['amount'];

            if ($fType === 'MISCELLANEOUS' && (int)$f['per_unit'] === 0) {
                $miscFee += $fAmt;
            } elseif ($fLabel === 'LMS' || $fLabel === 'LMS FEE') {
                $lmsFee = $fAmt;
            } elseif ($fLabel === 'OMR' || $fLabel === 'OMR FEE') {
                $omrFee = $fAmt;
            } elseif ($fLabel === 'NSTP' || $fLabel === 'NSTP FEE' || $fLabel === 'NSTP/ROTC') {
                if ($hasNstp) {
                    $nstpFee = $fAmt;
                }
            }
        }

        // 3. Compute Itemized Totals with Explicit Financial Rounding (DECIMAL(10,2))
        $tuitionFee     = round($totalUnits * $tuitionRate, 2);
        $discountAmount = max(0.00, round($discount, 2));

        $cashTotal = round($tuitionFee + $totalLabFee + $miscFee + $lmsFee + $omrFee + $nstpFee - $discountAmount, 2);
        if ($cashTotal < 0) $cashTotal = 0.00;

        // Centralized Institutional Installment Surcharge (8%)
        $installmentRate   = 0.08;
        $installmentCharge = round($cashTotal * $installmentRate, 2);
        $installmentTotal  = round($cashTotal + $installmentCharge, 2);

        return [
            'totalUnits'        => number_format($totalUnits, 2, '.', ''),
            'rawTotalUnits'     => $totalUnits,
            'tuitionRate'       => $tuitionRate,
            'tuitionFee'        => $tuitionFee,
            'totalLabFee'       => $totalLabFee,
            'miscFee'           => $miscFee,
            'lmsFee'            => $lmsFee,
            'nstpFee'           => $nstpFee,
            'omrFee'            => $omrFee,
            'discount'          => $discountAmount,
            'cashTotal'         => $cashTotal,
            'installmentRate'   => $installmentRate,
            'installmentCharge' => $installmentCharge,
            'installmentTotal'  => $installmentTotal,
            'createdAt'         => date('Y-m-d H:i:s'),
            'isSnapshot'        => false
        ];
    }

    /**
     * Calculates payment balance and financial status deterministically supporting multiple payment transactions and voiding.
     * 
     * @param float $cashTotal Total assessment amount
     * @param array|float $paymentData Payment records array or single numeric payment amount
     * @return array Balance, total paid, remaining balance, and financial status
     */
    public static function calculateBalance(float $cashTotal, $paymentData = []): array {
        $cashTotal = max(0.00, round($cashTotal, 2));
        $totalPaid = 0.00;
        $validPayments = [];

        if (is_numeric($paymentData)) {
            $totalPaid = max(0.00, round((float)$paymentData, 2));
        } elseif (is_array($paymentData)) {
            // Check if paymentData has a 'payments' list or is a single payment object
            $paymentsList = isset($paymentData['payments']) && is_array($paymentData['payments']) 
                ? $paymentData['payments'] 
                : (isset($paymentData['amountPaid']) ? [$paymentData] : []);

            foreach ($paymentsList as $p) {
                $pStatus = strtoupper(trim($p['status'] ?? 'PAID'));
                if ($pStatus !== 'VOIDED' && $pStatus !== 'CANCELLED') {
                    $amt = (float)($p['amountPaid'] ?? $p['amount'] ?? 0.00);
                    $totalPaid += max(0.00, round($amt, 2));
                    $validPayments[] = $p;
                }
            }
        }

        $balance = round($cashTotal - $totalPaid, 2);
        
        $status = 'UNPAID';
        if ($totalPaid >= $cashTotal && $cashTotal > 0) {
            $status = 'PAID';
            $balance = 0.00;
        } elseif ($totalPaid > 0 && $totalPaid < $cashTotal) {
            $status = 'PARTIALLY_PAID';
        }

        return [
            'cashTotal'     => $cashTotal,
            'totalPaid'     => $totalPaid,
            'amountPaid'    => $totalPaid,
            'balance'       => max(0.00, $balance),
            'status'        => $status,
            'validPayments' => $validPayments
        ];
    }
}
