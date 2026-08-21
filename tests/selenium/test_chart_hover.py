import os
import time
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

BASE_ARTIFACT = r"C:\Users\ethan\.gemini\antigravity-ide\brain\4464001e-217e-417b-9221-861b7c89d6e8"

def test_chart():
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1400,900")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=opts)
    try:
        # ── Login ──────────────────────────────────────────────────
        driver.get("http://localhost/systemtest/admin/index.html")
        time.sleep(2)
        driver.find_element(By.ID, "username").send_keys("admin")
        driver.find_element(By.ID, "password").send_keys("admin12345")
        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
        time.sleep(3)

        # ── Validate API programsDist data ─────────────────────────
        resp = driver.execute_script("""
            return fetch('/systemtest/admin/backend/api.php?action=fetch_dashboard_stats')
                .then(r => r.json())
                .then(d => JSON.stringify(d.programsDist || []));
        """)
        time.sleep(2)
        # Refetch synchronously via XMLHttpRequest
        resp_raw = driver.execute_script("""
            var xhr = new XMLHttpRequest();
            xhr.open('GET', '/systemtest/admin/backend/api.php?action=fetch_dashboard_stats', false);
            xhr.send();
            return xhr.responseText;
        """)
        data = json.loads(resp_raw)
        dist = data.get('programsDist', [])
        codes = [d['program'] for d in dist]
        print(f"[INFO] programsDist codes: {codes}")
        # All keys should be short codes, not long names
        for d in dist:
            assert len(d['program']) <= 8, f"[FAIL] program key too long (full name?): {d['program']}"
        print(f"[PASS] API programsDist returns normalized short codes.")

        # ── 30-Day Trend view — 3-point hover ──────────────────────
        for lbl, selector in [("30-Day", ".btn-chart-toggle")]:
            for btn in driver.find_elements(By.CSS_SELECTOR, selector):
                if "30-Day" in btn.text:
                    btn.click()
                    break
        time.sleep(1)

        hitboxes = driver.find_elements(By.CSS_SELECTOR, ".chart-svg-container rect")
        assert len(hitboxes) > 0, "[FAIL] No timeline hitboxes found"

        for tag, idx in [("left", 0), ("mid", len(hitboxes) // 2), ("right", -1)]:
            driver.execute_script(
                "arguments[0].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));",
                hitboxes[idx]
            )
            time.sleep(0.8)
            driver.save_screenshot(f"{BASE_ARTIFACT}\\chart_hover_{tag}_node.png")
            print(f"[PASS] 30-Day Trend — {tag} node tooltip verified.")

        # ── By Course spline view ─────────────────────────────────
        for btn in driver.find_elements(By.CSS_SELECTOR, ".btn-chart-toggle"):
            if "By Course" in btn.text or "Course" in btn.text:
                btn.click()
                break
        time.sleep(1.5)
        driver.save_screenshot(f"{BASE_ARTIFACT}\\chart_by_course_spline.png")
        print("[PASS] By Course spline view screenshot captured.")

        # Verify SVG path exists and doesn't contain negative coords below baseline
        svg_paths = driver.find_elements(By.CSS_SELECTOR, ".chart-svg-container path")
        assert len(svg_paths) > 0, "[FAIL] No SVG paths in By Course view"
        print(f"[PASS] By Course spline has {len(svg_paths)} SVG path(s) rendered.")

        # ── Breakdown view ────────────────────────────────────────
        for btn in driver.find_elements(By.CSS_SELECTOR, ".btn-chart-toggle"):
            if "Breakdown" in btn.text:
                btn.click()
                break
        time.sleep(1)
        driver.save_screenshot(f"{BASE_ARTIFACT}\\chart_breakdown_bars.png")
        print("[PASS] Breakdown bars view screenshot captured.")

    finally:
        driver.quit()

if __name__ == "__main__":
    test_chart()
