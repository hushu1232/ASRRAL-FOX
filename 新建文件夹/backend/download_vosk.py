"""Download Vosk model with progress and retry support."""
import urllib.request
import zipfile
import os
import sys
import time

URL = "https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEST_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "AstralFox", "Assets", "StreamingAssets", "vosk-model"))
TMP_FILE = os.path.join(os.environ.get("TEMP", "/tmp"), "vosk-model-small-cn-0.22.zip")

MAX_RETRIES = 3

def download_with_progress(url, dest):
    for attempt in range(MAX_RETRIES):
        try:
            print(f"Downloading {url}")
            print(f"Attempt {attempt + 1}/{MAX_RETRIES}")

            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0"
            })

            with urllib.request.urlopen(req, timeout=60) as resp:
                total = int(resp.headers.get("Content-Length", 0))
                downloaded = 0
                block_size = 1024 * 128  # 128KB

                with open(dest, "wb") as f:
                    while True:
                        chunk = resp.read(block_size)
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total > 0:
                            percent = downloaded * 100 / total
                            mb_done = downloaded / (1024 * 1024)
                            mb_total = total / (1024 * 1024)
                            print(f"\r  {mb_done:.1f}/{mb_total:.1f} MB ({percent:.0f}%)", end="")

                print()
                print(f"Download complete: {downloaded} bytes")
                return True

        except Exception as e:
            print(f"\nError: {e}")
            if attempt < MAX_RETRIES - 1:
                wait = (attempt + 1) * 5
                print(f"Retrying in {wait}s...")
                time.sleep(wait)
            else:
                print("Max retries reached.")
                return False

def extract_zip(zip_path, dest):
    print(f"Extracting to {dest}...")
    os.makedirs(dest, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        total = len(zf.namelist())
        for i, name in enumerate(zf.namelist()):
            zf.extract(name, dest)
            if i % 50 == 0:
                print(f"\r  {i}/{total} files", end="")
    print(f"\r  {total}/{total} files extracted.")
    print("Extraction complete.")

def verify(dest):
    model_dir = os.path.join(dest, "vosk-model-small-cn-0.22")
    checks = [
        os.path.join(model_dir, "am", "final.mdl"),
        os.path.join(model_dir, "conf", "model.conf"),
        os.path.join(model_dir, "conf", "mfcc.conf"),
        os.path.join(model_dir, "graph", "HCLr.fst"),
    ]
    all_ok = True
    for path in checks:
        exists = os.path.exists(path)
        status = "OK" if exists else "MISSING"
        if not exists:
            all_ok = False
        print(f"  {status}: {os.path.relpath(path, dest)}")

    if all_ok:
        # Count all files
        count = sum(1 for _ in os.walk(model_dir) for __ in _[2])
        print(f"\nModel verified: {count} files in {model_dir}")
    else:
        print("\nWARNING: Some files are missing!")
    return all_ok

if __name__ == "__main__":
    print("=== Vosk Model Download ===")
    print(f"URL: {URL}")
    print(f"Temp: {TMP_FILE}")
    print(f"Dest: {DEST_DIR}")
    print()

    if not download_with_progress(URL, TMP_FILE):
        print("Download failed!")
        sys.exit(1)

    extract_zip(TMP_FILE, DEST_DIR)

    # Clean up temp file
    try:
        os.remove(TMP_FILE)
        print("Temp file cleaned up.")
    except:
        pass

    print()
    if verify(DEST_DIR):
        print("Vosk model ready!")
    else:
        print("Verification failed — check the output above.")
        sys.exit(1)
