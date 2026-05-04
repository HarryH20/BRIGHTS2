import numpy as np
from datetime import datetime

# ── Default thresholds ─────────────────────────────────
# Based on: Meade & Craig 2012, Huang et al. 2012,
# Bowling et al. 2023, Ward & Meade 2023.

DEFAULT_THRESHOLDS = {
    'speeding': {
        'seconds_per_item_critical': 1.0,
        'seconds_per_item_warning': 2.0,
    },
    'straight_lining': {
        'longstring_critical': 14,
        'longstring_warning': 10,
        'irv_critical': 0.3,
        'irv_warning': 0.5,
    },
    'pattern_response': {
        'sign_change_ratio_warning': 0.85,
        'cycle_length_max': 4,
    },
    'low_variance': {
        'sd_critical': 0.3,
        'sd_warning': 0.5,
    },
    'missing_data': {
        'pct_missing_critical': 0.30,
        'pct_missing_warning': 0.15,
    },
}


def detect_speeding(completion_seconds, n_items, thresholds):
    """Returns (flag_type, severity, detail) or None."""
    if n_items == 0 or completion_seconds is None:
        return None
    spi = completion_seconds / n_items
    t = thresholds.get('speeding', DEFAULT_THRESHOLDS['speeding'])
    if spi < t['seconds_per_item_critical']:
        return ('speeding', 'critical',
            {'seconds_per_item': round(spi, 2),
             'total_seconds': completion_seconds,
             'n_items': n_items,
             'threshold': t['seconds_per_item_critical'],
             'literature': 'Huang et al. 2012: <1s/item'})
    if spi < t['seconds_per_item_warning']:
        return ('speeding', 'warning',
            {'seconds_per_item': round(spi, 2),
             'total_seconds': completion_seconds,
             'n_items': n_items,
             'threshold': t['seconds_per_item_warning'],
             'literature': 'Bowling et al. 2023: <2s/item'})
    return None


def detect_straight_lining(responses, thresholds):
    """responses: list of numeric Likert values (integers).
    Returns list of (flag_type, severity, detail).
    Uses longstring and IRV (Intra-Rater Variability)."""
    if len(responses) < 5:
        return []
    flags = []
    t = thresholds.get('straight_lining',
        DEFAULT_THRESHOLDS['straight_lining'])

    # Longstring: longest run of identical values
    arr = np.array(responses)
    diffs = np.diff(arr) != 0
    splits = np.split(arr, np.where(diffs)[0] + 1)
    ls = max(len(r) for r in splits)
    if ls >= t['longstring_critical']:
        flags.append(('straight_lining', 'critical',
            {'longstring': int(ls),
             'threshold': t['longstring_critical'],
             'responses': responses,
             'literature': 'Meade & Craig 2012'}))
    elif ls >= t['longstring_warning']:
        flags.append(('straight_lining', 'warning',
            {'longstring': int(ls),
             'threshold': t['longstring_warning'],
             'responses': responses}))

    # IRV: standard deviation of responses
    irv = float(np.std(arr, ddof=1))
    if irv < t['irv_critical']:
        flags.append(('straight_lining', 'critical',
            {'irv': round(irv, 3),
             'threshold': t['irv_critical'],
             'literature': 'Dunn et al. 2018'}))
    elif irv < t['irv_warning']:
        flags.append(('straight_lining', 'warning',
            {'irv': round(irv, 3),
             'threshold': t['irv_warning']}))

    return flags


def detect_pattern_response(responses, thresholds):
    """Detects alternating, zigzag, or short repeating patterns."""
    if len(responses) < 6:
        return []
    flags = []
    t = thresholds.get('pattern_response',
        DEFAULT_THRESHOLDS['pattern_response'])

    arr = np.array(responses)

    # Sign change ratio (zigzag detector)
    diffs = np.diff(arr)
    if len(diffs) > 1:
        signs = np.sign(diffs)
        non_zero = signs[signs != 0]
        if len(non_zero) > 2:
            sign_changes = int(np.sum(np.diff(non_zero) != 0))
            ratio = sign_changes / (len(non_zero) - 1)
            if ratio >= t['sign_change_ratio_warning']:
                flags.append(('pattern_response', 'warning',
                    {'sign_change_ratio': round(ratio, 3),
                     'threshold': t['sign_change_ratio_warning'],
                     'pattern': 'alternating/zigzag'}))

    # Short cycle detection (2–4 item repeats)
    for cycle_len in range(2, t['cycle_length_max'] + 1):
        if len(responses) < cycle_len * 3:
            continue
        pattern = responses[:cycle_len]
        matches = sum(
            1 for i in range(0, len(responses) - cycle_len, cycle_len)
            if responses[i:i + cycle_len] == pattern)
        if matches >= 3:
            flags.append(('pattern_response', 'warning',
                {'cycle_length': cycle_len,
                 'pattern': pattern,
                 'repetitions': matches}))
            break

    return flags


def detect_missing_data(responses_total, responses_answered, thresholds):
    """responses_total: total questions in survey.
    responses_answered: number with non-null values."""
    if responses_total == 0:
        return None
    pct_missing = (responses_total - responses_answered) / responses_total
    t = thresholds.get('missing_data',
        DEFAULT_THRESHOLDS['missing_data'])
    if pct_missing >= t['pct_missing_critical']:
        return ('missing_data', 'critical',
            {'pct_missing': round(pct_missing, 3),
             'n_missing': responses_total - responses_answered,
             'n_total': responses_total})
    if pct_missing >= t['pct_missing_warning']:
        return ('missing_data', 'warning',
            {'pct_missing': round(pct_missing, 3),
             'n_missing': responses_total - responses_answered,
             'n_total': responses_total})
    return None


def run_quality_checks(submission_id, responses, completion_seconds, thresholds=None):
    """Main entry point called after a survey submission.

    submission_id: int
    responses: list of dicts with keys: {question_id, scale_type, response_value}
    completion_seconds: total time for this submission
    thresholds: dict or None (uses defaults)

    Returns dict: {flags, duration_ms, n_items, n_answered, n_likert}
    """
    t = thresholds or DEFAULT_THRESHOLDS
    flags = []
    start = datetime.utcnow()

    # Extract numeric Likert responses only
    likert = [int(r['response_value'])
              for r in responses
              if r.get('scale_type', '').startswith('likert')
              and r.get('response_value') is not None
              and str(r['response_value']).lstrip('-').isdigit()]

    n_items = len(responses)
    n_answered = sum(1 for r in responses
                     if r.get('response_value') is not None)

    speeding = detect_speeding(completion_seconds, n_items, t)
    if speeding:
        flags.append(speeding)

    if len(likert) >= 5:
        flags.extend(detect_straight_lining(likert, t))
        flags.extend(detect_pattern_response(likert, t))

    missing = detect_missing_data(n_items, n_answered, t)
    if missing:
        flags.append(missing)

    duration = int((datetime.utcnow() - start).total_seconds() * 1000)

    return {
        'flags': [
            {'flag_type': f[0], 'severity': f[1], 'detail': f[2]}
            for f in flags if f
        ],
        'duration_ms': duration,
        'n_items': n_items,
        'n_answered': n_answered,
        'n_likert': len(likert),
    }
