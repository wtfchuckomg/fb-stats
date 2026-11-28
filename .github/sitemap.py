"""sitemap.xml: every page of the stats site a search engine should know about.

Rebuilt by the nightly job. The game (g/) and player (p/) pages come from their folders, so a game or player
that gains a page shows up the next night; schools come from logos/teams.json, leagues from the side menu.
"""
import json, os
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://stats.kansasmediarankings.com'
VIEWS = ['?scores', '?state', '?stats', '?stats=team', '?statestats', '?standings', '?teams', '?matchup',
         '?brackets', '?brackets&view=streak', '?brackets&view=home', '?brackets&view=alltime', '?brackets&view=titles']
CLASSES = ['6A', '5A', '4A', '3A', '2A', '1A', '8M-I', '8M-II', '6M']
LEAGUES = ['big-east-league', 'cnc-league', 'centennial-league', 'central-kansas-league', 'central-plains-league',
           'eastern-kansas-league', 'flint-hills-league', 'frontier-league', 'great-west-activities-conference',
           'greater-wichita-athletic-league', 'heart-of-america', 'hi-plains-league', 'kaw-valley-conference',
           'meadowlark-conference', 'mid-continent-league', 'north-central-activities-association',
           'north-central-kansas-league', 'northeast-kansas-league', 'pioneer-league', 'south-central-border-league',
           'southeast-kansas-league', 'sunflower-league', 'three-rivers-league', 'tri-valley-league',
           'twin-valley-league', 'united-kansas-conference', 'western-athletic-conference']


def pages(folder):
    d = os.path.join(ROOT, folder)
    if not os.path.isdir(d): return []
    return sorted(f'/{folder}/{n}/' for n in os.listdir(d) if os.path.exists(os.path.join(d, n, 'index.html')))


def urls():
    out = ['/'] + ['/' + v for v in VIEWS] + [f'/?bracket={c}' for c in CLASSES] + [f'/?league={s}' for s in LEAGUES]
    teams = json.load(open(os.path.join(ROOT, 'logos', 'teams.json'), encoding='utf-8'))
    out += sorted({'/?team=' + t['name'].replace(' ', '%20') for t in teams if t.get('name')})
    return out + pages('g') + pages('p')


def main():
    u = urls()
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    xml += [f'<url><loc>{escape(SITE + x)}</loc></url>' for x in u]
    xml.append('</urlset>')
    open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8').write('\n'.join(xml) + '\n')
    print(f'sitemap: {len(u)} pages')


if __name__ == '__main__':
    main()
