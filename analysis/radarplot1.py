import numpy as np
import sqlalchemy
import plotly.graph_objects as go
import plotly.express as px


# -----------------------------
# Scoring + traits (same as your original radar logic)
# -----------------------------
REVERSE_QS = set([14, 15, 20, 21, 22, 26, 27, 28, 29, 30, 31, 32, 33])

TRAITS = {
    "Commitment": {"qs_all": [1, 2, 3], "qs_t2p": [23, 24, 25], "special_all": ["Fusion"]},
    "Importance": {"qs_all": [4, 11, 12, 13], "qs_t2p": [], "special_all": []},
    "Autonomy": {"qs_all": [14, 15, 16, 17], "qs_t2p": [], "special_all": []},
    "Self-Control": {"qs_all": [5, 6, 7, 8, 9, 10, 18, 19, 20, 21, 22], "qs_t2p": [], "special_all": []},
    "Momentum": {"qs_all": [], "qs_t2p": [26, 27, 28, 29, 30, 31, 32, 33, 39, 40, 41, 42, 43], "special_all": []},
}

TIMEPOINTS = [1, 2, 3, 4, 5, 6]


def _to_num(x):
    try:
        return float(x)
    except Exception:
        return np.nan


def reverse_1to7(x):
    x = _to_num(x)
    return np.nan if np.isnan(x) else 8 - x


def safe_mean(vals):
    vals = [v for v in vals if v is not None and not np.isnan(v)]
    return float(np.mean(vals)) if vals else np.nan


def _hex_to_rgba(hex_color, alpha=0.35):
    h = hex_color.lstrip("#")
    r = int(h[0:2], 16)
    g = int(h[2:4], 16)
    b = int(h[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"


def fetch_goal_row(participant_id, engine, goal_index=0):
    """
    Returns a single goal row mapping for the participant:
      - goals are ordered by GoalID ascending
      - goal_index=0 => first goal
    Returns None if no goals exist.
    """
    if not participant_id:
        return None

    # Collect all columns we might use (GTtQq + GTtFusion)
    q_nums = set()
    for tdef in TRAITS.values():
        q_nums.update(tdef["qs_all"])
        q_nums.update(tdef["qs_t2p"])
    q_nums = sorted(q_nums)

    select_cols = ['"ID"', '"GoalID"', '"GoalT1"']
    for t in TIMEPOINTS:
        for q in q_nums:
            select_cols.append(f'"GT{t}Q{q}"')
        # specials
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

    return rows[goal_index]._mapping


def compute_scores(goal_mapping):
    out = []
    for t in TIMEPOINTS:
        for trait, tdef in TRAITS.items():
            vals = []

            # base questions
            for q in tdef["qs_all"]:
                col = f"GT{t}Q{q}"
                v = goal_mapping.get(col)
                v = reverse_1to7(v) if q in REVERSE_QS else _to_num(v)
                vals.append(v)

            # T2+ questions
            if t >= 2:
                for q in tdef["qs_t2p"]:
                    col = f"GT{t}Q{q}"
                    v = goal_mapping.get(col)
                    v = reverse_1to7(v) if q in REVERSE_QS else _to_num(v)
                    vals.append(v)

            # specials
            for sp in tdef["special_all"]:
                col = f"GT{t}{sp}"  # e.g., GT1Fusion
                vals.append(_to_num(goal_mapping.get(col)))

            out.append({"t_num": t, "trait": trait, "value": safe_mean(vals)})

    return out


def build_figure(participant_id, engine):
    """
    Build radar chart figure dict for the participant's Goal #1 (lowest GoalID).
    """
    goal_mapping = fetch_goal_row(participant_id, engine, goal_index=0)

    if not goal_mapping:
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

    trait_order = list(TRAITS.keys())
    scores = compute_scores(goal_mapping)

    # Build helper: values per time
    def values_for_time(t):
        vals = []
        for tr in trait_order:
            v = next((r["value"] for r in scores if r["t_num"] == t and r["trait"] == tr), np.nan)
            vals.append(v)
        return vals + [vals[0]]

    theta = trait_order + [trait_order[0]]
    palette = px.colors.qualitative.Bold
    base_hex = palette[0]
    cmp_hex = palette[1]
    base_fill = _hex_to_rgba(base_hex, 0.18)
    cmp_fill = _hex_to_rgba(cmp_hex, 0.32)

    fig = go.Figure()

    # T1 baseline
    fig.add_trace(
        go.Scatterpolar(
            r=values_for_time(1),
            theta=theta,
            mode="lines",
            name="T1",
            line=dict(width=3, color=base_hex),
            fill="toself",
            fillcolor=base_fill,
            opacity=1.0,
        )
    )

    # Comparison trace (slider updates this)
    init_t = 6
    fig.add_trace(
        go.Scatterpolar(
            r=values_for_time(init_t),
            theta=theta,
            mode="lines",
            name=f"T{init_t}",
            line=dict(width=3, color=cmp_hex),
            fill="toself",
            fillcolor=cmp_fill,
            opacity=1.0,
        )
    )

    steps = []
    for t in range(2, 7):
        steps.append(
            dict(
                method="restyle",
                label=f"T{t}",
                args=[{"r": [values_for_time(t)], "name": [f"T{t}"]}, [1]],
            )
        )

    goal_id = goal_mapping.get("GoalID")

    fig.update_layout(
        title=dict(
            text=(
                f"<b>Goal Traits Radar — Goal {goal_id}</b>"
                "<br><sub>T1 baseline with slider comparison (T2–T6)</sub>"
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
                active=4,  # default T6
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
