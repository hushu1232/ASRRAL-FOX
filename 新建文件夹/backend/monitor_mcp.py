import os, time

elog = os.path.join(os.environ['LOCALAPPDATA'], 'Tuanjie', 'Editor', 'Editor.log')
with open(elog, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()
print(f'Starting at line {len(lines)}')
start_lines = len(lines)

for i in range(12):
    time.sleep(5)
    with open(elog, 'r', encoding='utf-8', errors='ignore') as f:
        new_lines = f.readlines()
    if len(new_lines) > start_lines:
        for line in new_lines[start_lines:]:
            stripped = line.strip()
            if stripped and any(kw in stripped for kw in ['MCP', 'Bootstrap', 'Bridge', 'Compil', 'Error', 'error', 'Bootstrap']):
                print(stripped[:300])
        start_lines = len(new_lines)
    print(f'  [{5*(i+1)}s] line count: {start_lines}')

print(f'\nFinal line count: {start_lines}')
