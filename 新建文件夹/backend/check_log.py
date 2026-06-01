import os

# Check Editor-prev.log (from the first launch)
elog_prev = os.path.join(os.environ["LOCALAPPDATA"], "Tuanjie", "Editor", "Editor-prev.log")
with open(elog_prev, "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()
print(f"Editor-prev.log: {len(lines)} lines")
for line in lines[-30:]:
    print(line[:300], end="")
print()

# Also check Editor.log one more time
elog = os.path.join(os.environ["LOCALAPPDATA"], "Tuanjie", "Editor", "Editor.log")
with open(elog, "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()
print(f"\nEditor.log: {len(lines)} lines")
print("Last 10:")
for line in lines[-10:]:
    print(line[:300], end="")
