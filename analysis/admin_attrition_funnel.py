"""
attrition_funnel.py
───────────────────
BRIGHTS2 production module — Participant Attrition Funnel (Admin view).

Public API
----------
fetch_data(engine) -> dict
build_figure(engine, demo_key="Overall", grp_name="All Participants") -> dict

Pattern
-------
    from attrition_funnel import fetch_data, build_figure
    data = fetch_data(engine)
    fig  = build_figure(engine, demo_key="Gender", grp_name="Female")
    # fig is a plain dict (fig.to_dict()) — JSON-serialisable, no pandas/numpy.

Notes
-----
- Dataset has ~3 rows per participant (one per goal).  Attrition is computed
  at the unique-participant level: a participant "completed" a timepoint if
  ANY of their goal rows has a valid GT{t}Q1 response.
- Missing values are space strings ' ' — caught with str(v).strip() != ''.
- Valid participant IDs are 32-char hex strings.
- Age is a raw integer in the DB; binned into 18–24 … 65+ here.
- All groups are included. Groups with no participants show zeros.
"""

import re
from sqlalchemy import text
import plotly.graph_objects as go

# ── Constants ─────────────────────────────────────────────────────────────────

HEX32 = re.compile(r"^[0-9A-Fa-f]{32}$")

TIMEPOINTS = list(range(1, 7))  # 1 … 6
T_LABELS   = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"]

GENDER_MAP = {
    "Gender_1": "Male",            "Gender_2": "Female",
    "Gender_3": "Non-binary",      "Gender_4": "Prefer not to say",
    "Gender_5": "Other",           "Gender_6": "Transgender",
    "Gender_7": "Cisgender",       "Gender_8": "Genderqueer",
    "Gender_9": "Agender",
}
GENDER_COLS = [f"Gender_{i}" for i in range(1, 10)]

AGE_BINS   = [(0, 24, "18–24"), (25, 34, "25–34"), (35, 44, "35–44"),
              (45, 54, "45–54"), (55, 64, "55–64"), (65, 999, "65+")]
AGE_LABELS = [lbl for _, _, lbl in AGE_BINS]

RACE_MAP = {
    "1": "African American/Black",    "2": "Asian American/Asian",
    "3": "Hispanic/Latino/Spanish",   "4": "Middle Eastern/N. African",
    "5": "Native American",           "6": "Pacific Islander",
    "7": "White/Caucasian",           "8": "Prefer not to say",
    "9": "Other",                     "10": "Other",
}

EDU_MAP = {
    "1": "Some high school",  "2": "HS graduate",
    "3": "Some college",      "4": "College graduate",
    "5": "Some grad school",  "6": "Graduate degree",
}

COND_MAP = {
    "1": "Purpose Outcome Obstacle Plan",
    "2": "Goal Outcome Obstacle Plan",
    "3": "Control",
}

RELIGION_MAP = {
    "1": "Protestant (Christian)", "2": "Catholic",
    "3": "Buddhist",               "4": "Hindu",
    "5": "Jewish",                 "6": "Muslim",
    "7": "None",                   "8": "Atheist",
    "9": "Agnostic",               "10": "Other",
}

# Ordered labels for each breakdown (controls dropdown order)
DEMO_ORDER = {
    "Overall":   ["All Participants"],
    "Condition": ["Purpose Outcome Obstacle Plan", "Goal Outcome Obstacle Plan", "Control"],
    "Gender":    ["Male", "Female", "Non-binary", "Transgender", "Cisgender",
                  "Genderqueer", "Agender", "Other", "Prefer not to say"],
    "Age":       AGE_LABELS,
    "Race":      list(dict.fromkeys(RACE_MAP.values())),  # deduplicated, insertion-ordered
    "Education": ["Some high school", "HS graduate", "Some college",
                  "College graduate", "Some grad school", "Graduate degree"],
    "Religion":  ["Protestant (Christian)", "Catholic", "Buddhist", "Hindu",
                  "Jewish", "Muslim", "None", "Atheist", "Agnostic", "Other"],
}

# ── Visual constants ───────────────────────────────────────────────────────────

PALETTE   = ["#7b9ef9", "#5e81f4", "#a5b4fc", "#818cf8",
             "#c4b5fd", "#93c5fd", "#6ee7b7", "#fcd34d"]
PAPER_COL = "rgba(15,17,30,0.95)"
FONT_COL  = "#e9eefc"
FONT_SUB  = "#c8d6f0"

# ── Internal helpers ──────────────────────────────────────────────────────────

def _has_data(val):
    return val is not None and str(val).strip() != ""

def _is_valid_id(val):
    return bool(HEX32.match(str(val or "")))

def _bin_age(val):
    try:
        age = int(float(val))
    except (TypeError, ValueError):
        return None
    for lo, hi, lbl in AGE_BINS:
        if lo <= age <= hi:
            return lbl
    return None

def _assign_gender(row):
    for col in GENDER_COLS:
        try:
            if float(row.get(col) or 0) == 1.0:
                return GENDER_MAP.get(col, "Other")
        except (TypeError, ValueError):
            continue
    return None

def _map_col(row, col, mapping):
    val = str(row.get(col) or "").strip()
    return mapping.get(val)

# ── fetch_data ────────────────────────────────────────────────────────────────

def fetch_data(engine):
    """
    Query the BRIGHTS table, compute participant-level attrition counts
    for every demographic breakdown, and return a serialisable dict.

    Returns
    -------
    {
      "attrition": {
        "Overall":   {"All Participants": [904, 824, 783, 739, 714, 680]},
        "Condition": {"Purpose Outcome Obstacle Plan": [...], ...},
        ...
      },
      "demo_order": { "Overall": [...], "Condition": [...], ... }
    }
    """
    # Pull only the columns we need
    needed_cols = (
        ["ID", "Condition", "Age", "Race", "Edu", "Religion"]
        + GENDER_COLS
        + [f"GT{t}Q1" for t in TIMEPOINTS]
    )
    col_list = ", ".join(f'"{c}"' for c in needed_cols)
    sql = text(f'SELECT {col_list} FROM "GoalIntervention"')

    with engine.connect() as conn:
        rows = conn.execute(sql).fetchall()
        keys = conn.execute(sql).keys() if False else needed_cols  # use known order

    # Build list-of-dicts, filtering to valid IDs
    records = []
    for row in rows:
        r = dict(zip(needed_cols, row))
        if _is_valid_id(r.get("ID")):
            records.append(r)

    # ── Tag each row with demographic labels ──────────────────────────────────
    for r in records:
        r["_gender"]    = _assign_gender(r)
        r["_age"]       = _bin_age(r.get("Age"))
        r["_race"]      = _map_col(r, "Race", RACE_MAP)
        r["_edu"]       = _map_col(r, "Edu", EDU_MAP)
        r["_condition"] = _map_col(r, "Condition", COND_MAP)
        r["_religion"]  = _map_col(r, "Religion", RELIGION_MAP)

    # ── Collapse to one record per participant (keeping all goal rows) ─────────
    # Group rows by participant ID
    from collections import defaultdict
    by_id = defaultdict(list)
    for r in records:
        by_id[r["ID"]].append(r)

    # One demographic label per participant (first non-None across their goal rows)
    def first_label(pid, field):
        for r in by_id[pid]:
            v = r.get(field)
            if v:
                return v
        return None

    participant_demos = {
        pid: {
            "_gender":    first_label(pid, "_gender"),
            "_age":       first_label(pid, "_age"),
            "_race":      first_label(pid, "_race"),
            "_edu":       first_label(pid, "_edu"),
            "_condition": first_label(pid, "_condition"),
            "_religion":  first_label(pid, "_religion"),
        }
        for pid in by_id
    }

    # ── Attrition helper ──────────────────────────────────────────────────────
    def attrition_for(id_set):
        """List of 6 ints: how many participants in id_set completed each T."""
        counts = []
        for t in TIMEPOINTS:
            col = f"GT{t}Q1"
            n = sum(
                1 for pid in id_set
                if any(_has_data(r.get(col)) for r in by_id[pid])
            )
            counts.append(n)
        return counts

    all_ids = set(by_id.keys())

    # ── Build breakdowns ──────────────────────────────────────────────────────
    def breakdown(demo_field, ordered_labels):
        result = {}
        for lbl in ordered_labels:
            id_set = {
                pid for pid, demos in participant_demos.items()
                if demos.get(demo_field) == lbl
            }
            if id_set:
                result[lbl] = attrition_for(id_set)
            else:
                result[lbl] = [0, 0, 0, 0, 0, 0]
        return result

    attrition = {
        "Overall":   {"All Participants": attrition_for(all_ids)},
        "Condition": breakdown("_condition", DEMO_ORDER["Condition"]),
        "Gender":    breakdown("_gender",    DEMO_ORDER["Gender"]),
        "Age":       breakdown("_age",       DEMO_ORDER["Age"]),
        "Race":      breakdown("_race",      DEMO_ORDER["Race"]),
        "Education": breakdown("_edu",       DEMO_ORDER["Education"]),
        "Religion":  breakdown("_religion",  DEMO_ORDER["Religion"]),
    }

    # Build effective demo_order (only groups that survived the >=10 filter)
    effective_order = {
        demo: [lbl for lbl in DEMO_ORDER[demo] if lbl in attrition[demo]]
        for demo in attrition
    }

    return {"attrition": attrition, "demo_order": effective_order}


# ── build_figure ──────────────────────────────────────────────────────────────

def build_figure(engine, demo_key="Overall", grp_name="All Participants"):
    """
    Build and return the attrition funnel as a plain dict (fig.to_dict()).

    Parameters
    ----------
    engine   : SQLAlchemy engine
    demo_key : demographic dimension, e.g. "Race"
    grp_name : specific group within that dimension, e.g. "White/Caucasian"
    """
    data = fetch_data(engine)
    attrition = data["attrition"]
    demo_order = data["demo_order"]

    if demo_key not in attrition:
        demo_key = "Overall"

    available_groups = demo_order.get(demo_key, [])

    if not available_groups:
        fig = go.Figure()
        fig.update_layout(
            title="No data available",
            paper_bgcolor=PAPER_COL,
            plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color=FONT_COL),
            height=540,
        )
        return {**fig.to_dict(), "demo_order": demo_order}

    if not grp_name or grp_name not in attrition[demo_key]:
        grp_name = available_groups[0]

    counts = attrition[demo_key][grp_name]
    base = counts[0] or 1

    hover_text = [f"{c} ({100 * c // base}% of Week 1)" for c in counts]

    fig = go.Figure()
    fig.add_trace(go.Funnel(
        name=grp_name,
        y=T_LABELS,
        x=counts,
        textposition="inside",
        textinfo="value+percent initial",
        textfont=dict(size=13, color="#ffffff"),
        marker=dict(
            color=PALETTE[0],
            line=dict(color="rgba(255,255,255,0.15)", width=1),
        ),
        connector=dict(line=dict(color="rgba(255,255,255,0.1)", width=1)),
        customdata=hover_text,
        hovertemplate=(
            "<b>" + grp_name + "</b><br>"
            "%{y}: %{customdata}<extra></extra>"
        ),
    ))

    subtitle = (
        f"N={counts[0]} at Week 1  ·  {demo_key}: {grp_name}"
        "  ·  unique participants, deduplicated across goals"
    )

    fig.update_layout(
        title=dict(
            text=(
                f"Participant Attrition Funnel"
                f"<br><sup style='color:{FONT_SUB}'>{subtitle}</sup>"
            ),
            font=dict(size=17, color=FONT_COL),
            x=0.5,
        ),
        paper_bgcolor=PAPER_COL,
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=FONT_COL, family="Inter, sans-serif"),
        showlegend=False,
        height=540,
        margin=dict(t=100, b=60, l=80, r=40),
    )

    return {**fig.to_dict(), "demo_order": demo_order}
