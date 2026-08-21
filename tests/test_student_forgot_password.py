"""
Test Student Portal Dedicated Forgot Password & Recovery Flow (Personal Email & School Email Support)
"""
import requests
import json
import subprocess
import time

BASE_URL = "http://localhost/systemtest"

def run_test():
    print("=" * 60)
    print("  GNCP STUDENT FORGOT PASSWORD & DUAL-EMAIL VERIFICATION")
    print("=" * 60)

    # 1. Look up an existing student in DB
    cmd = 'C:\\xampp\\mysql\\bin\\mysql.exe -u root gncp_portal -e "SELECT id, name, email, personal_info FROM students LIMIT 1;"'
    out = subprocess.check_output(cmd, shell=True).decode()
    print("Database Student Sample:\n", out)

    # Fetch first active student
    lines = [l.strip() for l in out.strip().split('\n') if l.strip()]
    if len(lines) < 2:
        print("[FAIL] No students in DB to test.")
        return

    fields = lines[1].split('\t')
    student_id = fields[0]
    student_name = fields[1]
    school_email = fields[2]
    personal_email = "student.test.recovery@gmail.com"

    # Ensure personal_info has a valid personal email
    update_cmd = f"""C:\\xampp\\mysql\\bin\\mysql.exe -u root gncp_portal -e "UPDATE students SET personal_info = JSON_SET(COALESCE(NULLIF(personal_info, ''), '{{}}'), '$.email', '{personal_email}') WHERE id = '{student_id}';" """
    subprocess.check_call(update_cmd, shell=True)

    # ── TEST SCENARIO A: Request via Student ID (dispatches to Personal Email) ──
    print("\n--- Scenario A: Request via Student ID ---")
    url = f"{BASE_URL}/student-portal/backend/api.php?action=request_password_reset"
    payload_a = {"identifier": student_id}
    res_a = requests.post(url, json=payload_a)
    print("A1. Request via ID Response:", res_a.status_code, res_a.text)
    assert res_a.status_code == 200, f"Expected 200, got {res_a.status_code}"
    data_a = res_a.json()
    assert data_a.get("success") is True
    assert data_a["data"]["targetEmail"] == personal_email
    print("  [PASS] Successfully routed OTP to personal email for Student ID lookup")

    # ── TEST SCENARIO B: Request via School Email (dispatches to School Email) ──
    print("\n--- Scenario B: Request via School Institutional Email ---")
    payload_b = {"identifier": school_email}
    res_b = requests.post(url, json=payload_b)
    print("B1. Request via School Email Response:", res_b.status_code, res_b.text)
    assert res_b.status_code == 200, f"Expected 200, got {res_b.status_code}"
    data_b = res_b.json()
    assert data_b.get("success") is True
    assert data_b["data"]["targetEmail"] == school_email
    print(f"  [PASS] Successfully routed OTP to school email ({school_email})")

    # ── TEST SCENARIO C: Verify OTP & Reset Password ──
    print("\n--- Scenario C: Reset Password using OTP ---")
    chk_cmd = f"""C:\\xampp\\mysql\\bin\\mysql.exe -u root gncp_portal -e "SELECT code FROM password_resets WHERE email = '{school_email}' ORDER BY id DESC LIMIT 1;" """
    code_out = subprocess.check_output(chk_cmd, shell=True).decode()
    code_lines = [l.strip() for l in code_out.strip().split('\n') if l.strip()]
    assert len(code_lines) >= 2, "No reset code found in password_resets"
    otp_code = code_lines[1]
    print(f"  [INFO] OTP Code in DB: {otp_code}")

    reset_url = f"{BASE_URL}/student-portal/backend/api.php?action=reset_password_with_code"
    new_password = "dualPassReset2026!"
    reset_payload = {
        "identifier": student_id,
        "code": otp_code,
        "newPassword": new_password
    }
    res2 = requests.post(reset_url, json=reset_payload)
    print("C1. Reset Password Response:", res2.status_code, res2.text)
    assert res2.status_code == 200
    assert res2.json().get("success") is True
    print("  [PASS] Password reset with OTP successful")

    # ── TEST SCENARIO D: Login with new password ──
    login_url = f"{BASE_URL}/student-portal/backend/api.php?action=login_student"
    login_payload = {
        "studentId": student_id,
        "password": new_password
    }
    res3 = requests.post(login_url, json=login_payload)
    print("D1. Login with New Password Response:", res3.status_code, res3.text)
    assert res3.status_code == 200
    assert res3.json().get("success") is True
    print("  [PASS] Student Login with New Password Verified")

    # Cleanup: restore default password
    restore_pass = "delacruz"
    restore_hash = subprocess.check_output(f'C:\\xampp\\php\\php.exe -r "echo password_hash(\'{restore_pass}\', PASSWORD_DEFAULT);"', shell=True).decode()
    subprocess.check_call(f"""C:\\xampp\\mysql\\bin\\mysql.exe -u root gncp_portal -e "UPDATE students SET password = '{restore_hash}' WHERE id = '{student_id}';" """, shell=True)
    print("  [PASS] Restored student default password")

    print("\n" + "=" * 60)
    print("  ALL SCENARIOS PASSED WITH PERFECT DUAL-EMAIL ROUTING!")
    print("=" * 60)

if __name__ == "__main__":
    run_test()
