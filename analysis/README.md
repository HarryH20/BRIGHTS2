# Adding a New Graph — DS Team Guide

Each graph lives as its own Python file in this directory. The backend
auto-discovers files here and serves them as API endpoints — no backend
code changes are needed when you add a new graph.

---

## File naming

The filename becomes the URL. Name it clearly and in lowercase with no
spaces:

```
analysis/roseplot.py        →  GET /api/visualizations/roseplot
analysis/goalprogress.py    →  GET /api/visualizations/goalprogress
analysis/sentiment.py       →  GET /api/visualizations/sentiment
```

---

## Every file must have exactly these two functions

### 1. `fetch_data(participant_id, engine)`

Queries the database and returns whatever data your graph needs.
Return `None` if the participant has no data — `build_figure` handles
the empty state.

```python
def fetch_data(participant_id, engine):
    """
    participant_id : str   — the logged-in user's study ID
    engine         : sqlalchemy Engine — use this to query the DB

    Returns your data in whatever shape build_figure expects,
    or None if no data exists for this participant.
    """
    if not participant_id:
        return None

    with engine.connect() as conn:
        result = conn.execute(
            sqlalchemy.text('SELECT ... FROM "YourTable" WHERE "ID" = :pid'),
            {"pid": participant_id},
        )
        rows = result.fetchall()

    if not rows:
        return None

    # process rows into whatever shape your graph needs
    return processed_data
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
            title=dict(text="No data available yet", x=0.5),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
        )
        return fig.to_dict()

    fig = go.Figure(...)
    # ... your chart logic ...
    return fig.to_dict()   # <-- always end with this
```

---

## Full minimal example

```python
# analysis/myneograph.py

import sqlalchemy
import plotly.graph_objects as go


def fetch_data(participant_id, engine):
    if not participant_id:
        return None

    with engine.connect() as conn:
        result = conn.execute(
            sqlalchemy.text(
                'SELECT "SomeColumn" FROM "SomeTable" WHERE "ID" = :pid'
            ),
            {"pid": participant_id},
        )
        rows = result.fetchall()

    if not rows:
        return None

    return [row._mapping["SomeColumn"] for row in rows]


def build_figure(data):
    if not data:
        fig = go.Figure()
        fig.update_layout(title=dict(text="No data available yet", x=0.5))
        return fig.to_dict()

    fig = go.Figure(go.Bar(x=list(range(len(data))), y=data))
    fig.update_layout(
        title=dict(text="My New Graph", x=0.5),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
    )
    return fig.to_dict()
```

This file alone is enough — the endpoint `/api/visualizations/myneograph`
is live the moment the backend restarts.

---

## Rules

- No `fig.show()` — the frontend renders the figure, not the script
- No `google.colab`, `drive.mount`, or hardcoded file paths
- No hardcoded participant IDs — always use the `participant_id` argument
- Always return `fig.to_dict()` at the end of `build_figure`
- Always handle `data=None` in `build_figure`
- Use `plotly.graph_objects` or `plotly.express` — the frontend uses
  `react-plotly.js` which expects Plotly JSON

---

## Telling the frontend dev

Once your file is added, tell the frontend dev:

- **Endpoint:** `/api/visualizations/<your_filename_without_.py>`
- **What the graph shows:** brief description
- **Suggested size/placement:** any layout notes

They will create a component in `frontend/src/graphs/` and place it on
the relevant page.
