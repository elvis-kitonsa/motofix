# MOTOFIX project website generator.
# Produces a self-contained static site (index.html + article pages + styles.css)
# that can be opened locally or hosted on any static host (Netlify, GitHub Pages, Vercel).
#
# To add a NEW article later: add an entry to ARTICLES below and re-run:  python build.py
import os, html

BASE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(BASE, "assets"), exist_ok=True)

SITE_NAME = "MOTOFIX Uganda"
LINKEDIN = "https://www.linkedin.com/company/motofix-uganda/"
YEAR = 2026

# ── Team ──────────────────────────────────────────────────────────────────────
# Each member: (name, role, initials, photo).
# `photo` is a filename in assets/ — leave it "" to fall back to the initials avatar.
TEAM = [
    ("Asiimire Patricia", "Backend Development", "PA", "patricia.jpeg"),
    ("Kitonsa Elvis",     "UI & Frontend Development", "EL", "kitonsa.jpeg"),
    ("Katuramu Edgar",    "Backend Development", "ED", "katuramu.jpeg"),
    ("Kizito Daniel Jr.", "Research & Team Coordination", "DA", "daniel.jpg"),
]

# ── Key features ──────────────────────────────────────────────────────────────
FEATURES = [
    ("\U0001F916", "AI Diagnosis (MOTOBOT)", "Describe the problem or snap a photo and our AI tells you what is likely wrong, repair-or-replace, and a fair cost range."),
    ("\U0001F4CD", "Smart Mechanic Matching", "Instantly matched with the nearest verified mechanic or tow provider who can handle your specific problem."),
    ("\U0001F5FA️", "Real-Time Tracking", "Watch your mechanic approach on a live map with an ETA that updates as they travel."),
    ("\U0001F4B3", "Transparent Pricing", "An up-front cost estimate and a clear quote before any work begins. Pay by Mobile Money or cash."),
    ("\U0001F527", "Spare Parts & Dealers", "Find the genuine parts your fix needs, with price guidance and trusted dealers in one place."),
    ("\U0001F6E1️", "Insurance Marketplace", "Compare cover from multiple insurers, apply for a policy and file claims — in a few taps."),
    ("⛽", "Fuel Station Finder", "Locate nearby fuel stations with directions when you are running low."),
    ("\U0001F514", "Maintenance Reminders", "Smart, due-aware reminders that keep your vehicle road-ready and help avoid breakdowns."),
]

STEPS = [
    ("Request help", "Open the app and tell MOTOFIX what is wrong — type it, speak it, or snap a photo."),
    ("Get matched", "The nearest verified mechanic or tow provider who fits your need is assigned in minutes."),
    ("Track them in", "Follow the mechanic on a live map with a real-time ETA until they reach you."),
    ("Fix & pay fairly", "See a clear price before the work, then pay by Mobile Money or cash. No surprises."),
]

# ── Screenshots (real app captures in assets/) ───────────────────────────────
IMG = {
    "home":          "5893283652760702902.jpg",  # driver home — "Car giving you trouble?"
    "locate":        "5893283652760702895.jpg",  # we need your location
    "located":       "5893283652760702892.jpg",  # location found
    "issue":         "5893283652760702903.jpg",  # what happened to your vehicle (issue grid)
    "motobot":       "5893283652760702894.jpg",  # MOTOBOT chat
    "cost":          "5893283652760702899.jpg",  # MOTOBOT cost estimate (repair vs replace)
    "dispatched":    "5893283652760702893.jpg",  # request dispatched
    "track":         "5893283652760702901.jpg",  # live tracking (5 min, 5.8km)
    "almost":        "5893283652760702906.jpg",  # mechanic almost there (2 min)
    "rate":          "5893283652760702900.jpg",  # rate your mechanic
    "parts":         "5893283652760702907.jpg",  # spare parts catalog
    "notify":        "5893283652760702905.jpg",  # notifications
}

# Home "See it in action" gallery — the driver's journey, in order.
GALLERY = [
    (IMG["locate"],     "Share your location"),
    (IMG["issue"],      "Pick what's wrong — or let AI decide"),
    (IMG["motobot"],    "Chat with MOTOBOT, the AI assistant"),
    (IMG["cost"],       "See a fair cost estimate up front"),
    (IMG["dispatched"], "Your request is dispatched"),
    (IMG["track"],      "Track your mechanic live"),
    (IMG["rate"],       "Rate the service afterwards"),
    (IMG["parts"],      "Order genuine spare parts"),
]

# Field-research photos — requirements gathering on the streets and in garages.
FIELD = [
    ("5893283652760702911.jpg", "Interviewing drivers and boda-boda riders about roadside breakdowns"),
    ("5893283652760702912.jpg", "Hearing first-hand how stranded motorists find help today"),
    ("5893283652760702913.jpg", "Talking with a roadside mechanic about common faults"),
    ("5893283652760702922.jpg", "Meeting a team of mechanics at a roadside garage"),
    ("5893283652760702915.jpg", "Learning the repair workflow at a professional garage"),
    ("5893283652760702917.jpg", "A mechanic walks us through an engine rebuild"),
    ("5893283652760702919.jpg", "Understanding diagnostics and parts first-hand"),
    ("5893283652760702916.jpg", "Touring a modern service workshop"),
    ("5893283652760702921.jpg", "Inside a busy service garage"),
]

# ── Articles ──────────────────────────────────────────────────────────────────
# Each block is ("h", text) heading, ("p", text) paragraph, or
# ("shot", (caption, image_filename_or_None)) image slot.
ARTICLES = [
    {
        "slug": "article-vision",
        "category": "Our Vision",
        "title": "MOTOFIX: Reimagining Roadside Assistance in Uganda",
        "author": "Asiimire Patricia",
        "excerpt": "Why we are building a faster, fairer, less stressful way to get help when your car lets you down.",
        "blocks": [
            ("p", "Every driver in Uganda knows the feeling. The car coughs, splutters and dies — maybe on the Northern Bypass, maybe far from town as night falls. You are stranded, you are not sure what is wrong, and you have no idea which mechanic to trust or what a fair price even looks like. For most people, roadside trouble is not just a mechanical problem; it is a moment of real anxiety."),
            ("p", "We built MOTOFIX to change that. MOTOFIX is a roadside assistance platform that connects stranded drivers with verified mechanics and tow providers in minutes — the same way a ride-hailing app connects you to a driver. Help is no longer a guessing game or a string of frantic phone calls. It is one tap away."),
            ("shot", ("The MOTOFIX driver app — roadside help in a few taps.", IMG["home"])),
            ("h", "Built for the way Ugandans actually drive"),
            ("p", "We did not copy a foreign app and hope it would fit. MOTOFIX is designed around our roads, our mechanics and our payment habits. You request help from the phone you already own. You pay the way you already pay — Mobile Money or cash. And the people who come to help are local, verified providers building their livelihoods through the platform."),
            ("p", "From the moment you request help, MOTOFIX guides you: an AI assistant helps describe the problem, the nearest qualified mechanic is matched to you, you watch them approach on a live map, and you see a fair price before any work begins. Every step is built to replace uncertainty with confidence."),
            ("shot", ("Describing the problem is simple — the app does the heavy lifting.", IMG["issue"])),
            ("h", "More than a tow truck — a whole ecosystem"),
            ("p", "MOTOFIX goes beyond a single rescue. Drivers can find genuine spare parts and trusted dealers, compare and apply for vehicle insurance, locate nearby fuel stations, and stay on top of routine maintenance with smart reminders. For mechanics, it is a steady stream of work and a fairer, more transparent way to earn."),
            ("p", "Our vision is simple: a Uganda where no driver is ever truly stranded, and where getting help is fast, fair and stress-free. We are just getting started."),
        ],
    },
    {
        "slug": "article-motobot",
        "category": "Engineering",
        "title": "Under the Hood: Building the MOTOFIX Apps",
        "author": "Kitonsa Elvis",
        "excerpt": "Three full applications, real-time maps, and a multimodal AI assistant — how the screens drivers and mechanics actually use were engineered.",
        "blocks": [
            ("p", "A good app makes hard things feel effortless — and that ease is the hardest part to build. Behind MOTOFIX's few simple taps sit three complete applications, engineered from the ground up: the driver app, the mechanic and tow-provider app, and the admin control room. I led the frontend across all three — designing and building the interfaces, the real-time experience, and the AI features inside them."),
            ("h", "Three apps, one product"),
            ("p", "Each app is a full React and TypeScript application, mobile-first and built for the phones Ugandans actually carry, with light and dark themes throughout. They are deliberately distinct — a stressed driver, a working mechanic and an admin need very different things — yet they share one design language, so MOTOFIX feels like a single, coherent product rather than three separate tools stitched together."),
            ("shot", ("The driver app — a calm, focused interface for a stressful moment.", IMG["home"])),
            ("h", "Help you can watch arrive"),
            ("p", "The live-tracking map is the part I am proudest of. The driver and the mechanic each see the same journey — the route between them, a pin that moves along the road, and an ETA that counts down — kept in step over a live WebSocket connection. The drawn route shrinks in real time as the mechanic advances, the connection survives drops and reconnects on its own, and the screen updates the instant anything changes rather than waiting on a refresh. Getting real-time UI to feel trustworthy on a patchy mobile network was a real engineering challenge, not a drag-and-drop."),
            ("shot", ("Live tracking — built to update the moment the mechanic moves.", IMG["track"])),
            ("h", "Making the AI genuinely usable"),
            ("p", "MOTOBOT, the in-app assistant, is the feature people notice — but the model is the easy part. The engineering was in the experience around it: a multimodal chat where a driver can type, record a voice note, or snap a photo of the fault and get a clear answer back; a floating assistant that follows them across the app; on-device conversation history; responses that stream in so it never feels frozen; and a pre-submit cost estimate so they walk into the repair already informed. Every one of those is interface and state-management work that turns a raw API into something a frightened driver on the roadside can actually use."),
            ("shot", ("MOTOBOT — the usable experience built around the AI.", IMG["motobot"])),
            ("h", "The details that earn trust"),
            ("p", "Reliability lives in the small things, and I sweated them: raw GPS coordinates resolved into readable place names so no one ever sees a string of numbers; optimistic updates that change the screen instantly without ever flickering back; skeleton loaders so the app never looks broken while data arrives; an automatic, secure session timeout; and graceful handling for when the network simply is not there. Software people lean on during a breakdown is held to a higher bar than a demo — fast, clear and dependable on a real phone, on a real roadside. That bar shaped every screen I built."),
        ],
    },
    {
        "slug": "article-tracking",
        "category": "Feature Spotlight",
        "title": "Help You Can See Coming: Real-Time Tracking & Smart Matching",
        "author": "Katuramu Edgar",
        "excerpt": "The worst part of a breakdown is not knowing when help will arrive. So we made help you can watch on the way.",
        "blocks": [
            ("p", "The hardest part of waiting for roadside help is not the breakdown itself — it is the not knowing. Is anyone coming? How far are they? Will it be five minutes or fifty? That uncertainty is what MOTOFIX set out to remove, by borrowing the best idea from ride-hailing: you can see your help coming, the whole way."),
            ("h", "The right mechanic, automatically"),
            ("p", "When you request assistance, MOTOFIX does not just blast your request to everyone. It intelligently matches you with the most suitable provider nearby — weighing how close they are, whether they can handle your specific problem (a mechanical fault, a tow, or both), and their rating. A driver who needs towing is routed to providers who can actually tow. The result is faster, more reliable help and less time stranded."),
            ("shot", ("MOTOFIX matches you with a verified provider — and you watch them approach.", IMG["track"])),
            ("h", "Watch them approach, live"),
            ("p", "Once a mechanic accepts, the MOTOFIX map comes alive. You see their location and yours, the route between you, and a live estimated time of arrival that updates as they travel. As the mechanic moves, the route shrinks in real time — so a glance at your phone answers the only question that matters: how long until help arrives."),
            ("shot", ("Live tracking — your pin, the mechanic's pin, and a shrinking route + ETA.", IMG["almost"])),
            ("p", "That same map keeps the mechanic informed too, so both sides are always on the same page. It is a small thing that changes everything: a breakdown stops feeling like being abandoned and starts feeling like help is genuinely on the way. Peace of mind is not a luxury when you are stuck on the roadside — it is the whole point."),
        ],
    },
    {
        "slug": "article-pricing",
        "category": "Feature Spotlight",
        "title": "No Surprises: Transparent Pricing, Parts & Cover in One App",
        "author": "Kizito Daniel Jr.",
        "excerpt": "Clear costs up front, genuine spare parts, and insurance — all in one trusted place.",
        "blocks": [
            ("p", "“How much is this going to cost me?” It is the question every driver dreads on the roadside — and too often the answer only comes after the work is done, when it is too late to argue. MOTOFIX was built to flip that around, putting clear costs and real choices in the driver's hands before anything happens."),
            ("h", "A fair price, before the work begins"),
            ("p", "Even before a mechanic arrives, MOTOFIX gives you an AI-powered cost estimate for your problem, showing realistic ranges for repair versus replacement. When the mechanic assesses the job, you receive a clear quote of what they will charge and what they will fix — and you confirm before any money changes hands. When it is time to pay, you choose: Mobile Money or cash. MOTOFIX never inflates your bill."),
            ("shot", ("Know the likely cost — before anyone touches the car.", IMG["cost"])),
            ("h", "Genuine parts, trusted dealers"),
            ("p", "Some fixes need parts, and that is where things often go wrong — counterfeit components and unclear prices. MOTOFIX includes a spare-parts section where drivers can see the parts their problem typically needs, with price guidance, and connect with trusted dealers directly. No more wandering from shop to shop hoping for an honest deal."),
            ("shot", ("Find the right parts and trusted dealers in one place.", IMG["parts"])),
            ("h", "Cover for the unexpected"),
            ("p", "MOTOFIX also brings vehicle insurance into the same app. Drivers can compare cover from multiple insurers, apply for a policy, and file claims — turning something that usually means long queues and paperwork into a few taps. Repairs, parts, payments and protection, all in one trusted place, all transparent."),
        ],
    },
]

# ── HTML helpers ──────────────────────────────────────────────────────────────
def head(title, desc):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="icon" type="image/png" href="assets/motofix-logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
</head>
<body>"""

def nav(active):
    def cls(name): return ' class="active"' if name == active else ''
    return f"""
<header class="nav">
  <div class="nav-inner">
    <a href="index.html" class="brand"><img src="assets/motofix-logo.png" alt="MOTOFIX" class="brand-logo"></a>
    <nav class="nav-links">
      <a href="index.html#features"{cls('features')}>Features</a>
      <a href="index.html#how"{cls('how')}>How it works</a>
      <a href="index.html#team"{cls('team')}>Team</a>
      <a href="index.html#research"{cls('research')}>Research</a>
      <a href="index.html#blog"{cls('blog')}>Blog</a>
      <a href="{LINKEDIN}" target="_blank" rel="noopener" class="nav-cta">LinkedIn ↗</a>
    </nav>
  </div>
</header>"""

def footer():
    links = " &nbsp;·&nbsp; ".join(
        f'<a href="{a["slug"]}.html">{html.escape(a["title"].split(":")[0])}</a>' for a in ARTICLES
    )
    return f"""
<footer class="footer">
  <div class="footer-inner">
    <div>
      <div class="brand-foot"><img src="assets/motofix-logo.png" alt="MOTOFIX" class="brand-logo-foot"></div>
      <p class="foot-tag">Roadside assistance, reimagined for Uganda.</p>
    </div>
    <div class="foot-meta">
      <a href="{LINKEDIN}" target="_blank" rel="noopener">MOTOFIX Uganda on LinkedIn ↗</a>
      <p>A final-year project — Bachelor of Science in Software Engineering,<br>School of Computing and Informatics Technology, Makerere University.</p>
      <p class="copyright">© {YEAR} MOTOFIX Uganda. All rights reserved.</p>
    </div>
  </div>
</footer>
</body>
</html>"""

def shot_html(caption, idx, img=None):
    if img:
        inner = f'<img src="assets/{img}" alt="{html.escape(caption)}" loading="lazy">'
    else:
        inner = (f'<div class="shot-ph">\U0001F4F7 &nbsp; Screenshot {idx}'
                 f'<br><span>Drop the image into the <code>assets</code> folder and replace this box with an &lt;img&gt;</span></div>')
    return f"""    <figure class="shot phone-shot">
      {inner}
      <figcaption>{html.escape(caption)}</figcaption>
    </figure>"""

# ── Build index ───────────────────────────────────────────────────────────────
def build_index():
    feats = "\n".join(
        f"""      <div class="card feature">
        <div class="feature-icon">{ic}</div>
        <h3>{html.escape(t)}</h3>
        <p>{html.escape(d)}</p>
      </div>""" for ic, t, d in FEATURES
    )
    steps = "\n".join(
        f"""      <div class="step">
        <div class="step-num">{i+1}</div>
        <div><h3>{html.escape(t)}</h3><p>{html.escape(d)}</p></div>
      </div>""" for i, (t, d) in enumerate(STEPS)
    )
    def avatar(name, ini, photo):
        # Use the supplied photo if it exists in assets/, else the initials circle.
        if photo and os.path.exists(os.path.join(BASE, "assets", photo)):
            return (f'<div class="avatar"><img src="assets/{html.escape(photo)}" '
                    f'alt="{html.escape(name)}" loading="lazy"></div>')
        return f'<div class="avatar">{html.escape(ini)}</div>'
    team = "\n".join(
        f"""      <div class="card member">
        {avatar(n, ini, photo)}
        <h3>{html.escape(n)}</h3>
        <p>{html.escape(r)}</p>
      </div>""" for n, r, ini, photo in TEAM
    )
    blog = "\n".join(
        f"""      <a class="card post" href="{a['slug']}.html">
        <span class="tag">{html.escape(a['category'])}</span>
        <h3>{html.escape(a['title'])}</h3>
        <p>{html.escape(a['excerpt'])}</p>
        <span class="post-meta">By {html.escape(a['author'])} &nbsp;·&nbsp; Read article →</span>
      </a>""" for a in ARTICLES
    )
    gallery = "\n".join(
        f"""      <figure class="ginate"><img src="assets/{img}" alt="{html.escape(cap)}" loading="lazy"><figcaption>{html.escape(cap)}</figcaption></figure>"""
        for img, cap in GALLERY
    )
    field = "\n".join(
        f"""      <figure class="rfig"><img src="assets/{img}" alt="{html.escape(cap)}" loading="lazy"><figcaption>{html.escape(cap)}</figcaption></figure>"""
        for img, cap in FIELD
    )
    body = f"""
<section class="hero">
  <div class="hero-inner">
    <div class="hero-copy">
      <span class="pill">Roadside assistance for Uganda \U0001F1FA\U0001F1EC</span>
      <h1>Never truly stranded.<br><span class="hl">Help is one tap away.</span></h1>
      <p class="lead">MOTOFIX connects stranded drivers with verified mechanics and tow providers in minutes — with AI diagnosis, live tracking and fair, transparent pricing.</p>
      <div class="hero-cta">
        <a href="#features" class="btn btn-primary">Explore the features</a>
        <a href="#blog" class="btn btn-ghost">Read our blog</a>
      </div>
    </div>
    <div class="hero-device">
      <img src="assets/{IMG['home']}" alt="The MOTOFIX driver app">
    </div>
  </div>
</section>

<section class="band">
  <div class="container narrow center">
    <h2>The problem we are solving</h2>
    <p class="muted big">A breakdown in Uganda means more than a stuck car. It means not knowing what is wrong, who to call, how long help will take, or what a fair price is. MOTOFIX replaces that uncertainty with speed, clarity and trust — from the phone you already own.</p>
  </div>
</section>

<section id="features" class="container">
  <div class="section-head">
    <h2>Key functionalities</h2>
    <p class="muted">Everything a driver needs when the road gets rough — in one app.</p>
  </div>
  <div class="grid features-grid">
{feats}
  </div>
</section>

<section id="how" class="band">
  <div class="container">
    <div class="section-head"><h2>How it works</h2><p class="muted">From breakdown to back-on-the-road, in four steps.</p></div>
    <div class="steps">
{steps}
    </div>
  </div>
</section>

<section id="screens" class="container">
  <div class="section-head"><h2>See it in action</h2><p class="muted">A driver's journey through MOTOFIX, from breakdown to back on the road.</p></div>
  <div class="gallery">
{gallery}
  </div>
</section>

<section id="team" class="band">
  <div class="container">
    <div class="section-head"><h2>The team</h2><p class="muted">Built by software engineering students at Makerere University.</p></div>
    <div class="grid team-grid">
{team}
    </div>
  </div>
</section>

<section id="research" class="container">
  <div class="section-head"><h2>Research &amp; field visits</h2><p class="muted">We went to the streets and garages of Kampala to understand the problem first-hand.</p></div>
  <p class="research-intro">Before writing a line of code, we spoke with the people MOTOFIX is built for — drivers and boda-boda riders about their roadside experiences, and both roadside and professional mechanics about how repairs really happen. These conversations shaped every feature in the platform.</p>
  <div class="research-gallery">
{field}
  </div>
</section>

<section id="blog" class="band">
  <div class="container">
    <div class="section-head"><h2>From our blog</h2><p class="muted">Stories and feature spotlights from the people building MOTOFIX.</p></div>
    <div class="grid blog-grid">
{blog}
    </div>
  </div>
</section>
"""
    out = head("MOTOFIX Uganda — Roadside Assistance, Reimagined",
               "MOTOFIX connects Ugandan drivers with verified mechanics and tow providers in minutes, with AI diagnosis, live tracking and transparent pricing.")
    out += nav("home") + body + footer()
    with open(os.path.join(BASE, "index.html"), "w", encoding="utf-8") as f:
        f.write(out)

# ── Build article pages ───────────────────────────────────────────────────────
def build_article(a):
    parts, sidx = [], 0
    for kind, val in a["blocks"]:
        if kind == "p":
            parts.append(f"    <p>{val}</p>")
        elif kind == "h":
            parts.append(f"    <h2>{html.escape(val)}</h2>")
        elif kind == "shot":
            sidx += 1
            cap, img = val
            parts.append(shot_html(cap, sidx, img))
    body = f"""
<article class="article">
  <div class="article-head">
    <a href="index.html#blog" class="back">← All articles</a>
    <span class="tag">{html.escape(a['category'])}</span>
    <h1>{html.escape(a['title'])}</h1>
    <p class="byline">By <strong>{html.escape(a['author'])}</strong> &nbsp;·&nbsp; MOTOFIX Uganda</p>
  </div>
  <div class="article-body">
{chr(10).join(parts)}
  </div>
  <div class="article-foot">
    <a href="index.html#blog" class="btn btn-ghost">← Back to all articles</a>
    <a href="{LINKEDIN}" target="_blank" rel="noopener" class="btn btn-primary">Follow MOTOFIX on LinkedIn ↗</a>
  </div>
</article>
"""
    out = head(a["title"] + " — MOTOFIX Uganda", a["excerpt"])
    out += nav("blog") + body + footer()
    with open(os.path.join(BASE, a["slug"] + ".html"), "w", encoding="utf-8") as f:
        f.write(out)

build_index()
for a in ARTICLES:
    build_article(a)

with open(os.path.join(BASE, "assets", "README.txt"), "w", encoding="utf-8") as f:
    f.write("Put your screenshots here, then replace the placeholder <div class=\"shot-ph\">...</div>\n"
            "in the article HTML with:  <img src=\"assets/your-file.png\" alt=\"description\">\n")

print("Built: index.html +", len(ARTICLES), "article pages + styles.css")
