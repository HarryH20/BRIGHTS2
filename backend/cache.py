import hashlib
import json
import time

_chart_cache: dict = {}
CHART_CACHE_TTL = 600         # 10 minutes — per-participant charts
ADMIN_CHART_CACHE_TTL = 1800  # 30 minutes — aggregate admin charts


def get_chart_cache(key):
    entry = _chart_cache.get(key)
    if not entry:
        return None
    timestamp, data, ttl = entry
    if time.time() - timestamp > ttl:
        del _chart_cache[key]
        return None
    return data


def set_chart_cache(key, data, ttl=None):
    _chart_cache[key] = (time.time(), data, ttl if ttl is not None else CHART_CACHE_TTL)


def invalidate_user_chart_cache(user_id):
    prefix = f"chart:{user_id}:"
    for k in [k for k in _chart_cache if k.startswith(prefix)]:
        del _chart_cache[k]


def make_cache_key(user_id, chart_name, params=None):
    if params:
        params_str = json.dumps(params, sort_keys=True, default=str)
        params_hash = hashlib.md5(params_str.encode()).hexdigest()[:8]
    else:
        params_hash = "default"
    return f"chart:{user_id}:{chart_name}:{params_hash}"
