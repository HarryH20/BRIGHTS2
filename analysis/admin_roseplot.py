from collections import defaultdict
import sqlalchemy

def _parse_int(x, default=None):
    try:
        return int(x)
    except (TypeError, ValueError):
        return default

def _parse_weeks(weeks):
    if weeks is None:
        return [2, 3, 4, 5, 6]
    s = str(weeks).strip().lower()
    if s in ("", "all"):
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

def fetch_data(engine, user_id=None, goal_id=None, weeks=None, **_ignored):
    """
    Aggregates Q39/Q40/Q41 across:
      - all users (default) OR one user_id
      - all goals (default) OR one goal_index (1..3)
      - selected weeks (default 2-6)
    Returns same shape as analysis/roseplot.py expects: {"scores": {2..6: {Q39,Q40,Q41}}}
    """

    selected_weeks = _parse_weeks(weeks)

    # Normalize filters
    uid = None
    if user_id not in (None, "", "all"):
        uid = _parse_int(user_id)

    gidx = None
    if goal_id not in (None, "", "all"):
        gidx = _parse_int(goal_id)

    sql = """
        SELECT sr.timepoint, sq.question_number, sr.response_value
        FROM survey_responses sr
        JOIN survey_questions sq ON sq.id = sr.question_id
        WHERE sr.timepoint BETWEEN 2 AND 6
          AND sq.question_number IN (39, 40, 41)
          AND sr.response_value IS NOT NULL
    """
    params = {}
    if uid is not None:
        sql += " AND sr.user_id = :uid"
        params["uid"] = uid
    if gidx is not None:
        sql += " AND sr.goal_index = :gidx"
        params["gidx"] = gidx

    totals = defaultdict(lambda: defaultdict(list))

    with engine.connect() as conn:
        rows = conn.execute(sqlalchemy.text(sql), params).fetchall()

    if not rows:
        return None

    for row in rows:
        m = row._mapping
        t = int(m["timepoint"])
        if t not in selected_weeks:
            continue
        q = f"Q{int(m['question_number'])}"
        try:
            totals[t][q].append(int(m["response_value"]))
        except (TypeError, ValueError):
            pass

    scores = {}
    for t in range(2, 7):
        scores[t] = {}
        for q in ("Q39", "Q40", "Q41"):
            if t not in selected_weeks:
                scores[t][q] = None
                continue
            vals = totals[t][q]
            scores[t][q] = round(sum(vals) / len(vals)) if vals else None

    return {
        "scores": scores,
        "selected_weeks": selected_weeks,
        "goal_id": gidx,
        "user_id": uid,
    }