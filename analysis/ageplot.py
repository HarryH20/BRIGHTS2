import re
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import plotly.graph_objects as go
import sqlalchemy


def _to_int_age(raw: Any) -> Optional[int]:
    if raw is None:
        return None

    s = str(raw).strip()
    if not s:
        return None

    if s.lower() in {"na", "n/a", "null", "none", "unknown", "unk", "missing"}:
        return None

    match = re.search(r"(\d+(\.\d+)?)", s)
    if not match:
        return None

    try:
        value = float(match.group(1))
    except Exception:
        return None

    if np.isnan(value) or np.isinf(value):
        return None

    return int(round(value))


def _build_bins(min_age: int, max_age: int, bin_size: int) -> Tuple[List[str], List[Tuple[int, int]]]:
    if bin_size <= 0:
        raise ValueError("bin_size must be greater than 0")
    if min_age >= max_age:
        raise ValueError("min_age must be less than max_age")

    labels: List[str] = []
    bins: List[Tuple[int, int]] = []

    start = min_age
    while start < max_age:
        end_inclusive = start + bin_size - 1
        bins.append((start, end_inclusive))
        labels.append(f"{start}-{end_inclusive}")
        start += bin_size

    return labels, bins


def fetch_data(user_id, engine, goal_id=None, **kwargs) -> Dict[str, Any]:
    """
    Matches your existing graph system:
        fetch_data(user_id, engine, **kwargs)

    This version uses the working SQL logic you tested:
    - removes NULL ages
    - removes blank/whitespace-only ages
    - keeps only numeric-looking age values
    """

    bin_size = int(kwargs.get("bin_size", 5))
    min_age = int(kwargs.get("min_age", 0))
    max_age = int(kwargs.get("max_age", 100))

    include_under_overflow_raw = kwargs.get("include_under_overflow", True)
    if isinstance(include_under_overflow_raw, str):
        include_under_overflow = include_under_overflow_raw.lower() in {"true", "1", "yes", "y"}
    else:
        include_under_overflow = bool(include_under_overflow_raw)

    labels, bins = _build_bins(min_age, max_age, bin_size)
    counts = [0] * len(bins)

    underflow = 0
    overflow = 0
    unknown = 0
    total_parsed = 0

    where_clauses = [
        '"Age" IS NOT NULL',
        'TRIM("Age") <> \'\'',
        r'''TRIM("Age") ~ '^[0-9]+(\.[0-9]+)?$' ''',
    ]
    params: Dict[str, Any] = {}

    if goal_id is not None and str(goal_id).strip() != "":
        where_clauses.append('"GoalID" = :gid')
        params["gid"] = str(goal_id)

    sql = f"""
        SELECT "Age"
        FROM "GoalIntervention"
        WHERE {" AND ".join(where_clauses)}
        ORDER BY CAST(TRIM("Age") AS NUMERIC)
    """

    with engine.connect() as conn:
        rows = conn.execute(sqlalchemy.text(sql), params).fetchall()

    for row in rows:
        raw_age = row[0]
        age = _to_int_age(raw_age)

        if age is None:
            unknown += 1
            continue

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

        index = (age - min_age) // bin_size
        if 0 <= index < len(counts):
            counts[index] += 1

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
            "user_id": str(user_id) if user_id is not None else None,
            "goal_id": str(goal_id) if goal_id is not None else None,
        },
    }


def build_figure(data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
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

    subtitle_parts = [f"parsed={total_parsed}", f"unknown={unknown}"]
    if underflow:
        subtitle_parts.append(f"underflow={underflow}")
    if overflow:
        subtitle_parts.append(f"overflow={overflow}")

    fig.update_layout(
        title=dict(
            text=f"<b>Age Distribution</b><br><sub>{', '.join(subtitle_parts)}</sub>",
            x=0.5,
            xanchor="center",
            font=dict(size=20, color="#e9eefc"),
        ),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(t=110, l=60, r=40, b=80),
        showlegend=False,
        xaxis=dict(
            title=dict(text="Age Range", font=dict(color="#c8d6f0")),
            tickangle=-45,
            tickfont=dict(color="#c8d6f0"),
            gridcolor="rgba(200, 200, 200, 0.15)",
        ),
        yaxis=dict(
            title=dict(text="Count", font=dict(color="#c8d6f0")),
            tickfont=dict(color="#c8d6f0"),
            gridcolor="rgba(200, 200, 200, 0.15)",
            zerolinecolor="rgba(200, 200, 200, 0.2)",
        ),
    )

    return fig.to_dict()