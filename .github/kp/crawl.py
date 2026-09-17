#!/usr/bin/env python3
"""Every Kansas school's results, 2021 through this season, from KPreps team pages.

Writes kp/teams.json (name, id, slug, class) and kp/seasons/<slug>.json ({year: [games]}).
One page at a time with a pause between, so it is gentle on their site.
"""
import json, re, sys, time, urllib.request
from html import unescape
from pathlib import Path

HERE = Path(__file__).resolve().parent
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'}
CLASSES = ['6A', '5A', '4A', '3A', '2A', '1A', '8M-I', '8M-II', '6M']
import os
YEARS = [int(y) for y in os.environ.get('KP_YEARS', '2026,2025,2024,2023,2022,2021').split(',')]
PAUSE = .5

def get(url, tries=3):
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45).read().decode('utf-8', 'replace')
        except Exception as e:
            if i == tries - 1: raise
            time.sleep(2 + 2 * i)

def text(s):
    return unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', s))).strip()

def teams():
    out, seen = [], set()
    for cls in CLASSES:
        html = get(f'https://kpreps.com/kansas/teams/?class={cls}')
        for tid, slug in re.findall(r'football/\?id=(\d+)&t=([a-z0-9\-]+)', html):
            if slug in seen: continue
            seen.add(slug)
            out.append({'id': int(tid), 'slug': slug, 'class': cls})
        time.sleep(PAUSE)
    return out

def season(tid, slug, year, cur):
    url = (f'https://kpreps.com/kansas/teams/football/?id={tid}&t={slug}' if cur
           else f'https://kpreps.com/kansas/teams/football/archive.php?year={year}&id={tid}&t={slug}')
    html = get(url)
    name = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.S)
    rec = re.search(r'Overall Record:\s*([\d\-]+)', text(html))
    games = []
    for row in html.split('<div class="scheduleRow">')[1:]:
        d = re.search(r'scheduleDate">([^<]*)', row)
        o = re.search(r'scheduleOpp">(.*?)</div>', row, re.S)
        if not (d and o): continue
        raw = text(o.group(1))
        if raw.lower() in ('opponent', ''): continue
        where = 'away' if raw.startswith('@') else 'home' if raw.lower().startswith('vs') else 'neutral'
        opp = re.sub(r'^(@|vs\.?)\s*', '', raw).strip()
        oid = re.search(r'football/\?id=(\d+)&t=([a-z0-9\-]+)', row)
        r = re.search(r'scheduleResult">(.*?)</div>', row, re.S)
        rs = text(r.group(1)) if r else ''
        m = re.match(r'([WLT])\s*(\d+)\s*-\s*(\d+)', rs)
        g = {'date': (d.group(1) or '').strip(), 'opp': opp, 'at': where}
        if oid: g['oppSlug'] = oid.group(2)
        if m:
            g.update(res=m.group(1), us=int(m.group(2)), them=int(m.group(3)))
            if 'OT' in rs.split('|')[-1]: g['ot'] = 1
        games.append(g)
    return {'name': text(name.group(1)) if name else slug, 'record': rec.group(1) if rec else '', 'games': games}

def main():
    (HERE / 'seasons').mkdir(parents=True, exist_ok=True)
    tf = HERE / 'teams.json'
    ts = json.loads(tf.read_text()) if tf.exists() else teams()
    tf.write_text(json.dumps(ts, separators=(',', ':')))
    print(f'{len(ts)} teams', flush=True)
    for i, t in enumerate(ts, 1):
        out_path = HERE / 'seasons' / f"{t['slug']}.json"
        have = json.loads(out_path.read_text()) if out_path.exists() else {}
        for year in YEARS:
            # this season is read again every night; earlier ones only once
            if str(year) in have and have[str(year)].get('games') and year != YEARS[0]: continue
            try:
                have[str(year)] = season(t['id'], t['slug'], year, year == YEARS[0])
            except Exception as e:
                print(f"{t['slug']} {year}: {e}", flush=True)
            time.sleep(PAUSE)
        out_path.write_text(json.dumps(have, separators=(',', ':'), ensure_ascii=False))
        if i % 10 == 0: print(f'{i}/{len(ts)}', flush=True)

main()
