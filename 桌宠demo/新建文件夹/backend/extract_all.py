"""Extract ALL files from Cubism unitypackage to Unity project."""
import tarfile
import os
import io

PKG = r"C:\Users\hu shu\Downloads\CubismSdkForUnity-5-r.5.unitypackage"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "AstralFox", "Assets"))

# Remove existing Live2D
import shutil
live2d_path = os.path.join(DEST, "Live2D")
if os.path.exists(live2d_path):
    shutil.rmtree(live2d_path)
    live2d_meta = live2d_path + ".meta"
    if os.path.exists(live2d_meta):
        os.remove(live2d_meta)

os.makedirs(DEST, exist_ok=True)

with tarfile.open(PKG, "r:gz") as tar:
    members = tar.getmembers()

    # Build path map: hash_dir -> original path
    path_map = {}
    for m in members:
        if m.name.endswith('/pathname'):
            content = tar.extractfile(m).read().decode('utf-8').strip()
            hash_dir = m.name.rsplit('/', 1)[0]
            path_map[hash_dir] = content

    extracted = 0
    skipped = 0

    for hash_dir, orig_path in path_map.items():
        asset_path = f"{hash_dir}/asset"
        meta_src_path = f"{hash_dir}/asset.meta"

        # Check asset exists
        asset_member = None
        for m in members:
            if m.name == asset_path:
                asset_member = m
                break

        if not asset_member:
            continue

        # Read asset data
        raw = tar.extractfile(asset_member).read()

        # Determine if this is a binary asset or C# source
        ext = os.path.splitext(orig_path)[1].lower()

        # For DLLs and other binaries: check PE/ELF/Mach-O signatures
        if ext in ('.dll', '.bundle', '.so', '.a'):
            KNOWN = {
                b'MZ': (0, 'PE'),
                b'\x7fELF': (0, 'ELF'),
                b'\xca\xfe\xba\xbe': (0, 'Mach-O'),
                b'\xfe\xed\xfa\xce': (0, 'Mach-O'),
                b'\xfe\xed\xfa\xcf': (0, 'Mach-O'),
                b'\xce\xfa\xed\xfe': (0, 'Mach-O'),
                b'\xcf\xfa\xed\xfe': (0, 'Mach-O'),
                b'!\x3c\x61\x72\x63\x68\x3e': (0, 'ar archive'),
            }
            data = None
            for sig, (offset, fmt) in KNOWN.items():
                idx = raw.find(sig)
                if idx >= 0:
                    data = raw[idx:]
                    break
            if data is None and ext == '.dll':
                # Try treating raw as DLL
                if raw[:2] == b'MZ':
                    data = raw
            if data is None:
                print(f"  SKIP BINARY (no sig): {orig_path}")
                skipped += 1
                continue
        else:
            data = raw

        # Write file
        rel_path = orig_path[7:] if orig_path.startswith("Assets/") else orig_path
        dest_path = os.path.join(DEST, rel_path)
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)

        with open(dest_path, 'wb') as f:
            f.write(data)
        extracted += 1

        # Extract .meta file
        meta_member = None
        for m in members:
            if m.name == meta_src_path:
                meta_member = m
                break
        if meta_member:
            meta_data = tar.extractfile(meta_member).read()
            meta_dest = dest_path + ".meta"
            with open(meta_dest, 'wb') as f:
                f.write(meta_data)

print(f"Extracted: {extracted}, Skipped: {skipped}")
