"""Find DLL entries — check hash dirs without pathname (native plugins)."""
import tarfile

PKG = r"C:\Users\hu shu\Downloads\CubismSdkForUnity-5-r.5.unitypackage"

with tarfile.open(PKG, "r:gz") as tar:
    members = tar.getmembers()

    # Group by hash directory
    hash_dirs = {}
    for m in members:
        parts = m.name.split('/')
        if len(parts) >= 2:
            hash_dir = parts[1]  # ./hashdir/...
            if hash_dir not in hash_dirs:
                hash_dirs[hash_dir] = {'files': [], 'has_pathname': False, 'has_asset': False}
            filename = '/'.join(parts[2:])
            hash_dirs[hash_dir]['files'].append(filename)
            if filename == 'pathname':
                hash_dirs[hash_dir]['has_pathname'] = True
            if filename == 'asset':
                hash_dirs[hash_dir]['has_asset'] = True

    # Find entries with asset but no pathname (native plugins are stored this way)
    print("=== Entries with 'asset' but NO 'pathname' (potential native plugins) ===")
    count = 0
    for hd, info in hash_dirs.items():
        if info['has_asset'] and not info['has_pathname']:
            # Check asset size
            asset_path = f"./{hd}/asset"
            for m in members:
                if m.name == asset_path:
                    size = m.size
                    if size > 1000:  # Only show non-trivial files
                        count += 1
                        print(f"  {hd}  asset size={size:,} bytes")
    print(f"  Total: {count}")

    # Also check if there are entries with pathnames ending in .dll
    print("\n=== Entries with 'pathname' files ===")
    dll_count = 0
    for m in members:
        if m.name.endswith('/pathname'):
            content = tar.extractfile(m).read().decode('utf-8').strip()
            if '.dll' in content.lower() or '.so' in content.lower() or '.bundle' in content.lower():
                dll_count += 1
                print(f"  {content}")
                # Check the asset file
                hash_dir = m.name.rsplit('/', 2)[0]
                asset_path = f"{hash_dir}/asset"
                for am in members:
                    if am.name == asset_path:
                        print(f"    asset size: {am.size:,} bytes")
    if dll_count == 0:
        print("  NONE")
        print("\nSample pathnames:")
        sample = 0
        for m in members:
            if m.name.endswith('/pathname') and sample < 10:
                content = tar.extractfile(m).read().decode('utf-8').strip()
                print(f"  {content}")
                sample += 1
