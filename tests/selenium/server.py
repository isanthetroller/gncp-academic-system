import sys
import os
import threading
import time
import importlib
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from fastapi import FastAPI, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

import test_runner as tr_module
import test_admin_features as taf_module
import config

app = FastAPI(title="GNCP Selenium Visual Test Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve Screenshots, Shared Assets, and UI Static Files
PROJECT_ROOT = os.path.abspath(os.path.join(config.SELENIUM_DIR, "..", ".."))
app.mount("/screenshots", StaticFiles(directory=config.SCREENSHOTS_DIR), name="screenshots")
if os.path.exists(os.path.join(PROJECT_ROOT, "shared")):
    app.mount("/shared", StaticFiles(directory=os.path.join(PROJECT_ROOT, "shared")), name="shared")
if os.path.exists(os.path.join(PROJECT_ROOT, "school-website")):
    app.mount("/school-website", StaticFiles(directory=os.path.join(PROJECT_ROOT, "school-website")), name="school-website")

UI_DIR = os.path.join(config.SELENIUM_DIR, "ui")
os.makedirs(UI_DIR, exist_ok=True)
app.mount("/ui", StaticFiles(directory=UI_DIR, html=True), name="ui")

@app.get("/")
@app.get("/ui")
def index_redirect():
    return RedirectResponse(url="/ui/index.html")

STATE = {
    "status": "IDLE", # IDLE, RUNNING, PASSED, FAILED
    "current_step": "",
    "logs": [],
    "results": [],
    "latest_screenshot": None,
    "start_time": None,
    "duration": 0
}

current_runner = None
runner_thread = None

def run_test_thread(headless=True, mode="all"):
    global STATE, current_runner
    STATE["status"] = "RUNNING"
    STATE["logs"] = []
    STATE["results"] = []
    STATE["start_time"] = time.time()

    def on_log(entry):
        STATE["logs"].append(entry)
        if entry.get("screenshot"):
            STATE["latest_screenshot"] = os.path.basename(entry["screenshot"])

    pipeline_success = True
    admin_success = True

    try:
        # Dynamically reload test modules so code updates take effect immediately
        importlib.reload(tr_module)
        importlib.reload(taf_module)
        SeleniumTestRunner = tr_module.SeleniumTestRunner
        AdminFeaturesSeleniumTestRunner = taf_module.AdminFeaturesSeleniumTestRunner

        # 1. Run 7-Step Enrollment Pipeline Suite
        if mode in ["all", "pipeline"]:
            runner = SeleniumTestRunner(headless=headless, callback=on_log)
            current_runner = runner
            pipeline_success = runner.run_full_pipeline()
            STATE["results"].extend(runner.results)

        # 2. Run Admin & System Features Suite
        if mode in ["all", "admin"]:
            admin_runner = AdminFeaturesSeleniumTestRunner(headless=headless, callback=on_log)
            current_runner = admin_runner
            try:
                admin_runner.run_all()
                admin_success = True
                STATE["results"].extend(admin_runner.results)
            except Exception as e:
                admin_success = False
                on_log({"timestamp": time.strftime("%H:%M:%S"), "level": "ERROR", "message": f"Admin Features Suite Failed: {str(e)}"})

        overall_success = pipeline_success and admin_success
        STATE["status"] = "PASSED" if overall_success else "FAILED"
    except Exception as exc:
        on_log({"timestamp": time.strftime("%H:%M:%S"), "level": "ERROR", "message": f"Test Execution System Error: {str(exc)}"})
        STATE["status"] = "FAILED"
    finally:
        STATE["duration"] = round(time.time() - STATE["start_time"], 2)
        if current_runner and hasattr(current_runner, 'driver') and current_runner.driver:
            try:
                current_runner.driver.quit()
            except Exception:
                pass
        current_runner = None

@app.get("/api/status")
def get_status():
    global runner_thread
    if STATE["status"] == "RUNNING":
        if runner_thread and not runner_thread.is_alive():
            STATE["status"] = "FAILED"
        elif STATE.get("start_time"):
            STATE["duration"] = round(time.time() - STATE["start_time"], 2)
    return STATE

@app.post("/api/run-test")
def start_test(payload: dict = None, background_tasks: BackgroundTasks = None):
    global runner_thread
    if STATE["status"] == "RUNNING" and runner_thread and runner_thread.is_alive():
        return JSONResponse({"success": False, "message": "Test is already running."}, status_code=400)
    
    headless = payload.get("headless", True) if payload else True
    mode = payload.get("mode", "all") if payload else "all"
    runner_thread = threading.Thread(target=run_test_thread, args=(headless, mode))
    runner_thread.daemon = True
    runner_thread.start()

    return {"success": True, "message": "Selenium Test Pipeline execution started."}

@app.post("/api/stop-test")
def stop_test():
    global current_runner, STATE
    if current_runner and hasattr(current_runner, 'driver') and current_runner.driver:
        try:
            current_runner.driver.quit()
        except Exception:
            pass
    STATE["status"] = "CANCELLED"
    STATE["logs"].append({"timestamp": time.strftime("%H:%M:%S"), "level": "WARN", "message": "Test execution manually cancelled by user."})
    return {"success": True, "message": "Test execution cancelled."}

@app.get("/api/screenshots")
def list_screenshots():
    try:
        files = [f for f in os.listdir(config.SCREENSHOTS_DIR) if f.endswith(('.png', '.jpg'))]
        files.sort(key=lambda x: os.path.getmtime(os.path.join(config.SCREENSHOTS_DIR, x)), reverse=True)
        return {"success": True, "screenshots": files}
    except Exception as e:
        return {"success": False, "screenshots": [], "error": str(e)}

@app.post("/api/clear-screenshots")
def clear_screenshots():
    try:
        count = 0
        if os.path.exists(config.SCREENSHOTS_DIR):
            for f in os.listdir(config.SCREENSHOTS_DIR):
                if f.endswith(('.png', '.jpg', '.jpeg')):
                    try:
                        os.remove(os.path.join(config.SCREENSHOTS_DIR, f))
                        count += 1
                    except Exception:
                        pass
        STATE["latest_screenshot"] = None
        return {"success": True, "message": f"Successfully deleted {count} screenshot(s).", "count": count}
    except Exception as e:
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)

if __name__ == "__main__":
    print("Starting GNCP Selenium Visual Testing Dashboard Server on http://localhost:8090 ...")
    uvicorn.run(app, host="0.0.0.0", port=8090, log_level="warning")
