"""
admin_demographic_barchart.py
─────────────────────────────
BRIGHTS2 production module — Likert Distribution by Demographic Group (Admin view).

Public API
----------
fetch_data(engine) -> dict
build_figure(data, demo_label="Gender", group_val="Female",
             timepoint=1, question_key="Q1") -> dict

Notes
-----
- Shows Likert response distributions (%) for a selected demographic group
  vs. the full sample, side by side.
- T1 only exposes Q1–Q22; Q23–Q43 are only available from Week 2 onward.
- Gender decoded from one-hot columns (Gender_1–Gender_9).
- All other demographics decoded from single numeric columns via codebook maps.
- Missing values encoded as blank-like strings are ignored.
- Valid participant IDs: 32-char hex strings.
- No pandas or numpy used.
"""

import re
from collections import defaultdict
from sqlalchemy import text
import plotly.graph_objects as go

HEX32 = re.compile(r"^[0-9A-Fa-f]{32}$")
TIMEPOINTS = [1, 2, 3, 4, 5, 6]
SCORES = list(range(1, 8))

LIKERT_LABELS = {
    1: "Strongly disagree",
    2: "Disagree",
    3: "Somewhat disagree",
    4: "Neutral",
    5: "Somewhat agree",
    6: "Agree",
    7: "Strongly agree",
}

LIKERT_COLORS = {
    1: "#d73027",
    2: "#fc8d59",
    3: "#fee090",
    4: "#d9d9d9",
    5: "#91bfdb",
    6: "#4575b4",
    7: "#2166ac",
}

GENDER_MAP = {
    "Gender_1": "Male",
    "Gender_2": "Female",
    "Gender_3": "Non-binary",
    "Gender_4": "Prefer not to say",
    "Gender_5": "Other",
    "Gender_6": "Transgender",
    "Gender_7": "Cisgender",
    "Gender_8": "Genderqueer",
    "Gender_9": "Agender",
}
GENDER_COLS = [f"Gender_{i}" for i in range(1, 10)]

SINGLE_COL_MAPS = {
    "Race / Ethnicity": {
        "col": "Race",
        "values": {
            "1": "African American / Black",
            "2": "Asian American / Asian",
            "3": "Hispanic, Latino/a, or Spanish origin",
            "4": "Middle Eastern / North African",
            "5": "Native American",
            "6": "Native Hawaiian / Pacific Islander",
            "7": "White / Caucasian",
            "8": "Prefer not to say",
            "9": "Other",
        },
    },
    "Religion": {
        "col": "Religion",
        "values": {
            "1": "Protestant (Christian)",
            "2": "Catholic",
            "3": "Buddhist",
            "4": "Hindu",
            "5": "Jewish",
            "6": "Muslim",
            "7": "None",
            "8": "Atheist",
            "9": "Agnostic",
            "10": "Other religion",
        },
    },
    "Education": {
        "col": "Edu",
        "values": {
            "1": "Some high school",
            "2": "High school graduate",
            "3": "Some college / vocational school",
            "4": "College / vocational school graduate",
            "5": "Some graduate school",
            "6": "Graduate school graduate",
        },
    },
    "Marital Status": {
        "col": "Marital",
        "values": {
            "1": "Currently married",
            "2": "Widowed",
            "3": "Divorced",
            "4": "Separated",
            "5": "Never married",
        },
    },
    "Income": {
        "col": "Income",
        "values": {
            "1": "Less than $25,000",
            "2": "$25,000 – $49,999",
            "3": "$50,000 – $74,999",
            "4": "$75,000 – $99,999",
            "5": "$100,000 – $149,999",
            "6": "$150,000 or more",
            "7": "Prefer not to say",
        },
    },
    "Socioeconomic Status": {
        "col": "SES",
        "values": {
            "1": "Upper class",
            "2": "Upper-middle class",
            "3": "Middle class",
            "4": "Lower-middle class",
            "5": "Lower class",
        },
    },
    "Political Orientation": {
        "col": "Pol",
        "values": {
            "1": "Very conservative",
            "2": "Conservative",
            "3": "Slightly conservative",
            "4": "Moderate",
            "5": "Slightly liberal",
            "6": "Liberal",
            "7": "Very liberal",
        },
    },
    "Political Affiliation": {
        "col": "PolAff",
        "values": {
            "1": "Republican",
            "2": "Democrat",
            "3": "Independent",
            "4": "Other",
            "5": "No preference",
        },
    },
}

QUESTION_LABELS = {
    "Q1": "Centrality – Current",
    "Q2": "Centrality – Ideal",
    "Q3": "Centrality – Ought",
    "Q4": "Values",
    "Q5": "Goals-Based Patience",
    "Q6": "Goals-Based Patience",
    "Q7": "Goals-Based Patience",
    "Q8": "Goals-Based Patience",
    "Q9": "Goals-Based Patience",
    "Q10": "Goals-Based Patience",
    "Q11": "Goal Meaning",
    "Q12": "Goal Meaning",
    "Q13": "Goal Meaning",
    "Q14": "External Motivation",
    "Q15": "Introjected Motivation",
    "Q16": "Integrated Motivation",
    "Q17": "Intrinsic Motivation",
    "Q18": "Integrative Emotion Regulation",
    "Q19": "Integrative Emotion Regulation",
    "Q20": "Suppressive Emotion Regulation",
    "Q21": "Suppressive Emotion Regulation",
    "Q22": "Suppressive Emotion Regulation",
    "Q23": "Goal Identity",
    "Q24": "Goal Identity",
    "Q25": "Goal Identity",
    "Q26": "Goal Contingent Self-Worth (Up)",
    "Q27": "Goal Contingent Self-Worth (Up)",
    "Q28": "Goal Contingent Self-Worth (Up)",
    "Q29": "Goal Contingent Self-Worth (Up)",
    "Q30": "Goal Contingent Self-Worth (Down)",
    "Q31": "Goal Contingent Self-Worth (Down)",
    "Q32": "Goal Contingent Self-Worth (Down)",
    "Q33": "Goal Contingent Self-Worth (Down)",
    "Q34": "Goals-Based Courage",
    "Q35": "Goals-Based Courage",
    "Q36": "Goals-Based Courage",
    "Q37": "Goals-Based Courage",
    "Q38": "Goal Progress",
    "Q39": "Goal Progress",
    "Q40": "Goal Progress",
    "Q41": "Goal Progress",
    "Q42": "Goal Progress",
    "Q43": "Goal Progress",
}

T1_QUESTIONS = {k for k in QUESTION_LABELS if int(k[1:]) <= 22}


def _has_data(val):
    return val is not None and str(val).strip() != ""


def _is_valid_id(val):
    return bool(HEX32.match(str(val or "")))


def _safe_float(val):
    try:
        v = float(val)
        return int(v) if 1 <= v <= 7 and float(v).is_integer() else None
    except (TypeError, ValueError):
        return None


def _assign_gender(row):
    for col in GENDER_COLS:
        try:
            if float(row.get(col) or 0) == 1.0:
                return GENDER_MAP.get(col, "Other")
        except (TypeError, ValueError):
            continue
    return None


def _needed_cols():
    cols = ["ID"] + GENDER_COLS
    for demo_cfg in SINGLE_COL_MAPS.values():
        cols.append(demo_cfg["col"])
    for t in TIMEPOINTS:
        max_q = 22 if t == 1 else 43
        cols.extend([f"GT{t}Q{q}" for q in range(1, max_q + 1)])
    return list(dict.fromkeys(cols))


def _pct_dist(values):
    total = len(values)
    if total == 0:
        return {s: 0.0 for s in SCORES}
    counts = defaultdict(int)
    for v in values:
        counts[v] += 1
    return {s: round(counts[s] / total * 100, 1) for s in SCORES}


def fetch_data(engine):
    cols = _needed_cols()
    col_list = ", ".join(f'"{c}"' for c in cols)
    sql = text(f'SELECT {col_list} FROM "GoalIntervention"')

    with engine.connect() as conn:
        raw_rows = conn.execute(sql).fetchall()

    records = []
    for row in raw_rows:
        rec = dict(zip(cols, row))
        if _is_valid_id(rec.get("ID")):
            records.append(rec)

    for r in records:
        r["_gender"] = _assign_gender(r)
        for demo_label, cfg in SINGLE_COL_MAPS.items():
            val = str(r.get(cfg["col"]) or "").strip()
            r[f"_demo_{demo_label}"] = cfg["values"].get(val)

    demo_groups = {}

    gender_groups = defaultdict(list)
    for r in records:
        g = r.get("_gender")
        if g:
            gender_groups[g].append(r)
    demo_groups["Gender"] = dict(gender_groups)

    for demo_label in SINGLE_COL_MAPS:
        grp = defaultdict(list)
        for r in records:
            g = r.get(f"_demo_{demo_label}")
            if g:
                grp[g].append(r)
        demo_groups[demo_label] = dict(grp)

    return {
        "records": records,
        "demo_groups": demo_groups,
        "all_questions": sorted(QUESTION_LABELS.keys(), key=lambda k: int(k[1:])),
        "t1_questions": sorted(T1_QUESTIONS, key=lambda k: int(k[1:])),
        "demographic_labels": ["Gender"] + list(SINGLE_COL_MAPS.keys()),
    }


def build_figure(data, demo_label="Gender", group_val="Female", timepoint=1, question_key="Q1"):
    records = data["records"]
    demo_groups = data["demo_groups"]

    try:
        timepoint = int(timepoint)
    except (TypeError, ValueError):
        timepoint = 1

    if timepoint not in TIMEPOINTS:
        timepoint = 1

    if question_key not in QUESTION_LABELS:
        question_key = "Q1"

    available_groups = list(demo_groups.get(demo_label, {}).keys())
    if not available_groups:
        fig = go.Figure()
        fig.update_layout(
            title="No data available",
            paper_bgcolor="rgba(15,17,30,0.95)",
            plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#e9eefc"),
            height=530,
        )
        return fig.to_dict()

    if group_val not in available_groups:
        group_val = available_groups[0]

    q_num = int(question_key[1:])
    col = f"GT{timepoint}Q{q_num}"

    if timepoint == 1 and q_num > 22:
        fig = go.Figure()
        fig.add_annotation(
            text=(
                f"{question_key} is not available at Week 1.<br>"
                "Questions Q23–Q43 are only collected from Week 2 onward."
            ),
            xref="paper",
            yref="paper",
            x=0.5,
            y=0.5,
            showarrow=False,
            font=dict(color="#e9eefc", size=14),
        )
        fig.update_layout(
            paper_bgcolor="rgba(15,17,30,0.95)",
            plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#e9eefc"),
            height=530,
        )
        return fig.to_dict()

    full_vals = [
        _safe_float(r.get(col))
        for r in records
        if _safe_float(r.get(col)) is not None
    ]
    full_dist = _pct_dist(full_vals)
    full_n = len(full_vals)

    group_rows = demo_groups.get(demo_label, {}).get(group_val, [])
    grp_vals = [
        _safe_float(r.get(col))
        for r in group_rows
        if _safe_float(r.get(col)) is not None
    ]
    grp_dist = _pct_dist(grp_vals)
    grp_n = len(grp_vals)

    x_labels = [LIKERT_LABELS[s] for s in SCORES]
    full_pcts = [full_dist[s] for s in SCORES]
    grp_pcts = [grp_dist[s] for s in SCORES]
    construct = QUESTION_LABELS.get(question_key, question_key)
    y_max = max(max(full_pcts), max(grp_pcts), 1) * 1.3

    fig = go.Figure()

    fig.add_trace(
        go.Bar(
            name=f"Full Sample (n={full_n})",
            x=x_labels,
            y=full_pcts,
            marker_color=[LIKERT_COLORS[s] for s in SCORES],
            marker_line=dict(color="rgba(255,255,255,0.2)", width=1),
            opacity=0.4,
            text=[f"{v:.1f}%" for v in full_pcts],
            textposition="outside",
            textfont=dict(color="#aaaaaa", size=10),
        )
    )

    fig.add_trace(
        go.Bar(
            name=f"{group_val} (n={grp_n})",
            x=x_labels,
            y=grp_pcts,
            marker_color=[LIKERT_COLORS[s] for s in SCORES],
            marker_line=dict(color="white", width=1.5),
            opacity=0.95,
            text=[f"{v:.1f}%" for v in grp_pcts],
            textposition="outside",
            textfont=dict(color="white", size=10),
        )
    )

    fig.update_layout(
        title=dict(
            text=(
                f"<b>Week {timepoint} | {question_key}: {construct}</b><br>"
                f"<sub>{demo_label}: {group_val} vs. Full Sample</sub>"
            ),
            font=dict(color="white", size=15),
            x=0.5,
        ),
        barmode="group",
        bargap=0.22,
        bargroupgap=0.05,
        xaxis=dict(
            tickfont=dict(color="white", size=11),
            gridcolor="rgba(255,255,255,0.05)",
            showline=True,
            linecolor="rgba(255,255,255,0.2)",
        ),
        yaxis=dict(
            title=dict(
                text="% of Respondents",
                font=dict(color="white"),
            ),
            tickfont=dict(color="white"),
            gridcolor="rgba(255,255,255,0.08)",
            range=[0, y_max],
            showline=True,
            linecolor="rgba(255,255,255,0.2)",
        ),
        legend=dict(
            font=dict(color="white", size=12),
            bgcolor="rgba(255,255,255,0.05)",
            bordercolor="rgba(255,255,255,0.1)",
            borderwidth=1,
            orientation="h",
            y=-0.18,
            x=0.5,
            xanchor="center",
        ),
        paper_bgcolor="rgba(15,17,30,0.95)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="white", family="Inter, sans-serif"),
        height=530,
        margin=dict(t=110, b=120, l=60, r=40),
    )

    return fig.to_dict()