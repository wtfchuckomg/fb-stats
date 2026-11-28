"""What the small shared-link pages (g/, p/, pv/) need so search engines can read them.

People who open one of these pages go straight on to the app. Search engines stay on the page and read it, so
the page carries its own heading and links (Chuck, 2026-11-27: get the site into Google). There is no instant
meta refresh any more: Google treats that as a redirect and skips the page for the app screen, which has
nothing to read until the data loads. Link-preview scrapers never ran the script, so they see what they saw.
"""
import html, json

SITE = 'https://stats.kansasmediarankings.com'
CRAWLERS = ('googlebot|google-inspectiontool|storebot-google|adsbot-google|bingbot|duckduckbot|yandexbot|baiduspider'
            '|applebot|slurp|facebookexternalhit|twitterbot|linkedinbot|discordbot|slackbot')


def go_script(go, keep_query=False):
    """The script that sends a person on to the app. keep_query passes the page's own ?… along (game links)."""
    dest = json.dumps(go) + (" + (location.search ? '&' + location.search.slice(1) : '')" if keep_query else '')
    return f'<script>if (!/{CRAWLERS}/i.test(navigator.userAgent)) location.replace({dest});</script>'


def team_link(name):
    return f'<a href="/?team={html.escape(name.replace(" ", "%20"), quote=True)}">{html.escape(name)}</a>'


def body(title, lines=(), link=None, teams=()):
    """title: the page's heading. lines: plain lines under it. link: (href, text) into the app. teams: school names."""
    out = [f'<h1>{title}</h1>'] + [f'<p>{html.escape(x)}</p>' for x in lines if x]
    if link: out.append(f'<p><a href="{link[0]}">{html.escape(link[1])}</a></p>')
    if teams: out.append('<p>' + ' · '.join(team_link(t) for t in teams if t) + '</p>')
    out.append(f'<p><a href="/">Kansas Media Stats</a> · Kansas high school football scores, stats and play-by-play</p>')
    return '<body>' + ''.join(out) + '</body>'
