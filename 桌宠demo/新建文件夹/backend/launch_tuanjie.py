"""Launch Tuanjie and wait for it to fully load, then verify MCP."""
import subprocess
import os
import time
import urllib.request
import json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
project_path = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "AstralFox"))
tuanjie_exe = r"C:\Program Files\Tuanjie\Hub\Editor\2022.3.61t11\Editor\Tuanjie.exe"
elog = os.path.join(os.environ["LOCALAPPDATA"], "Tuanjie", "Editor", "Editor.log")

# Clean lock
lockfile = os.path.join(project_path, "Temp", "TuanjieLockfile")
if os.path.exists(lockfile):
    os.remove(lockfile)
    print("Removed TuanjieLockfile")

# Launch
print("Launching Tuanjie...")
proc = subprocess.Popen(
    [tuanjie_exe, "-projectPath", project_path,
     "-skipUpgradeDialogs", "-noUpmDialogs"],
    creationflags=subprocess.DETACHED_PROCESS,
)
print(f"PID: {proc.pid}")

# Wait for log to grow beyond 84 lines (meaning editor is loading past splash)
print("Waiting for editor to load (checking log every 15s)...")
max_wait = 600  # 10 minutes max
start = time.time()
last_lines = 0
while time.time() - start < max_wait:
    time.sleep(15)

    # Check process alive
    if proc.poll() is not None:
        print(f"Tuanjie exited with code {proc.returncode}")
        break

    # Check log
    try:
        with open(elog, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
        if len(lines) != last_lines:
            print(f"  Log: {len(lines)} lines (+{len(lines) - last_lines})")
            for line in lines[last_lines:]:
                stripped = line.strip()
                if stripped:
                    print(f"    {stripped[:200]}")
            last_lines = len(lines)

            # Check for key milestones
            full_text = "".join(lines)
            if "Launching editor" in full_text or "Editor Update Check" in full_text:
                print("  >>> Editor application started!")
            if "Refresh completed" in full_text or "Compilation finished" in full_text:
                print("  >>> Compilation complete!")
            if "MCP for Unity" in full_text or "UnityMCP" in full_text:
                print("  >>> MCPForUnity detected!")
    except Exception as e:
        print(f"  Log read error: {e}")

    # Check MCP connection
    try:
        req = urllib.request.urlopen("http://127.0.0.1:8080/api/instances", timeout=3)
        data = json.loads(req.read())
        instances = data.get("instances", [])
        if instances:
            print(f"\n*** UNITY CONNECTED TO MCP! Instances: {instances} ***")
            break
    except:
        pass

    elapsed = time.time() - start
    print(f"  [{int(elapsed)}s] Waiting...")

print(f"\nTotal wait: {int(time.time() - start)}s")
if proc.poll() is None:
    print("Tuanjie is still running.")
