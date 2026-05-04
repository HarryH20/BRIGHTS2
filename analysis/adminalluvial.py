# analysis/adminalluvial.py

import sqlalchemy
import plotly.graph_objects as go

# ---------------------------------------------------------------------------
# Question metadata (Q1–Q22 appear at T1+; Q23–Q43 appear at T2+)
# ---------------------------------------------------------------------------

QUESTION_LABELS = {
    1:  "Centrality – Current",
    2:  "Centrality – Ideal",
    3:  "Centrality – Ought",
    4:  "Values",
    5:  "Goals-Based Patience",
    6:  "Goals-Based Patience",
    7:  "Goals-Based Patience",
    8:  "Goals-Based Patience",
    9:  "Goals-Based Patience",
    10: "Goals-Based Patience",
    11: "Goal Meaning",
    12: "Goal Meaning",
    13: "Goal Meaning",
    14: "External Motivation",
    15: "Introjected Motivation",
    16: "Integrated Motivation",
    17: "Intrinsic Motivation",
    18: "Integrative Emotion Regulation",
    19: "Integrative Emotion Regulation",
    20: "Suppressive Emotion Regulation",
    21: "Suppressive Emotion Regulation",
    22: "Suppressive Emotion Regulation",
    23: "Goal Identity",
    24: "Goal Identity",
    25: "Goal Identity",
    26: "Goal Contingent Self-Worth – Up",
    27: "Goal Contingent Self-Worth – Up",
    28: "Goal Contingent Self-Worth – Up",
    29: "Goal Contingent Self-Worth – Up",
    30: "Goal Contingent Self-Worth – Down",
    31: "Goal Contingent Self-Worth – Down",
    32: "Goal Contingent Self-Worth – Down",
    33: "Goal Contingent Self-Worth – Down",
    34: "Goals-Based Courage",
    35: "Goals-Based Courage",
    36: "Goals-Based Courage",
    37: "Goals-Based Courage",
    38: "Goals-Based Courage",
    39: "Goal Progress",
    40: "Goal Progress",
    41: "Goal Progress",
    42: "Human Accountability",
    43: "Transcendent Accountability",
}

QUESTION_SHORT = {
    1:  "Q1: Centrality – Current",
    2:  "Q2: Centrality – Ideal",
    3:  "Q3: Centrality – Ought",
    4:  "Q4: Values",
    5:  "Q5: Patience (calm)",
    6:  "Q6: Patience (tolerate challenges)",
    7:  "Q7: Patience (patient)",
    8:  "Q8: Patience (regulate emotions)",
    9:  "Q9: Patience (don't lose cool)",
    10: "Q10: Patience (no negative feelings)",
    11: "Q11: Meaning (meaningful life)",
    12: "Q12: Meaning (clear sense of meaning)",
    13: "Q13: Meaning (crucial for meaning)",
    14: "Q14: External Motivation",
    15: "Q15: Introjected Motivation",
    16: "Q16: Integrated Motivation",
    17: "Q17: Intrinsic Motivation",
    18: "Q18: Integrative ER (understand why)",
    19: "Q19: Integrative ER (observe emotions)",
    20: "Q20: Suppressive ER (hide feelings)",
    21: "Q21: Suppressive ER (keep to self)",
    22: "Q22: Suppressive ER (control/suppress)",
    23: "Q23: Goal Identity (core aspect)",
    24: "Q24: Goal Identity (reflection of who I am)",
    25: "Q25: Goal Identity (sense of self)",
    26: "Q26: CSW Up (self-esteem boost)",
    27: "Q27: CSW Up (feel worthwhile)",
    28: "Q28: CSW Up (feel good)",
    29: "Q29: CSW Up (self-worth goes up)",
    30: "Q30: CSW Down (self-worth suffers)",
    31: "Q31: CSW Down (self-esteem goes down)",
    32: "Q32: CSW Down (feel bad)",
    33: "Q33: CSW Down (self-worth goes down)",
    34: "Q34: Courage (courageous)",
    35: "Q35: Courage (overcome anxiety)",
    36: "Q36: Courage (beyond fears)",
    37: "Q37: Courage (risky)",
    38: "Q38: Courage (despite threats)",
    39: "Q39: Progress (lot of progress)",
    40: "Q40: Progress (on track)",
    41: "Q41: Progress (close to achieving)",
    42: "Q42: Human Accountability",
    43: "Q43: Transcendent Accountability",
}

CONDITION_MAP = {
    1: "Purpose Outcome Obstacle Plan",
    2: "Goal Outcome Obstacle Plan",
    3: "Control Condition",
}

Q1_TO_22  = list(range(1, 23))
Q23_TO_43 = list(range(23, 44))

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

TRANSITIONS = [
    (1, 2),
    (2, 3),
    (3, 4),
    (4, 5),
    (5, 6),
    (1, 6),
]


def fetch_data(engine):
    """
    Fetches Likert columns GT{t}Q{q} and Condition for all valid (t, q)
    combinations.
    Q1–Q22: T1–T6. Q23–Q43: T2–T6.

    Returns a list of dicts keyed by 'GT{t}Q{q}' plus 'Condition'.
    """
    cols = ['"Condition"']
    for t in range(1, 7):
        for q in Q1_TO_22:
            cols.append(f'"GT{t}Q{q}"')
    for t in range(2, 7):
        for q in Q23_TO_43:
            cols.append(f'"GT{t}Q{q}"')

    col_str = ", ".join(cols)
    query   = sqlalchemy.text(f'SELECT {col_str} FROM "GoalIntervention"')

    with engine.connect() as conn:
        result = conn.execute(query)
        rows   = result.fetchall()
        if not rows:
            return []
        keys = list(result.keys())
        return [dict(zip(keys, row)) for row in rows]


def _safe_int(val):
    try:
        v = int(float(val))
        if 1 <= v <= 7:
            return v
    except (TypeError, ValueError):
        pass
    return None


def _safe_condition(val):
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return None


def _build_sankey(rows, t_start, t_end, q_num, condition=0):
    """
    Build a single Sankey figure dict for one question, one transition,
    and optionally one condition (0 = all conditions).

    Returns (fig.to_dict(), stats_dict) or None if no valid data.
    """
    if condition != 0:
        rows = [r for r in rows if _safe_condition(r.get("Condition")) == condition]

    col_start = f"GT{t_start}Q{q_num}"
    col_end   = f"GT{t_end}Q{q_num}"

    flow_counts = {}
    for row in rows:
        s = _safe_int(row.get(col_start))
        e = _safe_int(row.get(col_end))
        if s is not None and e is not None:
            flow_counts[(s, e)] = flow_counts.get((s, e), 0) + 1

    if not flow_counts:
        return None

    total    = sum(flow_counts.values())
    improved = sum(cnt for (s, e), cnt in flow_counts.items() if e > s)
    same     = sum(cnt for (s, e), cnt in flow_counts.items() if e == s)
    declined = sum(cnt for (s, e), cnt in flow_counts.items() if e < s)

    top_flows = sorted(flow_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    top_flows_out = [
        {"from": LIKERT_LABELS[s], "to": LIKERT_LABELS[e], "count": cnt}
        for (s, e), cnt in top_flows
    ]

    stats = {
        "total":        total,
        "improved":     improved,
        "same":         same,
        "declined":     declined,
        "improved_pct": round(improved / total * 100, 1) if total else 0,
        "same_pct":     round(same     / total * 100, 1) if total else 0,
        "declined_pct": round(declined / total * 100, 1) if total else 0,
        "top_flows":    top_flows_out,
    }

    w_start = f"Week {t_start}"
    w_end   = f"Week {t_end}"

    labels     = []
    label_dict = {}
    for score in reversed(range(1, 8)):
        labels.append(f"{w_start}: {LIKERT_LABELS[score]}")
        label_dict[("start", score)] = len(labels) - 1
    for score in reversed(range(1, 8)):
        labels.append(f"{w_end}: {LIKERT_LABELS[score]}")
        label_dict[("end", score)] = len(labels) - 1

    source, target, value, link_colors = [], [], [], []
    for (s_score, e_score), count in sorted(flow_counts.items()):
        source.append(label_dict[("start", s_score)])
        target.append(label_dict[("end",   e_score)])
        value.append(count)
        if e_score > s_score:
            link_colors.append("rgba(26, 150, 65, 0.4)")
        elif e_score < s_score:
            link_colors.append("rgba(215, 48, 39, 0.4)")
        else:
            link_colors.append("rgba(253, 174, 97, 0.4)")

    node_colors = [SCORE_COLORS[s] for s in reversed(range(1, 8))] * 2

    condition_label = (
        CONDITION_MAP.get(condition, "All Conditions")
        if condition != 0
        else "All Conditions"
    )
    q_short = QUESTION_SHORT.get(q_num, f"Q{q_num}")

    fig = go.Figure(data=[go.Sankey(
        arrangement="snap",
        node=dict(
            pad=15,
            thickness=20,
            line=dict(color="white", width=2),
            label=labels,
            color=node_colors,
        ),
        link=dict(
            source=source,
            target=target,
            value=value,
            color=link_colors,
        ),
    )])

    fig.update_layout(
        title=dict(
            text=(
                f"<b>{q_short}</b>  |  {condition_label}<br>"
                f"<sub>{w_start} → {w_end} &nbsp;|&nbsp; "
                f"<span style='color:rgba(26,150,65,0.9)'>&#9650; Improved</span> &nbsp; "
                f"<span style='color:rgba(253,174,97,0.9)'>&#9654; No change</span> &nbsp; "
                f"<span style='color:rgba(215,48,39,0.9)'>&#9660; Declined</span></sub>"
            ),
            font=dict(size=15, color="#e9eefc"),
        ),
        font=dict(size=12, color="#c8d6f0"),
        height=650,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(t=80, l=20, r=20, b=20),
    )

    return fig.to_dict(), stats


def build_figure(engine):
    """
    Main entry point called by the backend.

    Returns a dict with:
      - "transitions":  list of {label, key}
      - "conditions":   list of {label, value} for the condition dropdown
      - "figures":      dict keyed by "{transition_key}_C{condition}" ->
                        list of {q_num, title, construct, figure, stats}
    """
    rows = fetch_data(engine)
    if not rows:
        return {"transitions": [], "conditions": [], "figures": {}}

    transitions_meta = []
    for t_start, t_end in TRANSITIONS:
        label = (
            "Week 1 → Week 6 (Overall)"
            if t_start == 1 and t_end == 6
            else f"Week {t_start} → Week {t_end}"
        )
        transitions_meta.append({"label": label, "key": f"W{t_start}_W{t_end}"})

    conditions_meta = [{"label": "All Conditions", "value": 0}] + [
        {"label": lbl, "value": val}
        for val, lbl in CONDITION_MAP.items()
    ]

    figures = {}
    for t_start, t_end in TRANSITIONS:
        t_key    = f"W{t_start}_W{t_end}"
        valid_qs = Q1_TO_22 if t_start == 1 else Q1_TO_22 + Q23_TO_43

        for condition in [0, 1, 2, 3]:
            fig_key   = f"{t_key}_C{condition}"
            q_figures = []

            for q_num in valid_qs:
                result = _build_sankey(rows, t_start, t_end, q_num, condition)
                if result is not None:
                    fig_dict, stats = result
                    q_figures.append({
                        "q_num":     q_num,
                        "title":     QUESTION_SHORT.get(q_num, f"Q{q_num}"),
                        "construct": QUESTION_LABELS.get(q_num, ""),
                        "figure":    fig_dict,
                        "stats":     stats,
                    })

            figures[fig_key] = q_figures

    return {
        "transitions": transitions_meta,
        "conditions":  conditions_meta,
        "figures":     figures,
    }
