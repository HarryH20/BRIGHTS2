from collections import Counter, defaultdict

import sqlalchemy
import plotly.graph_objects as go
from plotly.subplots import make_subplots

LIKERT_LABELS = {
    1: "Strongly disagree",
    2: "Disagree",
    3: "Somewhat disagree",
    4: "Neutral",
    5: "Somewhat agree",
    6: "Agree",
    7: "Strongly agree",
}

SCORE_COLORS = {
    1: "#d73027",
    2: "#fc8d59",
    3: "#fee090",
    4: "#e0e0e0",
    5: "#91bfdb",
    6: "#4575b4",
    7: "#2166AC",
}

QUESTION_LABELS = {
    "Q39": "Progress toward goal",
    "Q40": "Confidence in achieving goal",
    "Q41": "Goal importance",
}


def fetch_data(participant_id, engine):
    """
    Query GoalIntervention for the given participant_id.

    Returns a scores dict shaped as:
        {
            2: {"Q39": int, "Q40": int, "Q41": int},
            3: {...},
            ...
            6: {...},
        }
    Values are averaged across all of the participant's goals at each timepoint.
    Returns None if the participant has no GoalIntervention rows.
    """
    if not participant_id:
        return None

    with engine.connect() as conn:
        result = conn.execute(
            sqlalchemy.text(
                """
                SELECT "GoalID", "GoalT1",
                       "GT2Q39","GT2Q40","GT2Q41",
                       "GT3Q39","GT3Q40","GT3Q41",
                       "GT4Q39","GT4Q40","GT4Q41",
                       "GT5Q39","GT5Q40","GT5Q41",
                       "GT6Q39","GT6Q40","GT6Q41"
                FROM "GoalIntervention"
                WHERE "ID" = :pid
                  AND "GoalT1" IS NOT NULL
                  AND TRIM("GoalT1") != ''
                ORDER BY "GoalID"
                """
            ),
            {"pid": participant_id},
        )
        rows = result.fetchall()

    if not rows:
        return None

    totals = defaultdict(lambda: defaultdict(list))
    for row in rows:
        mapping = row._mapping
        for t in range(2, 7):
            for q in ("Q39", "Q40", "Q41"):
                col = f"GT{t}{q}"
                val = mapping.get(col)
                if val is not None:
                    try:
                        totals[t][q].append(int(val))
                    except (ValueError, TypeError):
                        pass

    scores = {}
    for t in range(2, 7):
        scores[t] = {}
        for q in ("Q39", "Q40", "Q41"):
            vals = totals[t][q]
            scores[t][q] = round(sum(vals) / len(vals)) if vals else None

    return scores


def _score_to_angle(score):
    return (score - 1) * 30


def build_figure(data):
    """
    Build the 6x3 rose plot grid as a Plotly figure dict.
    Returns an empty figure with a message if data is None or empty.
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

    subplot_titles = []
    for t in range(2, 7):
        for q_label in QUESTION_LABELS.values():
            subplot_titles.append(f"<b>T{t}: {q_label}</b>")
    for q_label in QUESTION_LABELS.values():
        subplot_titles.append(f"<b>All T2-T6: {q_label}</b>")

    fig = make_subplots(
        rows=6,
        cols=3,
        specs=[[{"type": "polar"}] * 3 for _ in range(6)],
        subplot_titles=subplot_titles,
        vertical_spacing=0.10,
        horizontal_spacing=0.05,
    )

    # Rows 1-5: one bar per timepoint per question
    for row_idx, t in enumerate(range(2, 7), start=1):
        for col_idx, (q_key, q_label) in enumerate(QUESTION_LABELS.items(), start=1):
            score = data[t].get(q_key)
            if score is None:
                continue
            fig.add_trace(
                go.Barpolar(
                    r=[1],
                    theta=[_score_to_angle(score)],
                    width=25,
                    marker=dict(
                        color=SCORE_COLORS[score],
                        line=dict(color="white", width=2),
                        opacity=0.9,
                    ),
                    hovertext=f"T{t}: {LIKERT_LABELS[score]}",
                    hoverinfo="text",
                    showlegend=False,
                ),
                row=row_idx,
                col=col_idx,
            )

    # Row 6: summary distribution across T2-T6
    for col_idx, (q_key, _) in enumerate(QUESTION_LABELS.items(), start=1):
        timepoint_scores = [
            data[t][q_key] for t in range(2, 7) if data[t].get(q_key) is not None
        ]
        if not timepoint_scores:
            continue
        counts = Counter(timepoint_scores)
        max_count = max(counts.values())
        for score, count in counts.items():
            height = (count / max_count) ** 0.5
            fig.add_trace(
                go.Barpolar(
                    r=[height],
                    theta=[_score_to_angle(score)],
                    width=25,
                    marker=dict(
                        color=SCORE_COLORS[score],
                        line=dict(color="white", width=2),
                        opacity=0.9,
                    ),
                    hovertext=(
                        f"{LIKERT_LABELS[score]}: {count}/{len(timepoint_scores)} times "
                        f"({count / len(timepoint_scores) * 100:.0f}%)"
                    ),
                    hoverinfo="text",
                    showlegend=False,
                ),
                row=6,
                col=col_idx,
            )

    angular_ticktext = [
        "Strongly<br>disagree",
        "Disagree",
        "Somewhat<br>disagree",
        "Neutral",
        "Somewhat<br>agree",
        "Agree",
        "Strongly<br>agree",
    ]

    for row in range(1, 7):
        for col in range(1, 4):
            fig.update_polars(
                radialaxis=dict(
                    range=[0, 1.3],
                    showticklabels=False,
                    showline=False,
                    gridcolor="rgba(200,200,200,0.3)",
                    gridwidth=1,
                ),
                angularaxis=dict(
                    direction="clockwise",
                    rotation=180,
                    tickmode="array",
                    tickvals=[0, 30, 60, 90, 120, 150, 180],
                    ticktext=angular_ticktext,
                    showline=False,
                    gridcolor="rgba(200,200,200,0.3)",
                    tickfont=dict(size=9, color="#c8d6f0"),
                ),
                bgcolor="rgba(255,255,255,0)",
                row=row,
                col=col,
            )

    fig.update_layout(
        title=dict(
            text=(
                "<b>Goal Progression Journey (T2 - T6)</b>"
                "<br><sub>Individual responses by timepoint and question</sub>"
            ),
            x=0.5,
            xanchor="center",
            font=dict(size=20, color="#e9eefc"),
        ),
        height=2400,
        width=1200,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        showlegend=False,
        margin=dict(t=120, l=60, r=60, b=60),
    )

    for annotation in fig["layout"]["annotations"]:
        if any(
            kw in annotation["text"]
            for kw in ["T2:", "T3:", "T4:", "T5:", "T6:", "All T2-T6:"]
        ):
            annotation["y"] = annotation["y"] - 0.095
            annotation["font"] = dict(color="#c8d6f0", size=12)

    return fig.to_dict()
