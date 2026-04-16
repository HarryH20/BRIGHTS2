"""
admin_counts_demographics.py
────────────────────────────
BRIGHTS2 production module — Participant Count by Demographic Group (Admin view).

Public API
----------
fetch_data(engine) -> dict
build_figure(data, demo_label="Gender") -> dict

Notes
-----
- Shows a bar chart of how many unique participants fall into each group within
  a selected demographic category.
- Participant counts are deduplicated by ID; each person is counted once even
  if they have multiple rows.
- Uses GoalIntervention as the source table.
"""

import re
from collections import defaultdict
from sqlalchemy import text
import plotly.graph_objects as go

HEX32 = re.compile(r"^[0-9A-Fa-f]{32}$")

BAR_COLORS = [
    "#4575b4", "#91bfdb", "#74add1", "#abd9e9",
    "#e0f3f8", "#fee090", "#fdae61", "#f46d43",
    "#d73027", "#a50026",
]

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

ALL_DEMOS = ["Gender"] + list(SINGLE_COL_MAPS.keys())


def _is_valid_id(val):
    return bool(HEX32.match(str(val or "")))


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
    for cfg in SINGLE_COL_MAPS.values():
        cols.append(cfg["col"])
    return list(dict.fromkeys(cols))


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

    seen = set()
    unique = []
    for r in records:
        pid = r["ID"]
        if pid not in seen:
            seen.add(pid)
            unique.append(r)

    demo_counts = {}

    gender_counts = defaultdict(int)
    for r in unique:
        g = _assign_gender(r)
        if g:
            gender_counts[g] += 1
    demo_counts["Gender"] = dict(gender_counts)

    for demo_label, cfg in SINGLE_COL_MAPS.items():
        col = cfg["col"]
        val_map = cfg["values"]
        counts = defaultdict(int)

        for r in unique:
            raw_val = str(r.get(col) or "").strip()
            label = val_map.get(raw_val)
            if label:
                counts[label] += 1

        demo_counts[demo_label] = dict(counts)

    return {"demo_counts": demo_counts}


def build_figure(data, demo_label="Gender"):
    demo_counts = data["demo_counts"]

    if demo_label not in ALL_DEMOS:
        demo_label = "Gender"

    traces = []
    buttons = []

    for i, dl in enumerate(ALL_DEMOS):
        counts_dict = demo_counts.get(dl, {})
        sorted_items = sorted(counts_dict.items(), key=lambda x: x[1], reverse=True)

        labels = [item[0] for item in sorted_items]
        counts = [item[1] for item in sorted_items]
        total = sum(counts)
        pcts = [round(c / total * 100, 1) if total else 0 for c in counts]
        colors = [BAR_COLORS[j % len(BAR_COLORS)] for j in range(len(labels))]

        traces.append(
            go.Bar(
                x=labels,
                y=counts,
                marker_color=colors,
                marker_line=dict(color="rgba(255,255,255,0.15)", width=1),
                text=[f"{c}<br>({p}%)" for c, p in zip(counts, pcts)],
                textposition="outside",
                textfont=dict(color="white", size=11),
                hovertemplate="<b>%{x}</b><br>Count: %{y}<extra></extra>",
                visible=(dl == demo_label),
                showlegend=False,
            )
        )

        visibility = [j == i for j in range(len(ALL_DEMOS))]
        buttons.append(
            dict(
                label=dl,
                method="update",
                args=[
                    {"visible": visibility},
                    {
                        "title.text": (
                            f"<b>Participant Count by {dl}</b><br>"
                            f"<sub>Total participants: {total}</sub>"
                        ),
                        "yaxis.range": [0, max(counts) * 1.25] if counts else [0, 10],
                    },
                ],
            )
        )

    default_counts = demo_counts.get(demo_label, {})
    default_total = sum(default_counts.values())
    default_max = max(default_counts.values()) if default_counts else 10

    fig = go.Figure(data=traces)

    fig.update_layout(
        title=dict(
            text=(
                f"<b>Participant Count by {demo_label}</b><br>"
                f"<sub>Total participants: {default_total}</sub>"
            ),
            font=dict(color="white", size=15),
            x=0.5,
        ),
        updatemenus=[
            dict(
                buttons=buttons,
                direction="down",
                showactive=True,
                x=1.01,
                xanchor="left",
                y=1.13,
                yanchor="top",
                bgcolor="rgba(30,30,30,0.9)",
                bordercolor="rgba(255,255,255,0.2)",
                font=dict(color="white", size=11),
            )
        ],
        annotations=[
            dict(
                text="Demographic",
                x=1.01,
                xanchor="left",
                y=1.08,
                yanchor="top",
                xref="paper",
                yref="paper",
                showarrow=False,
                font=dict(color="#c8d6f0", size=11),
            )
        ],
        xaxis=dict(
            tickfont=dict(color="white", size=11),
            gridcolor="rgba(255,255,255,0.05)",
            showline=True,
            linecolor="rgba(255,255,255,0.2)",
        ),
        yaxis=dict(
            title=dict(
                text="Number of Participants",
                font=dict(color="white"),
            ),
            tickfont=dict(color="white"),
            gridcolor="rgba(255,255,255,0.08)",
            range=[0, default_max * 1.25],
            showline=True,
            linecolor="rgba(255,255,255,0.2)",
        ),
        paper_bgcolor="rgba(15,17,30,0.95)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="white", family="Inter, sans-serif"),
        height=500,
        margin=dict(t=100, b=120, l=60, r=200),
        showlegend=False,
    )

    return fig.to_dict()