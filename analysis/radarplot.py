from collections import defaultdict

import numpy as np
import sqlalchemy
import plotly.graph_objects as go

REVERSE_QS = {14, 15, 20, 21, 22, 26, 27, 28, 29, 30, 31, 32, 33}

TRAITS = {
    "Commitment":  {"qs_all": [1, 2, 3],                                    "qs_t2p": [23, 24, 25],                               "special_all": ["Fusion"]},
    "Importance":  {"qs_all": [4, 11, 12, 13],                               "qs_t2p": [],                                         "special_all": []},
    "Autonomy":    {"qs_all": [14, 15, 16, 17],                              "qs_t2p": [],                                         "special_all": []},
    "Self-Control":{"qs_all": [5, 6, 7, 8, 9, 10, 18, 19, 20, 21, 22],      "qs_t2p": [],                                         "special_all": []},
    "Momentum":    {"qs_all": [],                                             "qs_t2p": [26, 27, 28, 29, 30, 31, 32, 33, 39, 40, 41, 42, 43], "special_all": []},
}

TIMEPOINTS = [1, 2, 3, 4, 5, 6]


def _to_num(x):
    try:
        return float(x)
    except Exception:
        return np.nan


def _reverse_1to7(x):
    x = _to_num(x)
    return np.nan if np.isnan(x) else 8 - x


def _safe_mean(vals):
    vals = [v for v in vals if v is not None and not np.isnan(v)]
    return float(np.mean(vals)) if vals else np.nan


def _hex_to_rgba(hex_color, alpha=0.35):
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"


def fetch_data(participant_id, engine, goal_index=0, **kwargs):
    """
    Fetch trait scores for the participant's goal at position goal_index
    (0 = first goal, 1 = second goal, etc., ordered by GoalID ascending).

    Returns a dict with goal metadata and computed trait scores,
    or None if no data exists for this participant / goal_index.

    Query param:
        goal_index (int, default 0) — which goal to show
    """
    if not participant_id:
        return None

    goal_index = int(goal_index)

    qs_all_nums = sorted({q for tdef in TRAITS.values() for q in tdef["qs_all"]})
    qs_t2p_nums = sorted({q for tdef in TRAITS.values() for q in tdef["qs_t2p"]})

    select_cols = ['"ID"', '"GoalID"', '"GoalT1"']
    for t in TIMEPOINTS:
        # qs_t2p columns only exist from T2 onwards
        q_nums = qs_all_nums if t == 1 else sorted(set(qs_all_nums) | set(qs_t2p_nums))
        for q in q_nums:
            select_cols.append(f'"GT{t}Q{q}"')
        select_cols.append(f'"GT{t}Fusion"')

    sql = f"""
        SELECT {", ".join(select_cols)}
        FROM "GoalIntervention"
        WHERE "ID" = :pid
          AND "GoalT1" IS NOT NULL
          AND TRIM("GoalT1") != ''
        ORDER BY "GoalID" ASC
    """

    with engine.connect() as conn:
        rows = conn.execute(sqlalchemy.text(sql), {"pid": participant_id}).fetchall()

    if not rows or goal_index >= len(rows):
        return None

    mapping = rows[goal_index]._mapping

    # Compute trait scores per timepoint
    scores = []
    for t in TIMEPOINTS:
        for trait, tdef in TRAITS.items():
            vals = []
            for q in tdef["qs_all"]:
                v = mapping.get(f"GT{t}Q{q}")
                vals.append(_reverse_1to7(v) if q in REVERSE_QS else _to_num(v))
            if t >= 2:
                for q in tdef["qs_t2p"]:
                    v = mapping.get(f"GT{t}Q{q}")
                    vals.append(_reverse_1to7(v) if q in REVERSE_QS else _to_num(v))
            for sp in tdef["special_all"]:
                vals.append(_to_num(mapping.get(f"GT{t}{sp}")))
            scores.append({"t_num": t, "trait": trait, "value": _safe_mean(vals)})

    return {
        "goal_id": mapping.get("GoalID"),
        "goal_text": str(mapping.get("GoalT1", "")).strip(),
        "trait_order": list(TRAITS.keys()),
        "scores": scores,
    }


def build_figure(data):
    """
    Build an interactive radar chart for a single goal's trait scores.
    Shows T1 as baseline with a slider to compare against T2-T6.

    Expects data as returned by fetch_data, or None for no-data state.
    """
    if not data:
        fig = go.Figure()
        fig.update_layout(
            title=dict(
                text="No data available yet",
                x=0.5,
                xanchor="center",
                font=dict(color="#e9eefc", size=18),
            ),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
        )
        return fig.to_dict()

    trait_order = data["trait_order"]
    scores = data["scores"]
    goal_id = data["goal_id"]
    theta = trait_order + [trait_order[0]]

    def values_for_time(t):
        vals = [
            next((r["value"] for r in scores if r["t_num"] == t and r["trait"] == tr), np.nan)
            for tr in trait_order
        ]
        return vals + [vals[0]]

    base_hex = "#4f7cff"   # blue  — matches app accent colour
    cmp_hex  = "#fc8d59"   # orange — matches app score palette

    fig = go.Figure()

    # T1 baseline — always visible
    fig.add_trace(
        go.Scatterpolar(
            r=values_for_time(1),
            theta=theta,
            mode="lines",
            name="T1",
            line=dict(width=3, color=base_hex),
            fill="toself",
            fillcolor=_hex_to_rgba(base_hex, 0.18),
            opacity=1.0,
        )
    )

    # Comparison trace — updated by slider
    fig.add_trace(
        go.Scatterpolar(
            r=values_for_time(6),
            theta=theta,
            mode="lines",
            name="T6",
            line=dict(width=3, color=cmp_hex),
            fill="toself",
            fillcolor=_hex_to_rgba(cmp_hex, 0.32),
            opacity=1.0,
        )
    )

    steps = [
        dict(
            method="restyle",
            label=f"T{t}",
            args=[{"r": [values_for_time(t)], "name": [f"T{t}"]}, [1]],
        )
        for t in range(2, 7)
    ]

    fig.update_layout(
        title=dict(
            text=(
                f"<b>Goal Traits Radar — Goal {goal_id}</b>"
                "<br><sub>T1 baseline vs selected timepoint</sub>"
            ),
            x=0.5,
            xanchor="center",
            font=dict(size=20, color="#e9eefc"),
        ),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(t=120, l=60, r=60, b=60),
        showlegend=True,
        legend=dict(font=dict(color="#c8d6f0")),
        sliders=[
            dict(
                active=4,
                currentvalue=dict(prefix="Compare vs: ", font=dict(color="#c8d6f0")),
                pad=dict(t=40),
                steps=steps,
            )
        ],
        polar=dict(
            bgcolor="rgba(255,255,255,0)",
            radialaxis=dict(
                range=[1, 7],
                showticklabels=False,
                gridcolor="rgba(200,200,200,0.3)",
                gridwidth=1,
            ),
            angularaxis=dict(
                tickfont=dict(size=12, color="#c8d6f0"),
                gridcolor="rgba(200,200,200,0.3)",
            ),
        ),
    )

    return fig.to_dict()
