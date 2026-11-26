"""Fictional editorial posts for a standalone, repeatable first run."""
from datetime import datetime, timedelta, timezone

TOPICS = [
    ("Weekend print workshop", "Readers ask about materials, Saturday access and the waiting list."),
    ("The reading room stays open late", "Readers welcome the extra evening hours."),
    ("When the last bus leaves", "Commuters compare weekday and weekend connections."),
    ("A closer look at the archive", "Visitors discuss making the collection easier to browse."),
    ("Opening night at the print studio", "Visitors share their favourite prints."),
    ("An update from the cycle workshop", "Readers compare repair options and opening hours."),
    ("Which workshop should return?", "Subscribers exchange ideas for the next programme."),
    ("What changes in the winter timetable", "Readers ask for dates and accessible routes."),
]
PAGES = ["Studio Journal", "City Desk", "Weekend Guide"]
CATEGORIES = ["Activation", "Positive", "Agenda Setting", "Negative"]
FORMATS = ["reel", "photo", "status"]

def example_posts(now):
    for i in range(72):
        title, summary = TOPICS[i % len(TOPICS)]
        page = PAGES[(i // 4) % len(PAGES)]
        media = FORMATS[i % len(FORMATS)]
        views = 0 if media != "reel" else 1200 + 37*i
        metrics = dict(impressions=8900+i*57, reach=5050+i*43, reactions=168+i*7,
                       comments=18+i%27, shares=24+i%19, saves=22+i%10, clicks=72+i*2,
                       net_follows=4+i%6, video_views=views, avg_watch_time=15 if views else 0,
                       total_watch_time=views*15, distribution="Typical", reactions_breakdown={})
        post = dict(fb_post_id=f"sample-{i+1:03d}", page_name=page, media_type=media,
                    message=title, created_time=now-timedelta(hours=10*i), metrics=metrics,
                    analysis_status="complete", analysis=dict(title_english=title,
                    meta_category=CATEGORIES[i%4], core_message=summary, tone="Informative"))
        if i % 8 == 0:
            post["comments"] = ["Are materials included?", "Will there be a later session?",
                                "Please let us know when a place opens."]
            post["comment_analysis"] = dict(comments_analyzed=3, dominant_emotion="Interest",
                overall_vibe="Readers want to attend and are checking practical details.",
                sentiment_breakdown="Interest in booking, with questions about cost and availability.",
                top_3_arguments=["Clarify which materials are included.",
                                 "Offer a later Saturday session.", "Publish waiting-list availability."],
                controversial_points="Whether returning visitors should have priority.")
        yield post

async def seed_demo(db):
    # Insert once per sample ID. Restarts preserve dates and user edits.
    now = datetime.now(timezone.utc)
    for post in example_posts(now):
        await db.posts.update_one({"fb_post_id": post["fb_post_id"]}, {"$setOnInsert": post}, upsert=True)
