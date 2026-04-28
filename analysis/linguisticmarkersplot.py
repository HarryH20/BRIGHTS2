# analysis/linguisticmarkersplot.py
#
# Diverging dot plot showing n-grams most predictive of High vs. Low
# goal progress, derived from TF-IDF + Logistic Regression on reflection text.

import sqlalchemy
import plotly.graph_objects as go
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REFLECT_TIMEPOINTS = [2, 3, 4, 5, 6]   # GT{t}Reflect columns
PROGRESS_COLS      = [2, 3, 4, 5, 6]   # GT{t}Q39 columns (goal progress)
TOP_N              = 15                  # n-grams per side

REFLECT_STOPWORDS = [
    'goal', 'goals', 'week', 'time', 'really', 'one', 'will',
    'think', 'feel', 'need', 'want', 'make', 'still', 'something',
    'lot', 'much', 'going', 'well', 'good', 'day', 'even', 'now',
    'way', 'bit', 'thing', 'things', 'back', 'getting', 'trying',
    'learned', 'life', 'better', 'important', 'work', 'achieve',
    'progress', 'take', 'making', 'others', 'made', 'pursuit',
    'pursuing', 'keep', 'person', 'self', 'help', 'effort', 'come',
    'continue', 'done', 'always', 'sometime', 'though', 'hard',
    'little', 'part', 'people', 'emotion', 'achieving', 'central',
    'sense', 'find', 'feeling', 'feels', 'every', 'long', 'last',
    'working', 'first', 'put', 'see', 'know', 'give', 'try', 'less',
    'new', 'able', 'toward', 'makes',
]


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------

def _safe_float(val):
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def fetch_data(engine):
    """
    Returns a list of dicts, one per participant, with keys:
      - 'all_reflections': concatenated GT{t}Reflect text across T2–T6
      - 'mean_progress':   mean of GT{t}Q39 across T2–T6
    """
    reflect_cols  = [f'"GT{t}Reflect"' for t in REFLECT_TIMEPOINTS]
    progress_cols = [f'"GT{t}Q39"'     for t in PROGRESS_COLS]
    all_cols      = reflect_cols + progress_cols

    query = sqlalchemy.text(
        f'SELECT {", ".join(all_cols)} FROM "GoalIntervention"'
    )

    with engine.connect() as conn:
        result = conn.execute(query)
        rows   = result.fetchall()
        if not rows:
            return []
        keys = list(result.keys())
        raw  = [dict(zip(keys, row)) for row in rows]

    records = []
    for row in raw:
        # Concatenate reflection text
        texts = []
        for t in REFLECT_TIMEPOINTS:
            v = row.get(f"GT{t}Reflect", "")
            if v and str(v).strip() not in ("", "nan", "None"):
                texts.append(str(v).strip())
        all_reflections = " ".join(texts).strip()

        # Mean progress score (Q39 across timepoints)
        scores = []
        for t in PROGRESS_COLS:
            v = _safe_float(row.get(f"GT{t}Q39"))
            if v is not None:
                scores.append(v)
        mean_progress = sum(scores) / len(scores) if scores else None

        if all_reflections and mean_progress is not None:
            records.append({
                "all_reflections": all_reflections,
                "mean_progress":   mean_progress,
            })

    return records


# ---------------------------------------------------------------------------
# Figure builder
# ---------------------------------------------------------------------------

def build_figure(engine):
    """
    Returns a Plotly figure dict (fig.to_dict()) of the diverging dot plot.
    """
    records = fetch_data(engine)
    if not records:
        fig = go.Figure()
        fig.update_layout(
            title="No data available",
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#e9eefc"),
        )
        return fig.to_dict()

    # Median split
    scores = [r["mean_progress"] for r in records]
    scores_sorted = sorted(scores)
    mid = len(scores_sorted) // 2
    median_prog = (scores_sorted[mid - 1] + scores_sorted[mid]) / 2 if len(scores_sorted) % 2 == 0 else scores_sorted[mid]

    high_texts = [r["all_reflections"] for r in records if r["mean_progress"] >= median_prog]
    low_texts  = [r["all_reflections"] for r in records if r["mean_progress"] <  median_prog]

    all_texts = high_texts + low_texts
    labels    = [1] * len(high_texts) + [0] * len(low_texts)

    # TF-IDF + Logistic Regression
    stop_words = list(REFLECT_STOPWORDS) + ['english']
    vectorizer = TfidfVectorizer(
        max_features=500,
        stop_words='english',
        ngram_range=(1, 2),
        min_df=2,
    )

    # Manually extend after fitting by adding extra stopwords
    vectorizer_custom = TfidfVectorizer(
        max_features=500,
        stop_words=REFLECT_STOPWORDS,
        ngram_range=(1, 2),
        min_df=2,
    )

    try:
        X = vectorizer_custom.fit_transform(all_texts)
    except ValueError:
        X = TfidfVectorizer(
            max_features=200,
            stop_words='english',
            ngram_range=(1, 2),
            min_df=1,
        ).fit_transform(all_texts)
        vectorizer_custom = TfidfVectorizer(
            max_features=200,
            stop_words='english',
            ngram_range=(1, 2),
            min_df=1,
        )
        X = vectorizer_custom.fit_transform(all_texts)

    feature_names = vectorizer_custom.get_feature_names_out()

    clf = LogisticRegression(max_iter=500, C=1.0)
    clf.fit(X, labels)

    # Sort features by coefficient
    coef_pairs = sorted(
        zip(feature_names, clf.coef_[0]),
        key=lambda x: x[1]
    )

    # Top N each side, deduplicated
    top_low  = coef_pairs[:TOP_N]
    top_high = coef_pairs[-TOP_N:]
    seen = set()
    combined = []
    for feat, coef in top_low + top_high:
        if feat not in seen:
            combined.append((feat, coef))
            seen.add(feat)
    combined.sort(key=lambda x: x[1])

    features = [f for f, _ in combined]
    coefs    = [c for _, c in combined]
    colors   = ["#e74c3c" if c < 0 else "#2ecc71" for c in coefs]

    # Build figure
    fig = go.Figure()

    # Reference line at x=0
    fig.add_shape(
        type="line",
        x0=0, x1=0,
        y0=-0.5, y1=len(features) - 0.5,
        line=dict(color="rgba(255,255,255,0.3)", width=1.5, dash="dash"),
    )

    # Horizontal connector lines
    for i, (feat, coef) in enumerate(zip(features, coefs)):
        fig.add_shape(
            type="line",
            x0=0, x1=coef,
            y0=i, y1=i,
            line=dict(color="rgba(200,214,240,0.25)", width=1.2),
        )

    fig.add_trace(go.Scatter(
        x=coefs,
        y=features,
        mode="markers",
        marker=dict(
            color=colors,
            size=13,
            line=dict(width=1.5, color="rgba(255,255,255,0.4)"),
        ),
        hovertemplate="%{y}: %{x:.4f}<extra></extra>",
    ))

    # Annotations for side labels
    x_min = min(coefs)
    x_max = max(coefs)
    x_range = x_max - x_min
    pad = x_range * 0.06

    fig.add_annotation(
        x=x_min - pad, y=len(features) - 1,
        text="← Low Progress",
        showarrow=False,
        font=dict(color="#e74c3c", size=12),
        xanchor="right",
    )
    fig.add_annotation(
        x=x_max + pad, y=len(features) - 1,
        text="High Progress →",
        showarrow=False,
        font=dict(color="#2ecc71", size=12),
        xanchor="left",
    )

    fig.update_layout(
        title=None,
        margin=dict(
            t=20, 
            r=20, 
            b=20, 
            l=20
        ),
        xaxis=dict(
            title="Logistic Regression Coefficient",
            title_font=dict(color="#c8d6f0"),
            tickfont=dict(color="#c8d6f0"),
            gridcolor="rgba(200,214,240,0.1)",
            zeroline=False,
        ),
        yaxis=dict(
            tickfont=dict(color="#c8d6f0", size=11),
            gridcolor="rgba(200,214,240,0.05)",
        ),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#c8d6f0"),
        height=700,
        showlegend=False,
    )

    return fig.to_dict()
