<?php
try {
    $pdo = new PDO('mysql:host=localhost;dbname=gncp_portal', 'root', '');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $pdo->query('SELECT temp_student_id, first_name, last_name, status, roadmap FROM pre_enrollments LIMIT 1');
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        echo "TempID: {$row['temp_student_id']} | Name: {$row['first_name']} {$row['last_name']} | Status: {$row['status']}\n";
        echo "Roadmap:\n";
        $roadmap = json_decode($row['roadmap'], true);
        echo json_encode($roadmap, JSON_PRETTY_PRINT) . "\n";
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
