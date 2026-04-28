from collections import defaultdict

import numpy as np
import sqlalchemy
import plotly.graph_objects as go

REVERSE_QS = {14, 15, 20, 21, 22, 26, 27, 28, 29, 30, 31, 32, 33}

TRAITS = {
    "Commitment":  {"qs_all": [1, 2, 3],                                    "qs_t2p": [23, 24, 25]},
    "Importance":  {"qs_all": [4, 11, 12, 13],                               "qs_t2p": []},
    "Autonomy":    {"qs_all": [14, 15, 16, 17],                              "qs_t2p": []},
    "Self-Control":{"qs_all": [5, 6, 7, 8, 9, 10, 18, 19, 20, 21, 22],      "qs_t2p": []},
    "Momentum":    {"qs_all": [],                                             "qs_t2p": [26, 27, 28, 29, 30, 31, 32, 33, 39, 40, 41, 42, 43]},
}

# For historical participants who only have Q39/40/41 (GoalIntervention data)
SIMPLE_TRAITS = {
    "Progress":    39,
    "Confidence":  40,
    "Importance":  41,
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


def fetch_data(user_id, engine, goal_index=0, **kwargs):
    """
    Fetch trait scores for the user's goal at position goal_index (0-based).

    Returns one of two modes:
      - "full":   5-trait radar (Commitment/Importance/Autonomy/Self-Control/Momentum)
                  used when the participant completed the in-app T1 survey (Q1–Q22 available)
      - "simple": 3-axis radar (Progress/Confidence/Importance from Q39/40/41)
                  used for historical participants whose data came from GoalIntervention (T2–T6 only)

    Returns None if no data at all.
    """
    if not user_id:
        return None

    goal_index = int(goal_index)
    db_goal_index = goal_index + 1  # survey_responses uses 1-based goal_index

    with engine.connect() as conn:
        rows = conn.execute(
            sqlalchemy.text("""
                SELECT sr.timepoint, sq.question_number, sr.response_value
                FROM survey_responses sr
                JOIN survey_questions sq ON sq.id = sr.question_id
                WHERE sr.user_id = :uid
                  AND sr.goal_index = :gidx
                  AND sq.question_number > 0
                ORDER BY sr.timepoint, sq.question_number
            """),
            {"uid": user_id, "gidx": db_goal_index},
        ).fetchall()

        text_row = conn.execute(
            sqlalchemy.text("""
                SELECT sr.response_value
                FROM survey_responses sr
                JOIN survey_questions sq ON sq.id = sr.question_id
                WHERE sr.user_id = :uid
                  AND sr.goal_index = :gidx
                  AND sq.scale_type = 'goal_text'
                LIMIT 1
            """),
            {"uid": user_id, "gidx": db_goal_index},
        ).fetchone()

    if not rows:
        return None

    goal_text = str(text_row[0]).strip() if text_row and text_row[0] else f"Goal {db_goal_index}"

    # Build lookup: {(timepoint, question_number): response_value}
    mapping = {
        (r._mapping["timepoint"], r._mapping["question_number"]): r._mapping["response_value"]
        for r in rows
    }

    # ── Full mode: compute 5 trait scores across all timepoints ──────────────
    scores = []
    for t in TIMEPOINTS:
        for trait, tdef in TRAITS.items():
            vals = []
            for q in tdef["qs_all"]:
                v = mapping.get((t, q))
                vals.append(_reverse_1to7(v) if q in REVERSE_QS else _to_num(v))
            if t >= 2:
                for q in tdef["qs_t2p"]:
                    v = mapping.get((t, q))
                    vals.append(_reverse_1to7(v) if q in REVERSE_QS else _to_num(v))
            mean = _safe_mean(vals)
            scores.append({"t_num": t, "trait": trait, "value": None if np.isnan(mean) else mean})

    # If T1 has any non-None trait scores → full mode with T1 baseline
    has_t1_baseline = any(s["value"] is not None for s in scores if s["t_num"] == 1)
    if has_t1_baseline:
        return {
            "mode": "full",
            "goal_id": db_goal_index,
            "goal_text": goal_text,
            "trait_order": list(TRAITS.keys()),
            "scores": scores,
        }

    # ── Simple mode: Q39/40/41 directly (historical / GoalIntervention data) ─
    # Use T2 as the baseline, T3–T6 on the slider.
    simple_scores = []
    for t in TIMEPOINTS:
        for label, q in SIMPLE_TRAITS.items():
            v = mapping.get((t, q))
            val = _to_num(v)
            simple_scores.append({
                "t_num": t,
                "trait": label,
                "value": None if np.isnan(val) else val,
            })

    has_any_simple = any(s["value"] is not None for s in simple_scores if s["t_num"] >= 2)
    if not has_any_simple:
        return None

    return {
        "mode": "simple",
        "goal_id": db_goal_index,
        "goal_text": goal_text,
        "trait_order": list(SIMPLE_TRAITS.keys()),
        "scores": simple_scores,
    }


def build_figure(data):
    """
    Build an interactive radar chart for a single goal's trait scores.

    Full mode:   5 traits, T1 baseline vs slider (T2–T6).
    Simple mode: 3 traits (Progress/Confidence/Importance), T2 baseline vs slider (T3–T6).
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

    mode        = data.get("mode", "full")
    trait_order = data["trait_order"]
    scores      = data["scores"]
    goal_id     = data["goal_id"]
    goal_text   = data.get("goal_text", f"Goal {goal_id}")

    is_simple   = mode == "simple"
    baseline_t  = 2 if is_simple else 1
    compare_tps = list(range(3, 7)) if is_simple else list(range(2, 7))
    baseline_label = f"Week {baseline_t} (baseline)"

    theta = trait_order + [trait_order[0]]

    def values_for_time(t):
        vals = [
            next((r["value"] for r in scores if r["t_num"] == t and r["trait"] == tr), None)
            for tr in trait_order
        ]
        return vals + [vals[0]]

    base_hex = "#4f7cff"
    cmp_hex  = "#fc8d59"

    fig = go.Figure()

    # Baseline trace (T1 for full mode, T2 for simple mode)
    fig.add_trace(
        go.Scatterpolar(
            r=values_for_time(baseline_t),
            theta=theta,
            mode="lines",
            name=baseline_label,
            line=dict(width=3, color=base_hex),
            fill="toself",
            fillcolor=_hex_to_rgba(base_hex, 0.18),
            opacity=1.0,
        )
    )

    # Default comparison = last timepoint that has at least one non-None value
    def _has_data(t):
        return any(v is not None for v in values_for_time(t)[:-1])  # exclude wrap-around

    default_cmp = next(
        (t for t in reversed(compare_tps) if _has_data(t)),
        compare_tps[-1],
    )
    active_step = compare_tps.index(default_cmp)

    fig.add_trace(
        go.Scatterpolar(
            r=values_for_time(default_cmp),
            theta=theta,
            mode="lines",
            name=f"Week {default_cmp}",
            line=dict(width=3, color=cmp_hex),
            fill="toself",
            fillcolor=_hex_to_rgba(cmp_hex, 0.32),
            opacity=1.0,
        )
    )

    steps = [
        dict(
            method="restyle",
            label=f"Week {t}",
            args=[{"r": [values_for_time(t)], "name": [f"Week {t}"]}, [1]],
        )
        for t in compare_tps
    ]

    subtitle = (
        "Week 2 baseline vs selected timepoint"
        if is_simple else
        "Week 1 baseline vs selected timepoint"
    )

    fig.update_layout(
        height=420,
        title=dict(
            text=(
                f"<sub>{subtitle}</sub>"
            ),
            x=0.5,
            xanchor="center",
            font=dict(size=20, color="#e9eefc"),
        ),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(t=110, l=60, r=60, b=10),
        dragmode="zoom",
        showlegend=True,
        legend=dict(
            orientation="h",
            y=1.08,
            yanchor="top",
            x=0.5,
            xanchor="center",
            font=dict(color="#c8d6f0")
        ),
        sliders=[
            dict(
                active=active_step,
                y=0.12,
                currentvalue=dict(prefix="Compare vs: ", font=dict(color="#c8d6f0")),
                pad=dict(t=20),
                steps=steps,
            )
        ],
        polar=dict(
            domain=dict(
                x=[0.15, 0.85],
                y=[0.35, 0.82]
            ),
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
