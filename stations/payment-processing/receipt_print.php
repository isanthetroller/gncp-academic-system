<?php
require_once __DIR__ . '/../../shared/backend/config/database.php';
require_once __DIR__ . '/../../shared/backend/services/AssessmentService.php';

$ref = $_GET['ref'] ?? '';

if (empty($ref)) {
    die("<h1 style='font-family:sans-serif; text-align:center; margin-top:50px;'>Error: Student reference number is required.</h1>");
}

try {
    $pdo = Database::getInstance();

    // Check staff session for security
    session_start();
    $isLoggedInStaff = false;
    $storedUser = $_SESSION['gncp_station_user'] ?? $_SESSION['gncp_admin_user'] ?? '';
    if ($storedUser) {
        $user = json_decode($storedUser, true);
        if (in_array($user['role'] ?? '', ['CASHIER', 'REGISTRAR', 'ADMIN', 'SUPER_ADMIN'])) {
            $isLoggedInStaff = true;
        }
    }

    if (!$isLoggedInStaff) {
        // Also allow access if we have a temporary session token or bypass for direct verification if needed, 
        // but for security Cashier must be logged in. We'll show access denied if not.
        die("<h1 style='font-family:sans-serif; text-align:center; margin-top:50px;'>Error: Access Denied. Cashier authorization required.</h1>");
    }

    // Retrieve pre-enrollment details
    $stmt = $pdo->prepare("
        SELECT p.*, pr.name as program_name, ap.semester as ap_semester
        FROM `pre_enrollments` p
        LEFT JOIN `programs` pr ON p.course_code = pr.code
        LEFT JOIN `academic_periods` ap ON ap.status = 'Active'
        WHERE p.temp_student_id = :ref
    ");
    $stmt->execute(['ref' => $ref]);
    $student = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$student) {
        // Fallback: search in the permanent students table (after promotion)
        $stmt = $pdo->prepare("
            SELECT s.*, pr.name as program_name, ap.semester as ap_semester
            FROM `students` s
            LEFT JOIN `programs` pr ON s.program = pr.code
            LEFT JOIN `academic_periods` ap ON ap.status = 'Active'
            WHERE s.id = :ref_id OR s.temp_reference_no = :ref_temp
        ");
        $stmt->execute(['ref_id' => $ref, 'ref_temp' => $ref]);
        $permStudent = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($permStudent) {
            $personal = json_decode($permStudent['personal_info'] ?? '{}', true);
            $enrollment = json_decode($permStudent['enrollment_data'] ?? '{}', true);
            $payment = json_decode($permStudent['payment_data'] ?? '{}', true);
            
            $student = [
                'temp_student_id' => $permStudent['temp_reference_no'] ?: $permStudent['id'],
                'first_name' => $personal['firstName'] ?? '',
                'middle_name' => $personal['middleName'] ?? '',
                'last_name' => $personal['lastName'] ?? '',
                'course_code' => $permStudent['program'],
                'program_name' => $permStudent['program_name'],
                'ap_semester' => $permStudent['ap_semester'],
                'address' => $personal['address'] ?? '',
                'phone' => $personal['phone'] ?? '',
                'gender' => $personal['gender'] ?? '',
                'temp_pin' => $enrollment['temp_pin'] ?? '',
                'section_code' => $enrollment['assignedSection'] ?? $permStudent['section_code'] ?? '',
                'or_number' => $payment['orNumber'] ?? $permStudent['or_number'] ?? '',
                'payment_mode' => $payment['paymentType'] ?? $permStudent['payment_mode'] ?? 'Cash',
                'enrolled_at' => $permStudent['enrolled_at'] ?? null,
                'helpdesk_data' => $permStudent['helpdesk_data'],
                'scholarship_data' => $permStudent['scholarship_data'],
                'payment_data' => $permStudent['payment_data'],
                'student_type' => $permStudent['year_level']
            ];
        }
    }

    if (!$student) {
        die("<h1 style='font-family:sans-serif; text-align:center; margin-top:50px;'>Error: Student record not found.</h1>");
    }

    // Decode JSON payment details
    $payment = json_decode($student['payment_data'] ?? '{}', true);
    $helpdesk = json_decode($student['helpdesk_data'] ?? '{}', true);
    $advisedSubjects = $helpdesk['advisedSubjects'] ?? [];

    // Calculate fee assessment and payment balance via authoritative AssessmentService
    $nstpType = strtoupper($student['nstp'] ?? 'NONE');
    $scholarshipData = json_decode($student['scholarship_data'] ?? '{}', true);
    $discount = (float)($scholarshipData['discount'] ?? 0.00);
    $snapshot = $payment['assessmentSnapshot'] ?? null;

    $assessment = AssessmentService::calculateAssessment($pdo, $advisedSubjects, $nstpType, $discount, $snapshot);

    $tuitionRate = $assessment['tuitionRate'];
    $tuitionFee  = $assessment['tuitionFee'];
    $totalLabFee = $assessment['totalLabFee'];
    $miscFee     = $assessment['miscFee'];
    $lmsFee      = $assessment['lmsFee'];
    $nstpFee     = $assessment['nstpFee'];
    $omrFee      = $assessment['omrFee'];
    $cashTotal   = $assessment['cashTotal'];
    $totalUnits  = (float)$assessment['totalUnits'];

    $rawPaid = isset($payment['amountPaid']) ? (float)$payment['amountPaid'] : $cashTotal;
    $balInfo = AssessmentService::calculateBalance($cashTotal, $rawPaid);

    $amountPaid  = $balInfo['amountPaid'];
    $balance     = $balInfo['balance'];
    $paymentMode = $payment['paymentType'] ?? $student['payment_mode'] ?? 'Cash';
    $txnRef      = $payment['transactionRef'] ?? 'TXN-' . rand(100000, 999999);

} catch (Exception $e) {
    die("<h1 style='font-family:sans-serif; text-align:center; margin-top:50px;'>Database error: " . $e->getMessage() . "</h1>");
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Official Receipt - <?php echo htmlspecialchars($student['or_number']); ?></title>
    <style>
        body {
            font-family: 'Courier New', Courier, monospace;
            color: #000;
            background-color: #fff;
            margin: 0;
            padding: 20px;
            font-size: 12px;
            line-height: 1.4;
        }
        .receipt-box {
            width: 100%;
            max-width: 320px;
            margin: 0 auto;
            border: 1px solid #ccc;
            padding: 15px;
        }
        .header {
            text-align: center;
            margin-bottom: 15px;
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
        }
        .school-name {
            font-weight: bold;
            font-size: 14px;
        }
        .title {
            text-transform: uppercase;
            font-weight: bold;
            margin-top: 5px;
        }
        .meta-section {
            margin-bottom: 12px;
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
        }
        .meta-row {
            display: flex;
            justify-content: space-between;
        }
        .meta-label {
            color: #444;
        }
        .meta-value {
            font-weight: bold;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
        }
        .items-table th, .items-table td {
            padding: 4px 0;
            text-align: left;
        }
        .items-table th {
            border-bottom: 1px solid #000;
            font-weight: bold;
        }
        .text-right {
            text-align: right !important;
        }
        .total-section {
            border-top: 1px dashed #000;
            padding-top: 8px;
            margin-bottom: 15px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
        }
        .total-grand {
            font-weight: bold;
            font-size: 13px;
            border-top: 1px solid #000;
            margin-top: 4px;
            padding-top: 4px;
        }
        .footer {
            text-align: center;
            font-size: 10px;
            margin-top: 15px;
            border-top: 1px dashed #000;
            padding-top: 8px;
        }
        .stamp-area {
            border: 2px solid #000;
            padding: 10px;
            text-align: center;
            font-weight: bold;
            margin-top: 15px;
            text-transform: uppercase;
            color: #008000;
            border-color: #008000;
        }
        .print-btn-container {
            text-align: center;
            margin-bottom: 15px;
        }
        .btn-print {
            background-color: #28a745;
            color: #fff;
            border: none;
            padding: 6px 15px;
            font-size: 12px;
            font-weight: bold;
            cursor: pointer;
            border-radius: 4px;
        }
        @media print {
            .print-btn-container {
                display: none;
            }
            .receipt-box {
                border: none;
                padding: 0;
            }
        }
    </style>
</head>
<body>

<div class="print-btn-container">
    <button class="btn-print" onclick="window.print()">Print Receipt</button>
</div>

<div class="receipt-box">
    <div class="header">
        <span class="school-name">GNCP ACADEMIC PORTAL</span><br>
        <span class="title">Official Receipt</span><br>
        <span style="font-size: 10px; font-family: monospace;">OR No: <?php echo htmlspecialchars($student['or_number'] ?: 'PENDING'); ?></span>
    </div>

    <div class="meta-section">
        <div class="meta-row">
            <span class="meta-label">Student No:</span>
            <span class="meta-value"><?php echo htmlspecialchars($student['temp_student_id']); ?></span>
        </div>
        <div class="meta-row">
            <span class="meta-label">Student:</span>
            <span class="meta-value"><?php echo htmlspecialchars($student['last_name'] . ', ' . $student['first_name']); ?></span>
        </div>
        <div class="meta-row">
            <span class="meta-label">Program:</span>
            <span class="meta-value"><?php echo htmlspecialchars($student['course_code']); ?></span>
        </div>
        <div class="meta-row">
            <span class="meta-label">Date:</span>
            <span class="meta-value"><?php echo date('d/m/Y h:i A', strtotime($student['enrolled_at'] ?: 'now')); ?></span>
        </div>
    </div>

    <table class="items-table">
        <thead>
            <tr>
                <th>Description</th>
                <th class="text-right">Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Tuition Fee (<?php echo $totalUnits; ?> Units)</td>
                <td class="text-right"><?php echo number_format($tuitionFee, 2); ?></td>
            </tr>
            <tr>
                <td>Laboratory Fee</td>
                <td class="text-right"><?php echo number_format($totalLabFee, 2); ?></td>
            </tr>
            <tr>
                <td>Miscellaneous Fee</td>
                <td class="text-right"><?php echo number_format($miscFee, 2); ?></td>
            </tr>
            <tr>
                <td>LMS Fee</td>
                <td class="text-right"><?php echo number_format($lmsFee, 2); ?></td>
            </tr>
            <tr>
                <td>OMR Fee</td>
                <td class="text-right"><?php echo number_format($omrFee, 2); ?></td>
            </tr>
            <?php if ($discount > 0): ?>
            <tr style="color: #c00;">
                <td>Scholarship Discount</td>
                <td class="text-right">-<?php echo number_format($discount, 2); ?></td>
            </tr>
            <?php endif; ?>
        </tbody>
    </table>

    <div class="total-section">
        <div class="total-row">
            <span>TOTAL ASSESSMENT:</span>
            <span style="font-weight: bold;"><?php echo number_format($cashTotal, 2); ?></span>
        </div>
        <div class="total-row">
            <span>AMOUNT PAID:</span>
            <span style="font-weight: bold;"><?php echo number_format($amountPaid, 2); ?></span>
        </div>
        <div class="total-row total-grand">
            <span>BALANCE DUE:</span>
            <span>₱ <?php echo number_format($balance, 2); ?></span>
        </div>
    </div>

    <div class="meta-section" style="border-top: 1px dashed #000; padding-top: 8px;">
        <div class="meta-row">
            <span class="meta-label">Payment Mode:</span>
            <span class="meta-value"><?php echo htmlspecialchars($paymentMode); ?></span>
        </div>
        <div class="meta-row">
            <span class="meta-label">Ref Code:</span>
            <span class="meta-value" style="font-family: monospace;"><?php echo htmlspecialchars($txnRef); ?></span>
        </div>
    </div>

    <div class="stamp-area">
        PAID ENROLLED
        <div style="font-size: 9px; font-weight: normal; margin-top: 3px; font-family: monospace;">
            Cashier: <?php echo htmlspecialchars($student['cashier_name'] ?: 'sbaltazar3'); ?>
        </div>
    </div>

    <div class="footer">
        Thank you for your payment.<br>
        GNCP Academic Administration
    </div>
</div>

<script>
    window.onload = function() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('autoprint') === 'true') {
            window.print();
        }
    }
</script>
</body>
</html>
