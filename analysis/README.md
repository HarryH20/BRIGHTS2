# Adding a New Graph — DS Team Guide

Each graph lives as its own Python file in this directory. The backend
auto-discovers files here and serves them as API endpoints — no backend
code changes are needed when you add a new graph, except for one step
(see the Allowlist section below).

---

## File naming

The filename becomes the URL. Name it clearly and in lowercase with no
spaces:

```
analysis/roseplot.py        →  GET /api/visualizations/roseplot
analysis/radarplot.py       →  GET /api/visualizations/radarplot
analysis/goalprogress.py    →  GET /api/visualizations/goalprogress
```

---

## Step 1 — Add your file to the allowlist

For security, only filenames listed in `_ALLOWED_GRAPHS` inside
`backend/routes/visualizations.py` will be served. Before your endpoint
will work, open that file and add your module name:

```python
# backend/routes/visualizations.py
_ALLOWED_GRAPHS = {"roseplot", "radarplot", "yourfilename"}
```

Without this step the endpoint returns 404.

---

## Step 2 — Implement two functions

### 1. `fetch_data(user_id, engine, **kwargs)`

Queries the database and returns whatever data your graph needs.
Return `None` if the user has no data — `build_figure` handles the
empty state.

**Important:** the first argument is `user_id` (an integer — the
logged-in user's primary key in the `users` table). This is **not** the
same as `participant_id` (the research study ID string).

Any URL query parameters (e.g. `?goal_index=1&weeks=2-6`) are forwarded
automatically as `kwargs` so you can accept optional filters:

```python
def fetch_data(user_id, engine, goal_index=0, **kwargs):
    """
    user_id    : int              — logged-in user's DB primary key
    engine     : sqlalchemy Engine — use this to query the DB
    goal_index : int (optional)  — example query param; cast from str
    **kwargs   : absorbs any extra URL params you don't use

    Returns your data in whatever shape build_figure expects,
    or None if no data exists for this user.
    """
    if not user_id:
        return None

    goal_index = int(goal_index)  # URL params arrive as strings — cast as needed

    with engine.connect() as conn:
        rows = conn.execute(
            sqlalchemy.text("""
                SELECT sr.timepoint, sq.question_number, sr.response_value
                FROM survey_responses sr
                JOIN survey_questions sq ON sq.id = sr.question_id
                WHERE sr.user_id = :uid
                  AND sr.goal_index = :gidx
                  AND sq.question_number IN (39, 40, 41)
                  AND sr.response_value IS NOT NULL
                ORDER BY sr.timepoint
            """),
            {"uid": user_id, "gidx": goal_index + 1},  # goal_index is 0-based; DB stores 1-based
        ).fetchall()

    if not rows:
        return None

    # Access columns via row._mapping["column_name"]
    return [{"timepoint": r._mapping["timepoint"],
             "q": r._mapping["question_number"],
             "value": r._mapping["response_value"]} for r in rows]
```

### 2. `build_figure(data)`

Takes the output of `fetch_data` and returns a Plotly figure as a dict.
Must handle the case where `data` is `None`.

```python
def build_figure(data):
    """
    data : whatever fetch_data returned (could be None)

    Must return fig.to_dict() — this is what gets sent to the frontend.
    """
    if not data:
        fig = go.Figure()
        fig.update_layout(
            title=dict(text="No data available yet", x=0.5,
                       xanchor="center", font=dict(color="#e9eefc", size=18)),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
        )
        return fig.to_dict()

    fig = go.Figure(...)
    # ... your chart logic ...
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",   # keep transparent — dark island layout
        plot_bgcolor="rgba(0,0,0,0)",
    )
    return fig.to_dict()   # <-- always end with this
```

---

## Database tables

Query these via the `engine` argument using SQLAlchemy `text()`:

| Table | Key columns | Notes |
|-------|-------------|-------|
| `survey_responses` | `user_id`, `goal_index` (1–3), `timepoint` (1–6), `question_id`, `response_value` (text) | Primary data store for all in-app survey responses |
| `survey_questions` | `id`, `question_number` (1–43), `form_type` (t1/t2/t3t5/t6), `scale_type` (likert7/goal_text), `question_text` | JOIN with survey_responses to get question numbers/text |
| `users` | `id`, `participant_id`, `username`, `display_name` | participant_id links to GoalIntervention."ID" for historical data |
| `GoalIntervention` | `"ID"` (participant_id), `"GoalT1"`, `"GT2Q39"`, `"GT2Q40"`, `"GT2Q41"`, … `"GT6Q41"` | Legacy table — historical research data. Only Q39/40/41 at T2–T6. |

### Typical join pattern (survey_responses + survey_questions)

```python
with engine.connect() as conn:
    rows = conn.execute(
        sqlalchemy.text("""
            SELECT sr.goal_index, sr.timepoint, sq.question_number, sr.response_value
            FROM survey_responses sr
            JOIN survey_questions sq ON sq.id = sr.question_id
            WHERE sr.user_id = :uid
              AND sq.question_number IN (39, 40, 41)
              AND sr.response_value IS NOT NULL
            ORDER BY sr.goal_index, sr.timepoint, sq.question_number
        """),
        {"uid": user_id},
    ).fetchall()

# Read columns like this:
for row in rows:
    m = row._mapping
    print(m["timepoint"], m["question_number"], m["response_value"])
```

### Goal text (what the participant named each goal)

Goal texts are stored in `survey_responses` for the T1 form, with `scale_type = 'goal_text'`:

```python
text_row = conn.execute(
    sqlalchemy.text("""
        SELECT sr.goal_index, sr.response_value
        FROM survey_responses sr
        JOIN survey_questions sq ON sq.id = sr.question_id
        WHERE sr.user_id = :uid
          AND sq.scale_type = 'goal_text'
        ORDER BY sr.goal_index
    """),
    {"uid": user_id},
).fetchall()
```

---

## Question numbering

| Question(s) | Trait | Available at |
|-------------|-------|--------------|
| Q1–Q3 | Commitment (baseline) | T1 and all later timepoints |
| Q4, Q11–Q13 | Importance (baseline) | T1 and all later timepoints |
| Q5–Q10, Q18–Q22 | Self-Control | T1 and all later timepoints |
| Q14–Q17 | Autonomy | T1 and all later timepoints |
| Q23–Q25 | Commitment (change) | T2+ only |
| Q26–Q33 | Momentum (change) | T2+ only |
| Q39 | Progress toward goal | T2+ only |
| Q40 | Confidence in achieving goal | T2+ only |
| Q41 | Goal importance | T2+ only |
| Q42–Q43 | Momentum (additional) | T2+ only |

**Note:** Historical participants (GoalIntervention data) only have Q39/Q40/Q41 at T2–T6.
Participants who completed the in-app survey will have Q1–Q43 for the
timepoints they submitted.

---

## Full minimal example

```python
# analysis/mygraph.py

import sqlalchemy
import plotly.graph_objects as go


def fetch_data(user_id, engine, **kwargs):
    if not user_id:
        return None

    with engine.connect() as conn:
        rows = conn.execute(
            sqlalchemy.text("""
                SELECT sr.timepoint, sr.response_value
                FROM survey_responses sr
                JOIN survey_questions sq ON sq.id = sr.question_id
                WHERE sr.user_id = :uid
                  AND sq.question_number = 39
                  AND sr.response_value IS NOT NULL
                ORDER BY sr.timepoint
            """),
            {"uid": user_id},
        ).fetchall()

    if not rows:
        return None

    return [{"t": r._mapping["timepoint"], "v": int(r._mapping["response_value"])}
            for r in rows]


def build_figure(data):
    if not data:
        fig = go.Figure()
        fig.update_layout(
            title=dict(text="No data available yet", x=0.5,
                       xanchor="center", font=dict(color="#e9eefc", size=18)),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
        )
        return fig.to_dict()

    timepoints = [d["t"] for d in data]
    values = [d["v"] for d in data]

    fig = go.Figure(go.Scatter(x=timepoints, y=values, mode="lines+markers"))
    fig.update_layout(
        title=dict(text="Progress over time", x=0.5, xanchor="center",
                   font=dict(color="#e9eefc", size=20)),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(tickvals=[2, 3, 4, 5, 6],
                   ticktext=["Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
                   gridcolor="rgba(200,200,200,0.2)", color="#c8d6f0"),
        yaxis=dict(range=[1, 7], gridcolor="rgba(200,200,200,0.2)", color="#c8d6f0"),
    )
    return fig.to_dict()
```

Then add `"mygraph"` to `_ALLOWED_GRAPHS` in `backend/routes/visualizations.py`
and the endpoint `/api/visualizations/mygraph` is live on the next restart.

---

## Existing charts

| File | Endpoint | Params | Description |
|------|----------|--------|-------------|
| `roseplot.py` | `/api/visualizations/roseplot` | `goal_id` (1/2/3 or "all"), `weeks` ("2-6", "3-6", "4-6", "5-6", "all") | 6×3 polar bar grid — one bar per timepoint (T2–T6) per question (Q39/Q40/Q41), plus a distribution summary row. Only uses Q39/Q40/Q41. |
| `radarplot.py` | `/api/visualizations/radarplot` | `goal_index` (0-based int) | Spider chart for one goal. **Full mode** (in-app T1 data available): 5 traits (Commitment, Importance, Autonomy, Self-Control, Momentum) with T1 baseline vs slider T2–T6. **Simple mode** (historical GoalIntervention data only): 3 axes (Progress/Confidence/Importance from Q39/40/41) with T2 baseline vs slider T3–T6. Returns empty figure if no data at all. |

---

## Style guide

Charts render inside a dark card (`background: #0b1220`). Always set:

```python
paper_bgcolor="rgba(0,0,0,0)"
plot_bgcolor="rgba(0,0,0,0)"
```

Use these colours to match the app palette:

| Use | Hex |
|-----|-----|
| Primary accent (blue) | `#4f7cff` |
| Secondary accent (orange) | `#fc8d59` |
| Text / labels | `#c8d6f0` |
| Grid lines | `rgba(200,200,200,0.3)` |

---

## Rules

- No `fig.show()` — the frontend renders the figure, not the script
- No `google.colab`, `drive.mount`, or hardcoded file paths
- No hardcoded user IDs — always use the `user_id` argument
- Always return `fig.to_dict()` at the end of `build_figure`
- Always handle `data=None` in `build_figure`
- Use `plotly.graph_objects` or `plotly.express`
- Add your module name to `_ALLOWED_GRAPHS` in `backend/routes/visualizations.py`

---

## Telling the frontend dev

Once your file is added and allowlisted, tell the frontend dev:

- **Endpoint:** `/api/visualizations/<your_filename_without_.py>`
- **Query params (if any):** names, types, and defaults
- **What the graph shows:** brief description
- **Suggested size:** height in px, any layout notes

They will create a React component in `frontend/src/graphs/` using
`react-plotly.js` and wire it up to the relevant page.
