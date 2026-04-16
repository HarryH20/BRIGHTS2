import io
import base64
import sqlalchemy
import plotly.graph_objects as go
from collections import Counter
from wordcloud import WordCloud, STOPWORDS
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

REFLECT_TIMEPOINTS = [2, 3, 4, 5, 6]
PROGRESS_COLS = [2, 3, 4, 5, 6]

BASE_EXTRA_STOPWORDS = {
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
}

OVERLAP_COMPARISON_TOP_N = 80
MAX_WORDS = 80
WC_WIDTH, WC_HEIGHT = 900, 450


def _safe_float(val):
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _tokenize(text, stopwords):
    import re
    tokens = re.findall(r"[a-zA-Z']{3,}", text.lower())
    return [t for t in tokens if t not in stopwords]


def _get_top_words(texts, stopwords, n=OVERLAP_COMPARISON_TOP_N):
    counter = Counter()
    for text in texts:
        counter.update(_tokenize(text, stopwords))
    return {word for word, _ in counter.most_common(n)}


def _build_stopwords(high_texts, low_texts):
    base = STOPWORDS | BASE_EXTRA_STOPWORDS
    high_top = _get_top_words(high_texts, base)
    low_top = _get_top_words(low_texts, base)
    shared = high_top & low_top
    final_stopwords = base | shared
    return final_stopwords, shared


def fetch_data(engine):
    reflect_cols = [f'"GT{t}Reflect"' for t in REFLECT_TIMEPOINTS]
    progress_cols = [f'"GT{t}Q39"' for t in PROGRESS_COLS]
    all_cols = reflect_cols + progress_cols

    query = sqlalchemy.text(
        f'SELECT {", ".join(all_cols)} FROM "GoalIntervention"'
    )

    with engine.connect() as conn:
        result = conn.execute(query)
        rows = result.fetchall()
        if not rows:
            return []
        keys = list(result.keys())
        raw = [dict(zip(keys, row)) for row in rows]

    records = []
    for row in raw:
        texts = []
        for t in REFLECT_TIMEPOINTS:
            v = row.get(f"GT{t}Reflect", "")
            if v and str(v).strip() not in ("", "nan", "None"):
                texts.append(str(v).strip())
        all_reflections = " ".join(texts).strip()

        scores = []
        for t in PROGRESS_COLS:
            v = _safe_float(row.get(f"GT{t}Q39"))
            if v is not None:
                scores.append(v)
        mean_progress = sum(scores) / len(scores) if scores else None

        if all_reflections and mean_progress is not None:
            records.append({
                "all_reflections": all_reflections,
                "mean_progress": mean_progress,
            })

    return records


def build_figure(engine):
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

    scores = sorted(r["mean_progress"] for r in records)
    mid = len(scores) // 2
    median_prog = (
        (scores[mid - 1] + scores[mid]) / 2
        if len(scores) % 2 == 0
        else scores[mid]
    )

    high_texts = [r["all_reflections"] for r in records if r["mean_progress"] >= median_prog]
    low_texts = [r["all_reflections"] for r in records if r["mean_progress"] < median_prog]

    stopwords, shared_removed = _build_stopwords(high_texts, low_texts)

    def make_wc(texts, colormap):
        combined = " ".join(texts).strip()
        if not combined:
            combined = "no meaningful text available"
        return WordCloud(
            width=WC_WIDTH,
            height=WC_HEIGHT,
            background_color="#0d1117",
            colormap=colormap,
            max_words=MAX_WORDS,
            stopwords=stopwords,
            prefer_horizontal=0.85,
            collocations=False,
        ).generate(combined)

    wc_high = make_wc(high_texts, "Greens")
    wc_low = make_wc(low_texts, "Reds")

    fig_mpl, axes = plt.subplots(
        1, 2,
        figsize=(18, 5.5),
        facecolor="#0d1117",
        gridspec_kw={"wspace": 0.04},
    )

    for ax, wc, title, color in [
        (axes[0], wc_high, "High Progress Reflections", "#2ecc71"),
        (axes[1], wc_low, "Low Progress Reflections", "#e74c3c"),
    ]:
        ax.imshow(wc, interpolation="bilinear")
        ax.axis("off")
        ax.set_facecolor("#0d1117")
        ax.set_title(title, fontsize=15, fontweight="bold", color=color, pad=10)

    plt.tight_layout(pad=0.5)

    buf = io.BytesIO()
    fig_mpl.savefig(
        buf,
        format="png",
        dpi=150,
        bbox_inches="tight",
        facecolor="#0d1117",
    )
    plt.close(fig_mpl)
    buf.seek(0)
    img_b64 = base64.b64encode(buf.read()).decode("utf-8")

    img_height = WC_HEIGHT + 80

    shared_list = sorted(list(shared_removed))
    shared_sample = ", ".join(shared_list[:8])
    subtitle = (
        f"{len(shared_removed)} words shared by both groups removed as stopwords"
        + (f" (e.g. {shared_sample}{'…' if len(shared_list) > 8 else ''})" if shared_removed else "")
    )

    fig = go.Figure()
    fig.add_layout_image(
        dict(
            source=f"data:image/png;base64,{img_b64}",
            xref="paper",
            yref="paper",
            x=0,
            y=1,
            sizex=1,
            sizey=1,
            xanchor="left",
            yanchor="top",
            layer="above",
        )
    )

    fig.update_layout(
        title=dict(
            text=(
                "<b>Word Clouds: Reflection Language by Progress Group</b><br>"
                f"<sub>{subtitle}</sub>"
            ),
            font=dict(size=15, color="#e9eefc"),
        ),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(visible=False, range=[0, 1]),
        yaxis=dict(visible=False, range=[0, 1]),
        height=img_height,
        margin=dict(t=70, l=0, r=0, b=0),
    )

    return fig.to_dict()