# analysis/goal_trajectory_sparklines.py

import math
from collections import defaultdict

import sqlalchemy
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# ── Construct & question maps ─────────────────────────────────────────────────

CONSTRUCTS = [
    ("Centrality",                   [1, 2, 3],              1),
    ("Values",                       [4],                    1),
    ("Goals-Based Patience",         [5, 6, 7, 8, 9, 10],   1),
    ("Goal Meaning",                 [11, 12, 13],           1),
    ("External Motivation",          [14],                   1),
    ("Introjected Motivation",       [15],                   1),
    ("Integrated Motivation",        [16],                   1),
    ("Intrinsic Motivation",         [17],                   1),
    ("Integrative Emotion Reg.",     [18, 19],               1),
    ("Suppressive Emotion Reg.",     [20, 21, 22],           1),
    ("Goal Identity",                [23, 24, 25],           2),
    ("Self-Worth (Up)",              [26, 27, 28, 29],       2),
    ("Self-Worth (Down)",            [30, 31, 32, 33],       2),
    ("Goals-Based Courage",          [34, 35, 36, 37, 38],  2),
    ("Goal Progress",                [39, 40, 41],           2),
    ("Human Accountability",         [42],                   2),
    ("Transcendent Accountability",  [43],                   2),
]

Q_LABELS = {
    1:  "Centrality (Current)",    2:  "Centrality (Ideal)",
    3:  "Centrality (Ought)",      4:  "Values",
    5:  "Patience 1",              6:  "Patience 2",
    7:  "Patience 3",              8:  "Patience 4",
    9:  "Patience 5",              10: "Patience 6",
    11: "Goal Meaning 1",          12: "Goal Meaning 2",
    13: "Goal Meaning 3",          14: "External Motivation",
    15: "Introjected Motivation",  16: "Integrated Motivation",
    17: "Intrinsic Motivation",    18: "Integrative Reg. 1",
    19: "Integrative Reg. 2",      20: "Suppressive Reg. 1",
    21: "Suppressive Reg. 2",      22: "Suppressive Reg. 3",
    23: "Goal Identity 1",         24: "Goal Identity 2",
    25: "Goal Identity 3",         26: "Self-Worth Up 1",
    27: "Self-Worth Up 2",         28: "Self-Worth Up 3",
    29: "Self-Worth Up 4",         30: "Self-Worth Down 1",
    31: "Self-Worth Down 2",       32: "Self-Worth Down 3",
    33: "Self-Worth Down 4",       34: "Courage 1",
    35: "Courage 2",               36: "Courage 3",
    37: "Courage 4",               38: "Courage 5",
    39: "Goal Progress 1",         40: "Goal Progress 2",
    41: "Goal Progress 3",         42: "Human Accountability",
    43: "Transcendent Accountability",
}

Q_MIN_T = {q: 1 if q <= 22 else 2 for q in range(1, 44)}

TIMEPOINTS       = list(range(1, 7))
T_LABELS         = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"]
LIKERT_MIN       = 1
LIKERT_MAX       = 7
NCOLS_CONSTRUCTS = 5
NCOLS_QUESTIONS  = 9

# ── Visual constants ──────────────────────────────────────────────────────────

PAPER_COL = "rgba(15,17,30,0.95)"
FONT_COL  = "#e9eefc"
FONT_SUB  = "#c8d6f0"
LINE_COL  = "#7b9ef9"
BAND_COL  = "rgba(200,214,240,0.10)"
MED_COL   = "rgba(200,214,240,0.45)"
MISS_COL  = "rgba(255,80,80,0.7)"
GRID_COL  = "rgba(255,255,255,0.05)"
NA_COL    = "rgba(255,255,255,0.15)"
X         = list(range(6))   # 0..5 → Week 1..Week 6

# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_float(val):
    try:
        v = float(val)
        return v if LIKERT_MIN <= v <= LIKERT_MAX else None
    except (TypeError, ValueError):
        return None

def _percentiles(values, qs=(25, 50, 75)):
    """Compute percentiles without numpy (linear interpolation)."""
    if not values:
        return {q: None for q in qs}
    s = sorted(values)
    n = len(s)
    result = {}
    for q in qs:
        idx = (q / 100) * (n - 1)
        lo  = int(idx)
        hi  = min(lo + 1, n - 1)
        result[q] = s[lo] + (idx - lo) * (s[hi] - s[lo])
    return result

def _construct_score(q_to_val, q_nums):
    vals = [_safe_float(q_to_val.get(q)) for q in q_nums]
    vals = [v for v in vals if v is not None]
    return sum(vals) / len(vals) if vals else None


# ── fetch_data ────────────────────────────────────────────────────────────────

def fetch_data(user_id, engine, goal_index=0, **kwargs):
    """
    Fetch per-question and per-construct trajectories for the logged-in user
    from survey_responses, plus peer IQR bands from all app users.
    """
    if not user_id:
        return None

    goal_index    = int(goal_index)
    db_goal_index = goal_index + 1

    with engine.connect() as conn:
        user_rows = conn.execute(
            sqlalchemy.text("""
                SELECT sr.goal_index, sr.timepoint,
                       sq.question_number, sr.response_value
                FROM survey_responses sr
                JOIN survey_questions sq ON sq.id = sr.question_id
                WHERE sr.user_id = :uid
                  AND sq.question_number > 0
                  AND sq.scale_type = 'likert7'
                ORDER BY sr.goal_index, sr.timepoint, sq.question_number
            """),
            {"uid": user_id}
        ).fetchall()

        goal_text_row = conn.execute(
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

        peer_rows = conn.execute(
            sqlalchemy.text("""
                SELECT sr.user_id, sr.goal_index, sr.timepoint,
                       sq.question_number, sr.response_value
                FROM survey_responses sr
                JOIN survey_questions sq ON sq.id = sr.question_id
                WHERE sq.question_number > 0
                  AND sq.scale_type = 'likert7'
                  AND sr.response_value IS NOT NULL
                ORDER BY sr.user_id, sr.goal_index, sr.timepoint, sq.question_number
            """)
        ).fetchall()

    if not user_rows:
        return None

    goal_text = (
        str(goal_text_row[0]).strip()
        if goal_text_row and goal_text_row[0]
        else f"Goal {db_goal_index}"
    )

    p_goal_data = defaultdict(lambda: defaultdict(dict))
    for row in user_rows:
        m = row._mapping
        p_goal_data[m["goal_index"]][m["timepoint"]][m["question_number"]] = m["response_value"]

    goal_tp_data = p_goal_data.get(db_goal_index, {})

    p_q_traj = {}
    for q in range(1, 44):
        min_t = Q_MIN_T[q]
        traj  = []
        for t in TIMEPOINTS:
            if t < min_t:
                traj.append(None)
            else:
                traj.append(_safe_float(goal_tp_data.get(t, {}).get(q)))
        p_q_traj[q] = traj

    p_c_traj = {}
    for label, q_nums, min_t in CONSTRUCTS:
        traj = []
        for t in TIMEPOINTS:
            if t < min_t:
                traj.append(None)
            else:
                traj.append(_construct_score(goal_tp_data.get(t, {}), q_nums))
        p_c_traj[label] = traj

    all_peer = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
    for row in peer_rows:
        m = row._mapping
        all_peer[m["user_id"]][m["goal_index"]][m["timepoint"]][m["question_number"]] = m["response_value"]

    q_bands = {}
    for q in range(1, 44):
        min_t = Q_MIN_T[q]
        q25_list, q50_list, q75_list = [], [], []
        for t in TIMEPOINTS:
            if t < min_t:
                q25_list.append(None); q50_list.append(None); q75_list.append(None)
                continue
            per_user = []
            for uid, uid_goals in all_peer.items():
                vals = [
                    _safe_float(uid_goals[gidx].get(t, {}).get(q))
                    for gidx in uid_goals
                ]
                vals = [v for v in vals if v is not None]
                if vals:
                    per_user.append(sum(vals) / len(vals))
            pcts = _percentiles(per_user)
            q25_list.append(round(pcts[25], 4) if pcts[25] is not None else None)
            q50_list.append(round(pcts[50], 4) if pcts[50] is not None else None)
            q75_list.append(round(pcts[75], 4) if pcts[75] is not None else None)
        q_bands[q] = {"q25": q25_list, "q50": q50_list, "q75": q75_list}

    c_bands = {}
    for label, q_nums, min_t in CONSTRUCTS:
        q25_list, q50_list, q75_list = [], [], []
        for t in TIMEPOINTS:
            if t < min_t:
                q25_list.append(None); q50_list.append(None); q75_list.append(None)
                continue
            per_user = []
            for uid, uid_goals in all_peer.items():
                goal_scores = [
                    _construct_score(uid_goals[gidx].get(t, {}), q_nums)
                    for gidx in uid_goals
                ]
                goal_scores = [v for v in goal_scores if v is not None]
                if goal_scores:
                    per_user.append(sum(goal_scores) / len(goal_scores))
            pcts = _percentiles(per_user)
            q25_list.append(round(pcts[25], 4) if pcts[25] is not None else None)
            q50_list.append(round(pcts[50], 4) if pcts[50] is not None else None)
            q75_list.append(round(pcts[75], 4) if pcts[75] is not None else None)
        c_bands[label] = {"q25": q25_list, "q50": q50_list, "q75": q75_list}

    has_data = any(
        v is not None
        for traj in p_q_traj.values()
        for v in traj
    )
    if not has_data:
        return None

    return {
        "user_id":    user_id,
        "goal_index": goal_index,
        "goal_text":  goal_text,
        "p_q_traj":   p_q_traj,
        "p_c_traj":   p_c_traj,
        "q_bands":    q_bands,
        "c_bands":    c_bands,
    }


# ── build_single_panel ────────────────────────────────────────────────────────

def build_single_panel(data, use_constructs=False, item_index=0):
    """
    Build a single sparkline panel for one question or construct.
    Returns a plain dict (fig.to_dict()) — kept for reference/admin use.
    The frontend uses the /goal_trajectory_sparklines endpoint which returns
    structured data for ECharts rendering instead.
    """
    if not data:
        fig = go.Figure()
        fig.update_layout(
            title=dict(
                text="No data available yet — complete your first survey to see your trajectories.",
                x=0.5, xanchor="center",
                font=dict(color=FONT_COL, size=16),
            ),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
        )
        return fig.to_dict()

    goal_text = data["goal_text"]
    p_q_traj  = data["p_q_traj"]
    p_c_traj  = data["p_c_traj"]
    q_bands   = data["q_bands"]
    c_bands   = data["c_bands"]

    if use_constructs:
        constructs  = [(lbl, min_t) for lbl, _, min_t in CONSTRUCTS]
        idx         = min(item_index, len(constructs) - 1)
        lbl, min_t  = constructs[idx]
        traj        = p_c_traj[lbl]
        band        = c_bands[lbl]
        title_str   = lbl
    else:
        q         = min(item_index + 1, 43)
        min_t     = Q_MIN_T[q]
        traj      = p_q_traj[q]
        band      = q_bands[q]
        title_str = Q_LABELS[q]

    fig = go.Figure()

    q25, q50, q75 = band["q25"], band["q50"], band["q75"]
    x_band = X + X[::-1]
    y_top  = [v if v is not None else 0 for v in q75]
    y_bot  = [v if v is not None else 0 for v in q25]
    y_band = y_top + y_bot[::-1]

    fig.add_trace(go.Scatter(
        x=x_band, y=y_band, fill="toself", fillcolor=BAND_COL,
        line=dict(width=0), name="Peer IQR", hoverinfo="skip",
    ))

    fig.add_trace(go.Scatter(
        x=X, y=q50,
        mode="lines", line=dict(color=MED_COL, width=1.5, dash="dot"),
        name="Peer Median", hoverinfo="skip",
    ))

    p_x     = [xi for xi, v in zip(X, traj) if v is not None]
    p_y     = [v for v in traj if v is not None]
    p_hover = [f"{T_LABELS[xi]}: {v:.2f}" for xi, v in zip(p_x, p_y)]

    fig.add_trace(go.Scatter(
        x=p_x, y=p_y,
        mode="lines+markers",
        line=dict(color=LINE_COL, width=2.5),
        marker=dict(size=6, color=LINE_COL),
        name="You",
        text=p_hover, hovertemplate="%{text}<extra></extra>",
    ))

    miss_x = [
        xi for xi, (v, t) in enumerate(zip(traj, TIMEPOINTS))
        if v is None and t >= min_t
    ]
    if miss_x:
        fig.add_trace(go.Scatter(
            x=miss_x, y=[LIKERT_MIN] * len(miss_x),
            mode="markers", marker=dict(symbol="x", size=9, color=MISS_COL),
            name="Missing", hoverinfo="skip",
        ))

    na_x = [xi for xi, t in enumerate(TIMEPOINTS) if t < min_t]
    if na_x:
        fig.add_trace(go.Scatter(
            x=na_x, y=[LIKERT_MIN] * len(na_x),
            mode="markers",
            marker=dict(symbol="circle-open", size=7, color=NA_COL),
            name="N/A (Week 1 only)", hoverinfo="skip",
        ))

    short_goal = f'"{goal_text[:55]}…"' if len(goal_text) > 55 else f'"{goal_text}"'

    fig.update_layout(
        title=dict(
            text=(
                f"{title_str}<br>"
                f"<sup style='color:{FONT_SUB}'>{short_goal}</sup>"
            ),
            font=dict(size=16, color=FONT_COL),
            x=0.5,
        ),
        xaxis=dict(
            tickvals=X, ticktext=T_LABELS,
            tickfont=dict(size=11, color="rgba(200,214,240,0.6)"),
            showgrid=False, zeroline=False,
        ),
        yaxis=dict(
            range=[LIKERT_MIN - 0.3, LIKERT_MAX + 0.3],
            tickvals=[1, 2, 3, 4, 5, 6, 7],
            tickfont=dict(size=11, color="rgba(200,214,240,0.6)"),
            gridcolor=GRID_COL, showgrid=True, zeroline=False,
        ),
        paper_bgcolor=PAPER_COL,
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=FONT_COL, family="Inter, sans-serif"),
        height=350,
        legend=dict(
            orientation="h", y=-0.15, x=0.5, xanchor="center",
            font=dict(color=FONT_COL, size=11),
        ),
        margin=dict(t=90, b=80, l=60, r=40),
    )

    return fig.to_dict()
