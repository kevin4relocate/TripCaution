"""Sprint 6: research SLOTS, not unverifiable pre-written travel warnings.

The matrix expresses editorial questions. Zero incidents, risk levels or source
claims are inferred from a planned slot. Material must pass source verification
and owner review before becoming public.
"""
from collections import Counter

COUNTRIES = (
    "Brunei", "Cambodia", "Indonesia", "Laos", "Malaysia", "Myanmar",
    "Philippines", "Singapore", "Thailand", "Timor-Leste", "Vietnam",
)
# Eight intentionally distinct research briefs per destination, in six public
# caution topics. A planned slot can remain empty indefinitely if evidence fails.
BRIEFS = (
    ("transport-arrival", "transport", "Locate current, officially documented airport arrival transport, pickup instructions, ticketing and traveler limitations."),
    ("transport-onward", "transport", "Investigate one different intercity or urban transport booking, route or operator caveat with current operator evidence."),
    ("scams-common", "scams-theft", "Investigate a specific officially documented traveler-targeted scam or theft situation; never infer its frequency from an anecdote."),
    ("scams-alternative", "scams-theft", "Investigate a different, independently evidenced traveler scam or theft prevention issue; leave empty if not corroborated."),
    ("payments", "payments-money", "Verify an exact cash/card/payment-method limitation for a specified visitor scenario, merchant type or operator."),
    ("laws", "local-laws", "Investigate an actionable visitor law or customs rule from the responsible local authority, noting passport-specific limitations."),
    ("safety", "safety-health", "Investigate a precise, current official safety or health precaution, region-specific when appropriate, without broad country danger scores."),
    ("essentials", "travel-essentials", "Investigate a specific connectivity, booking, entry-preparation or other travel-essential problem using authoritative current information."),
)
FIRST_PASS = ("transport-arrival", "scams-common", "safety")
VALID_PHASES = (1, 2)
LEGACY_CATEGORY_TOPIC = {
    "transport": "transport",
    "tourist-traps": "scams-theft", "scams-theft": "scams-theft",
    "payments-money": "payments-money",
    "local-laws": "local-laws", "etiquette": "local-laws",
    "safety-health": "safety-health",
    "travel-essentials": "travel-essentials",
    "before-you-go": "travel-essentials", "things-to-avoid": "travel-essentials",
    "food": "travel-essentials",
}
TOPIC_COUNTS = Counter(category for _, category, _ in BRIEFS)
SLOT_TAG_PREFIX = "sprint6:"

def normalized(value):
    return str(value or "").strip().casefold()

def active_rows(rows):
    """Never count deleted, hidden or archived material as current coverage."""
    return [
        row for row in rows
        if isinstance(row, dict)
        and normalized(row.get("country")) in {normalized(c) for c in COUNTRIES}
        and normalized(row.get("status")) not in ("deleted", "hidden", "archived")
    ]

def row_tags(row):
    value = row.get("tags", row.get("tags_json", []))
    if isinstance(value, str):
        import json
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            value = []
    return value if isinstance(value, list) else []

def slot_coverage(rows):
    """Explicit slot tags plus one-to-one matching of older, untagged content.

    Legacy categories do not prove that an older guide answers a particular
    narrow brief. Matching a legacy article to an unused slot in its category
    is a planning heuristic only; the owner's editorial review decides whether
    it truly counts. No article records are modified.
    """
    active = active_rows(rows)
    covered = {country: set() for country in COUNTRIES}
    for country in COUNTRIES:
        items = [r for r in active if normalized(r.get("country")) == normalized(country)]
        # Explicit Sprint 6 slots get priority; malformed tags must not count.
        for row in items:
            for tag in row_tags(row):
                if isinstance(tag, str) and tag.startswith(SLOT_TAG_PREFIX):
                    slot = tag[len(SLOT_TAG_PREFIX):]
                    if slot in {b[0] for b in BRIEFS}:
                        covered[country].add(slot)
        for row in items:
            if any(isinstance(tag, str) and tag.startswith(SLOT_TAG_PREFIX) for tag in row_tags(row)):
                continue
            category = LEGACY_CATEGORY_TOPIC.get(normalized(row.get("category_id") or row.get("category")))
            for slot, topic, _ in BRIEFS:
                if topic == category and slot not in covered[country]:
                    covered[country].add(slot)
                    break
    return covered

def choose_slot(rows, phase, rotation=0):
    """Fill gaps across all 11 countries before depth; phase 1 <=3 per country.

    Phase 2 is an explicit editor opt-in; never silently produce 88 AI drafts.
    'Covered' here means non-deleted queued/reviewed/scheduled/published records
    and is not equivalent to 33 or 88 independently verified public guides.
    """
    if phase not in VALID_PHASES:
        raise ValueError("Content phase must be 1 or 2")
    covered = slot_coverage(rows)
    allowed = [brief for brief in BRIEFS if phase == 2 or brief[0] in FIRST_PASS]
    pending = [(country, brief) for country in COUNTRIES for brief in allowed if brief[0] not in covered[country]]
    if not pending:
        return None
    # Cover empty countries first, then least-covered country in this phase.
    # Stable day rotation only resolves ties, preventing fixed-country starvation.
    country_rank = {country: sum(brief[0] in covered[country] for brief in allowed) for country in COUNTRIES}
    min_count = min(country_rank[country] for country, _ in pending)
    eligible = [item for item in pending if country_rank[item[0]] == min_count]
    country_rotation = int(rotation) % len(COUNTRIES)
    order = COUNTRIES[country_rotation:] + COUNTRIES[:country_rotation]
    eligible.sort(key=lambda item: (order.index(item[0]), allowed.index(item[1])))
    country = eligible[0][0]
    return next(item for item in eligible if item[0] == country)

def coverage_summary(rows, phase=1):
    slots = slot_coverage(rows)
    allowed = set(FIRST_PASS) if phase == 1 else {b[0] for b in BRIEFS}
    return {country: {"queued_or_live_slots": len(slots[country] & allowed),
                      "target": len(allowed)} for country in COUNTRIES}
