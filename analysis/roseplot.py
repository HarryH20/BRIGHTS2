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


def _parse_int(x, default=None):
    try:
        return int(x)
    except (TypeError, ValueError):
        return default


def _parse_weeks(weeks):
    """
    Accepts: None, "all", "2-6", "4-6", "5-6", "2", etc.
    Returns: sorted list of ints within [2..6] because your DB columns are GT2..GT6.
    """
    if weeks is None:
        return [2, 3, 4, 5, 6]

    s = str(weeks).strip().lower()
    if s == "" or s == "all":
        return [2, 3, 4, 5, 6]

    if "-" in s:
        a, b = s.split("-", 1)
        a = _parse_int(a)
        b = _parse_int(b)
        if a is None or b is None:
            return [2, 3, 4, 5, 6]
        lo, hi = (a, b) if a <= b else (b, a)
        return [t for t in range(lo, hi + 1) if 2 <= t <= 6]

    one = _parse_int(s)
    if one is None:
        return [2, 3, 4, 5, 6]
    return [one] if 2 <= one <= 6 else [2, 3, 4, 5, 6]


def fetch_data(user_id, engine, goal_id=None, weeks=None, **_ignored):
    """
    Query survey_responses for the given user_id with optional filters.

    Query params supported (via serve_graph passing **request.args):
      - goal_id: a specific goal_index (1, 2, or 3). If missing or "all", uses all goals.
      - weeks: e.g. "2-6", "4-6", "5-6", "all". If missing, defaults to 2-6.

    Returns:
      {
        "scores": {
          2: {"Q39": int|None, "Q40": int|None, "Q41": int|None},
          ...
          6: {"Q39": int|None, "Q40": int|None, "Q41": int|None},
        },
        "selected_weeks": [2,3,4,5,6],
        "goal_id": int|None
      }

    Scores are averaged across the selected goals for each selected week.
    Weeks not selected are returned as None so build_figure keeps its 6x3 grid stable.
    """
    if not user_id:
        return None

    selected_weeks = _parse_weeks(weeks)

    # goal_id is now goal_index (1, 2, 3)
    goal_index = None
    if goal_id not in (None, "", "all"):
        try:
            goal_index = int(goal_id)
        except (ValueError, TypeError):
            goal_index = None

    with engine.connect() as conn:
        sql = """
            SELECT sr.goal_index, sr.timepoint, sq.question_number, sr.response_value
            FROM survey_responses sr
            JOIN survey_questions sq ON sq.id = sr.question_id
            WHERE sr.user_id = :uid
              AND sr.timepoint BETWEEN 2 AND 6
              AND sq.question_number IN (39, 40, 41)
              AND sr.response_value IS NOT NULL
        """
        params = {"uid": user_id}

        if goal_index is not None:
            sql += " AND sr.goal_index = :gidx"
            params["gidx"] = goal_index

        rows = conn.execute(sqlalchemy.text(sql), params).fetchall()

    if not rows:
        return None

    totals = defaultdict(lambda: defaultdict(list))

    for row in rows:
        m = row._mapping
        t = m["timepoint"]
        if t not in selected_weeks:
            continue
        q = f"Q{m['question_number']}"
        try:
            totals[t][q].append(int(m["response_value"]))
        except (ValueError, TypeError):
            pass

    # Always return T2..T6 keys so the plot grid doesn't change shape
    scores = {}
    for t in range(2, 7):
        scores[t] = {}
        for q in ("Q39", "Q40", "Q41"):
            if t not in selected_weeks:
                scores[t][q] = None
                continue
            vals = totals[t][q]
            scores[t][q] = round(sum(vals) / len(vals)) if vals else None

    return {"scores": scores, "selected_weeks": selected_weeks, "goal_id": goal_index}


def _score_to_angle(score):
    return (score - 1) * 30


def build_figure(data):
    """
    Build the 6x3 rose plot grid as a Plotly figure dict.

    Layout:
      Rows 1-5: T2..T6 per question
      Row 6: distribution summary across *selected* weeks

    Returns an empty figure with a message if data is None/empty.
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

    # Backwards-compatible: allow old shape {2:{...},...} too
    if isinstance(data, dict) and "scores" in data:
        scores = data["scores"]
        selected_weeks = data.get("selected_weeks", [2, 3, 4, 5, 6])
    else:
        scores = data
        selected_weeks = [2, 3, 4, 5, 6]

    subplot_titles = []
    for t in range(2, 7):
        for q_label in QUESTION_LABELS.values():
            subplot_titles.append(f"<b>T{t}: {q_label}</b>")
    for q_label in QUESTION_LABELS.values():
        subplot_titles.append(f"<b>Selected weeks: {q_label}</b>")

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
        for col_idx, (q_key, _) in enumerate(QUESTION_LABELS.items(), start=1):
            score = (scores.get(t) or {}).get(q_key)
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

    # Row 6: summary distribution across *selected* weeks
    for col_idx, (q_key, _) in enumerate(QUESTION_LABELS.items(), start=1):
        timepoint_scores = [
            (scores.get(t) or {}).get(q_key)
            for t in selected_weeks
            if (scores.get(t) or {}).get(q_key) is not None
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

    for annotation in (fig.layout.annotations or []):
        text = getattr(annotation, "text", "") or ""
        if any(kw in text for kw in ["T2:", "T3:", "T4:", "T5:", "T6:", "Selected weeks:"]):
            annotation.y = (annotation.y or 0) - 0.095
            annotation.font = dict(color="#c8d6f0", size=12)

    return fig.to_dict()