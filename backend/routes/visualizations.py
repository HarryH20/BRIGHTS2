import logging
import time

from flask import Blueprint, jsonify
from routes.auth import login_required
import plotly.graph_objects as go
from plotly.subplots import make_subplots

logger = logging.getLogger(__name__)

viz_bp = Blueprint("viz", __name__, url_prefix="/api/visualizations")

# Likert scale labels used in the rose plots
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

# Demo data: scores per timepoint per question (mimics a real participant)
DEMO_SCORES = {
    2: {"Q39": 3, "Q40": 4, "Q41": 5},
    3: {"Q39": 4, "Q40": 5, "Q41": 5},
    4: {"Q39": 5, "Q40": 5, "Q41": 6},
    5: {"Q39": 5, "Q40": 6, "Q41": 6},
    6: {"Q39": 6, "Q40": 6, "Q41": 7},
}


def _score_to_angle(score):
    return (score - 1) * 30


def _build_roseplot_figure():
    """Build the 6x3 rose plot grid as a Plotly figure dict."""

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

    # Rows 1-5: individual timepoint scores
    for row_idx, t in enumerate(range(2, 7), start=1):
        for col_idx, (q_key, q_label) in enumerate(QUESTION_LABELS.items(), start=1):
            score = DEMO_SCORES[t][q_key]
            angle = _score_to_angle(score)
            color = SCORE_COLORS[score]

            fig.add_trace(
                go.Barpolar(
                    r=[1],
                    theta=[angle],
                    width=25,
                    marker=dict(
                        color=color,
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
    for col_idx, (q_key, q_label) in enumerate(QUESTION_LABELS.items(), start=1):
        scores = [DEMO_SCORES[t][q_key] for t in range(2, 7)]
        from collections import Counter

        counts = Counter(scores)
        max_count = max(counts.values())

        for score, count in counts.items():
            angle = _score_to_angle(score)
            color = SCORE_COLORS[score]
            height = (count / max_count) ** 0.5

            fig.add_trace(
                go.Barpolar(
                    r=[height],
                    theta=[angle],
                    width=25,
                    marker=dict(
                        color=color,
                        line=dict(color="white", width=2),
                        opacity=0.9,
                    ),
                    hovertext=(
                        f"{LIKERT_LABELS[score]}: {count}/5 times "
                        f"({count / 5 * 100:.0f}%)"
                    ),
                    hoverinfo="text",
                    showlegend=False,
                ),
                row=6,
                col=col_idx,
            )

    # Style all polar subplots
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

    # Nudge subplot titles down
    for annotation in fig["layout"]["annotations"]:
        if any(
            kw in annotation["text"]
            for kw in ["T2:", "T3:", "T4:", "T5:", "T6:", "All T2-T6:"]
        ):
            annotation["y"] = annotation["y"] - 0.095
            annotation["font"] = dict(color="#c8d6f0", size=12)

    return fig.to_dict()


@viz_bp.route("/roseplot")
@login_required
def roseplot():
    """Return the sprint-1 demo rose plot as Plotly JSON."""
    start = time.time()
    try:
        fig_dict = _build_roseplot_figure()
        duration_ms = (time.time() - start) * 1000
        logger.info("Rose plot generated in %.1fms", duration_ms)
        if duration_ms > 500:
            logger.warning("Slow chart generation: roseplot took %.1fms", duration_ms)
        return jsonify(fig_dict)
    except Exception:
        logger.error("Failed to generate rose plot", exc_info=True)
        return jsonify({"error": "Failed to generate visualization"}), 500
