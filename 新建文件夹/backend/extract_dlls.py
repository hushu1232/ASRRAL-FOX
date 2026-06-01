"""Extract Cubism Core native DLLs from unitypackage to Unity project."""
import tarfile
import os

PKG = r"C:\Users\hu shu\Downloads\CubismSdkForUnity-5-r.5.unitypackage"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "AstralFox", "Assets"))

WANTED = {
    "Assets/Live2D/Cubism/Plugins/Windows/x86_64/Live2DCubismCore.dll": True,
    "Assets/Live2D/Cubism/Plugins/Windows/x86/Live2DCubismCore.dll": True,
    "Assets/Live2D/Cubism/Plugins/macOS/Live2DCubismCore.bundle": True,
    "Assets/Live2D/Cubism/Plugins/Android/arm64-v8a/libLive2DCubismCore.so": True,
    "Assets/Live2D/Cubism/Plugins/Android/x86_64/libLive2DCubismCore.so": True,
    "Assets/Live2D/Cubism/Plugins/Linux/x86_64/libLive2DCubismCore.so": True,
    "Assets/Live2D/Cubism/Plugins/iOS/Debug-iphoneos/libLive2DCubismCore.a": True,
    "Assets/Live2D/Cubism/Plugins/iOS/Release-iphoneos/libLive2DCubismCore.a": True,
}

KNOWN_SIGNATURES = {
    b'MZ': 'PE (Windows DLL)',
    b'\x7fELF': 'ELF (Linux/Android .so)',
    b'\xca\xfe\xba\xbe': 'Mach-O (macOS universal)',
    b'\xfe\xed\xfa\xce': 'Mach-O (macOS)',
    b'\xfe\xed\xfa\xcf': 'Mach-O (macOS 64-bit)',
    b'\xce\xfa\xed\xfe': 'Mach-O (macOS reverse)',
    b'\xcf\xfa\xed\xfe': 'Mach-O (macOS 64-bit reverse)',
    b'!\x3c\x61\x72\x63\x68\x3e': 'ar archive (iOS .a)',
}

print("Extracting Cubism Core native libraries...")
print()

with tarfile.open(PKG, "r:gz") as tar:
    members = tar.getmembers()

    path_map = {}
    for m in members:
        if m.name.endswith('/pathname'):
            content = tar.extractfile(m).read().decode('utf-8').strip()
            hash_dir = m.name.rsplit('/', 1)[0]
            path_map[hash_dir] = content
            path_map[content] = hash_dir

    for path, _ in WANTED.items():
        hash_dir = path_map.get(path)
        if not hash_dir:
            print(f"  NOT FOUND: {path}")
            continue

        asset_path = f"{hash_dir}/asset"
        asset_member = None
        for m in members:
            if m.name == asset_path:
                asset_member = m
                break

        if not asset_member:
            print(f"  NO ASSET: {path}")
            continue

        raw = tar.extractfile(asset_member).read()

        sig_found = None
        for sig, fmt in KNOWN_SIGNATURES.items():
            if raw[:len(sig)] == sig:
                sig_found = fmt
                dll_data = raw
                break
            if sig in raw:
                offset = raw.index(sig)
                sig_found = fmt
                dll_data = raw[offset:]
                break

        if not sig_found:
            print(f"  SKIP: {path}  first 20 bytes: {raw[:20].hex()}")
            continue

        rel_path = path[7:] if path.startswith("Assets/") else path
        dest_path = os.path.join(DEST, rel_path)
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        with open(dest_path, 'wb') as f:
            f.write(dll_data)

        kb_size = len(dll_data) / 1024
        print(f"  OK: {path}  ({kb_size:.1f} KB) [{sig_found}]")

print()
print("Checking .meta files...")
for path in WANTED:
    rel_path = path[7:] if path.startswith("Assets/") else path
    meta_path = rel_path + ".meta"
    dest_path = os.path.join(DEST, meta_path)
    if os.path.exists(dest_path):
        print(f"  META OK: {meta_path}")
    else:
        print(f"  META MISSING: {meta_path}")
