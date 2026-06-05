"""Restart Tuanjie and wait for MCP connection."""
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
    try:
        os.remove(lockfile)
    except PermissionError:
        print("Lockfile in use (stale process?). Proceeding anyway...")
        pass

# Launch
print("Launching Tuanjie...")
proc = subprocess.Popen(
    [tuanjie_exe, "-projectPath", project_path,
     "-skipUpgradeDialogs", "-noUpmDialogs"],
    creationflags=subprocess.DETACHED_PROCESS,
)
print(f"PID: {proc.pid}")

# Monitor until MCP connected
start = time.time()
last_lines = 0
compiled_ok = False

while time.time() - start < 600:
    time.sleep(10)

    if proc.poll() is not None:
        print(f"Tuanjie exited with code {proc.returncode}")
        break

    try:
        with open(elog, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()

        if len(lines) > last_lines:
            for line in lines[last_lines:]:
                stripped = line.strip()
                if not stripped:
                    continue
                lower = stripped.lower()
                if any(kw in lower for kw in [
                    'error cs', 'tundra build', 'mcpbootstrap', 'bootstrap',
                    'bridge start', 'bridge started', 'mcpforunity',
                    'domain reload', 'refresh complet', 'compilation error',
                    'script compilation'
                ]):
                    print(stripped[:300])
            last_lines = len(lines)
    except Exception as e:
        print(f"Log error: {e}")

    # Check MCP
    try:
        req = urllib.request.urlopen("http://127.0.0.1:8080/api/instances", timeout=3)
        data = json.loads(req.read())
        instances = data.get("instances", [])
        if instances:
            print(f"\n*** UNITY CONNECTED TO MCP! Instances: {instances} ***")
            break
    except:
        pass

    elapsed = int(time.time() - start)
    print(f"  [{elapsed}s] log: {last_lines} lines, MCP: not connected")

print(f"Done. Total: {int(time.time()-start)}s, log: {last_lines} lines")
if proc.poll() is None:
    print("Tuanjie still running.")
