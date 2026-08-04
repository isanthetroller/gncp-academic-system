import sys
import os
import threading
import time
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from fastapi import FastAPI, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from test_runner import SeleniumTestRunner
import config

app = FastAPI(title="GNCP Selenium Visual Test Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve Screenshots and UI Static Files
app.mount("/screenshots", StaticFiles(directory=config.SCREENSHOTS_DIR), name="screenshots")
UI_DIR = os.path.join(config.SELENIUM_DIR, "ui")
os.makedirs(UI_DIR, exist_ok=True)
app.mount("/ui", StaticFiles(directory=UI_DIR), name="ui")

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

def run_test_thread(headless=True):
    global STATE, current_runner
    STATE["status"] = "RUNNING"
    STATE["logs"] = []
    STATE["results"] = []
    STATE["start_time"] = time.time()

    def on_log(entry):
        STATE["logs"].append(entry)
        if entry.get("screenshot"):
            STATE["latest_screenshot"] = entry["screenshot"]

    runner = SeleniumTestRunner(headless=headless, callback=on_log)
    current_runner = runner
    success = runner.run_full_pipeline()
    
    STATE["results"] = runner.results
    STATE["duration"] = round(time.time() - STATE["start_time"], 2)
    STATE["status"] = "PASSED" if success else "FAILED"
    current_runner = None

@app.get("/", response_class=HTMLResponse)
def index():
    html_path = os.path.join(UI_DIR, "index.html")
    if os.path.exists(html_path):
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>GNCP Selenium Testing Server is Running</h1><p>Visit <a href='/ui/index.html'>/ui/index.html</a></p>"

@app.get("/api/status")
def get_status():
    if STATE["status"] == "RUNNING" and STATE.get("start_time"):
        STATE["duration"] = round(time.time() - STATE["start_time"], 2)
    return STATE

@app.post("/api/run-test")
def start_test(payload: dict = None, background_tasks: BackgroundTasks = None):
    global runner_thread
    if STATE["status"] == "RUNNING":
        return JSONResponse({"success": false, "message": "Test is already running."}, status_code=400)
    
    headless = payload.get("headless", True) if payload else True
    runner_thread = threading.Thread(target=run_test_thread, args=(headless,))
    runner_thread.daemon = True
    runner_thread.start()

    return {"success": True, "message": "Selenium Test Pipeline execution started."}

if __name__ == "__main__":
    print("Starting GNCP Selenium Visual Testing Dashboard Server on http://localhost:8090 ...")
    uvicorn.run(app, host="0.0.0.0", port=8090, log_level="warning")
