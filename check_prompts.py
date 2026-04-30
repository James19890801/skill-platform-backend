import json, sys, urllib.request

resp = urllib.request.urlopen('https://skill-platform-backend-production.up.railway.app/api/agents?limit=100')
data = json.load(resp)
items = data['data']['items']

missing = []
for a in items:
    sp = a.get('systemPrompt') or ''
    has = len(sp.strip()) > 10
    status = "[HAS]" if has else "[MISS]"
    if not has:
        missing.append(a)
    print(f'ID={a["id"]:3d} | {status} | name={a["name"]:30s} | prompt_len={len(sp)}')

print(f'\nTotal: {len(items)} agents')
print(f'Missing prompt: {len(missing)} agents')
for a in missing:
    print(f'  - ID={a["id"]}: {a["name"]} (skills={len(a.get("skills") or [])})')
