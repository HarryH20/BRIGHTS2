# backend/ageplot.py
import re
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import plotly.graph_objects as go
import sqlalchemy


def _to_int_age(raw: Any) -> Optional[int]:
    """
    Convert GoalIntervention."Age" (stored as text) into an integer age.

    Handles cases like:
      "23", " 23 ", "23.0", "Age: 23", "23 years", "23yrs"
    Ignores:
      None, "", "NA", "unknown", etc.
    """
    if raw is None:
        return None

    s = str(raw).strip()
    if not s:
        return None

    if s.lower() in {"na", "n/a", "null", "none", "unknown", "unk", "missing"}:
        return None

    # Find the first number in the string (supports decimals)
    m = re.search(r"(\d+(\.\d+)?)", s)
    if not m:
        return None

    try:
        val = float(m.group(1))
    except Exception:
        return None

    if np.isnan(val) or np.isinf(val):
        return None

    age = int(round(val))
    return age


def _build_bins(min_age: int, max_age: int, bin_size: int) -> Tuple[List[str], List[Tuple[int, int]]]:
    """
    Create inclusive label bins like 0-4, 5-9, ...
    max_age is treated as an exclusive upper bound for bin assignment (i.e., age >= max_age => overflow).
    """
    if bin_size <= 0:
        raise ValueError("bin_size must be > 0")
    if min_age >= max_age:
        raise ValueError("min_age must be < max_age")

    bins: List[Tuple[int, int]] = []
    labels: List[str] = []

    start = min_age
    while start < max_age:
        end_inclusive = start + bin_size - 1
        bins.append((start, end_inclusive))
        labels.append(f"{start}-{end_inclusive}")
        start += bin_size

    return labels, bins


def fetch_data(
    engine,
    participant_id: Optional[str] = None,
    goal_id: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Fetch ages from GoalIntervention and return histogram-ready data.

    Optional filters:
      participant_id -> filters by "ID" (participant id in your schema)
      goal_id        -> filters by "GoalID"

    Optional histogram params (via kwargs):
      bin_size (int, default 5)
      min_age  (int, default 0)
      max_age  (int, default 100)
      include_under_overflow (bool, default True)
    """
    bin_size = int(kwargs.get("bin_size", 5))
    min_age = int(kwargs.get("min_age", 0))
    max_age = int(kwargs.get("max_age", 100))
    include_under_overflow = bool(kwargs.get("include_under_overflow", True))

    labels, bins = _build_bins(min_age, max_age, bin_size)
    counts = [0] * len(bins)

    underflow = 0
    overflow = 0
    unknown = 0
    total_parsed = 0

    # Build SQL with optional filters (kept similar to your other module style)
    where = ['"Age" IS NOT NULL', 'TRIM("Age") != \'\'']
    params: Dict[str, Any] = {}

    if participant_id:
        where.append('"ID" = :pid')
        params["pid"] = participant_id

    if goal_id:
        where.append('"GoalID" = :gid')
        params["gid"] = goal_id

    sql = f"""
        SELECT "Age"
        FROM "GoalIntervention"
        WHERE {" AND ".join(where)}
    """

    with engine.connect() as conn:
        rows = conn.execute(sqlalchemy.text(sql), params).fetchall()

    # Parse and bin
    for row in rows:
        raw_age = row[0]
        age = _to_int_age(raw_age)

        if age is None:
            unknown += 1
            continue

        # Basic sanity filter (helps remove accidental IDs, etc.)
        # Adjust these limits if your dataset includes younger/older participants.
        if age < 0 or age > 120:
            unknown += 1
            continue

        total_parsed += 1

        if age < min_age:
            if include_under_overflow:
                underflow += 1
            continue

        if age >= max_age:
            if include_under_overflow:
                overflow += 1
            continue

        idx = (age - min_age) // bin_size
        if 0 <= idx < len(counts):
            counts[idx] += 1

    return {
        "title": "Age Distribution",
        "bin_size": bin_size,
        "min_age": min_age,
        "max_age": max_age,
        "labels": labels,
        "counts": counts,
        "total_rows_considered": len(rows),
        "total_parsed": total_parsed,
        "unknown": unknown,
        "underflow": underflow,
        "overflow": overflow,
        "filters": {
            "participant_id": participant_id,
            "goal_id": goal_id,
        },
    }


def build_figure(data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Build a Plotly bar chart for age distribution.

    Expects data from fetch_data().
    Returns fig.to_dict() for JSON serialization.
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

    labels = data.get("labels", [])
    counts = data.get("counts", [])
    total_parsed = data.get("total_parsed", 0)
    unknown = data.get("unknown", 0)
    underflow = data.get("underflow", 0)
    overflow = data.get("overflow", 0)

    fig = go.Figure()

    fig.add_trace(
        go.Bar(
            x=labels,
            y=counts,
            name="Count",
            hovertemplate="<b>Age range</b>: %{x}<br><b>Count</b>: %{y}<extra></extra>",
        )
    )

    subtitle_bits = [f"parsed={total_parsed}", f"unknown={unknown}"]
    if underflow:
        subtitle_bits.append(f"underflow={underflow}")
    if overflow:
        subtitle_bits.append(f"overflow={overflow}")

    fig.update_layout(
        title=dict(
            text=f"<b>Age Distribution</b><br><sub>{', '.join(subtitle_bits)}</sub>",
            x=0.5,
            xanchor="center",
            font=dict(size=20, color="#e9eefc"),
        ),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(t=110, l=60, r=40, b=80),
        showlegend=False,
        xaxis=dict(
            title="Age Range",
            tickangle=-45,
            tickfont=dict(color="#c8d6f0"),
            titlefont=dict(color="#c8d6f0"),
            gridcolor="rgba(200,200,200,0.15)",
        ),
        yaxis=dict(
            title="Count",
            tickfont=dict(color="#c8d6f0"),
            titlefont=dict(color="#c8d6f0"),
            gridcolor="rgba(200,200,200,0.15)",
            zerolinecolor="rgba(200,200,200,0.2)",
        ),
    )

    return fig.to_dict()