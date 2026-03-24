import sqlalchemy
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import re

def fetch_data(engine, user_id="all", goals="1,2,3", weeks="2,3,4,5,6", user_uuid=None, **kwargs):
    """
    engine  : sqlalchemy Engine
    user_id : int, "all", or full dropdown string like "06265324f603 (#23)"
    goals   : str - URL param for goals (e.g., '1,2')
    weeks   : str - URL param for weeks (e.g., '3,4,5')
    """
    
    # --- SMART ID PARSER ---
    # Automatically extract the UUID and numeric ID if the whole dropdown string is passed
    parsed_uuid = None
    
    # Check if a combined string was passed into user_id (e.g. "06265324f603 (#23)")
    if isinstance(user_id, str) and user_id.lower() != "all":
        uuid_match = re.search(r'([a-fA-F0-9]{10,})', user_id)
        if uuid_match:
            parsed_uuid = uuid_match.group(1)
            
        num_match = re.search(r'#(\d+)', user_id)
        if num_match:
            user_id = num_match.group(1)
            
    # Check fallback kwargs for UUID
    raw_uuid = str(user_uuid or kwargs.get("uuid", kwargs.get("user_uuid", "")))
    if not parsed_uuid and raw_uuid:
        uuid_match_kw = re.search(r'([a-fA-F0-9]{10,})', raw_uuid)
        if uuid_match_kw:
            parsed_uuid = uuid_match_kw.group(1)

    # --- SMART ID DB LOOKUP ---
    if user_id not in ("all", None) and not parsed_uuid:
        uid_val = None
        try:
            uid_val = int(user_id)
        except (ValueError, TypeError):
            pass
            
        if uid_val is not None:
            # 1. Try safe ORM lookup using the native User model
            try:
                from models import User
                user_obj = User.query.get(uid_val)
                if user_obj and getattr(user_obj, 'username', None):
                    parsed_uuid = str(user_obj.username)
            except Exception:
                pass
                
            # 2. If ORM fails, use isolated raw DB connections to prevent breaking main transaction
            if not parsed_uuid:
                for table_name in ['"user"', 'users']:
                    try:
                        with engine.connect() as safe_conn:
                            res = safe_conn.execute(
                                sqlalchemy.text(f'SELECT username FROM {table_name} WHERE id = :uid'),
                                {"uid": uid_val}
                            ).fetchone()
                            if res and res[0]:
                                parsed_uuid = str(res[0])
                                break
                    except Exception:
                        pass # Silently ignore table missing errors

    try:
        target_weeks = [int(w.strip()) for w in str(weeks).split(",")]
    except:
        target_weeks = [2, 3, 4, 5, 6]
        
    try:
        target_goals = [int(g.strip()) for g in str(goals).split(",")]
    except:
        target_goals = [1, 2, 3]

    with engine.connect() as conn:
        goal_texts = {}
        # Only fetch specific text if looking at a single user
        if user_id not in ("all", None):
            try:
                uid_val = int(user_id)
                goal_texts_rows = conn.execute(
                    sqlalchemy.text("""
                        SELECT sr.goal_index, sr.response_value
                        FROM survey_responses sr
                        JOIN survey_questions sq ON sq.id = sr.question_id
                        WHERE sr.user_id = :uid
                          AND sq.scale_type = 'goal_text'
                    """),
                    {"uid": uid_val},
                ).fetchall()
                goal_texts = {r._mapping["goal_index"]: r._mapping["response_value"] for r in goal_texts_rows}
            except (ValueError, TypeError):
                pass

        # Fetch Likert scores
        query = """
            SELECT sr.goal_index, sr.timepoint, sq.question_number, sr.response_value
            FROM survey_responses sr
            JOIN survey_questions sq ON sq.id = sr.question_id
            WHERE sq.question_number IN (39, 40, 41)
              AND sr.response_value IS NOT NULL
        """
        params = {}
        
        if user_id not in ("all", None):
            try:
                uid_val = int(user_id)
                query += " AND sr.user_id = :uid"
                params["uid"] = uid_val
            except (ValueError, TypeError):
                pass
                
        query += " ORDER BY sr.timepoint, sq.question_number"
        resp_rows = conn.execute(sqlalchemy.text(query), params).fetchall()

    if not resp_rows:
        return None

    filtered_responses = []
    for r in resp_rows:
        g_idx = r._mapping["goal_index"]
        t_pt = r._mapping["timepoint"]
        
        if g_idx in target_goals and t_pt in target_weeks:
            try:
                val = int(float(r._mapping["response_value"]))
                filtered_responses.append({
                    "goal_index": g_idx,
                    "timepoint": t_pt,
                    "q": r._mapping["question_number"],
                    "val": val
                })
            except (ValueError, TypeError):
                continue

    if not filtered_responses:
        return None

    return {
        "user_id": user_id,
        "uuid": parsed_uuid or "",
        "goal_texts": goal_texts,
        "responses": filtered_responses,
        "target_weeks": sorted(list(set(r["timepoint"] for r in filtered_responses)))
    }

def build_figure(data):
    # Styling Constants
    text_color = "#c8d6f0"
    grid_color = "rgba(200,200,200,0.15)"
    bg_transparent = "rgba(0,0,0,0)"
    base_font_size = 18 

    if not data or not data.get("responses"):
        fig = go.Figure()
        fig.update_layout(
            title=dict(text="No data available", x=0.5, xanchor="center", font=dict(color=text_color, size=22)),
            paper_bgcolor=bg_transparent, plot_bgcolor=bg_transparent,
        )
        return fig.to_dict()

    time_points = data["target_weeks"]
    responses = data["responses"]
    goal_texts = data["goal_texts"]
    user_id = data["user_id"]
    user_uuid = data.get("uuid", "")

    active_goals = sorted(list(set(r['goal_index'] for r in responses)))
    
    # Header Logic Updates
    if user_id == "all":
        header_text = (
            "<b>Goal Progress</b><br>"
            "<span style='font-size:24px; color:#ffffff;'>All Users</span><br>"
            f"<span style='font-size:20px; color:#a1b4d5;'>Tracking Goals: {', '.join(map(str, active_goals))}</span>"
        )
        margin_t = 280
    else:
        goal_items = []
        for g in active_goals:
            text = str(goal_texts.get(g, f"Goal {g}"))
            goal_items.append(f"<b>Goal {g}:</b> {text}")
        
        goals_formatted = "<br>".join(goal_items)
        header_text = (
            "<b>Goal Progress</b><br>"
            f"<span style='font-size:24px; color:#ffffff;'>User #{user_id}</span><br>"
            f"<span style='font-size:16px; color:#8898b5; font-family:monospace;'>User ID: {user_uuid}</span><br>"
            f"<span style='font-size:20px; line-height:1.6;'>{goals_formatted}</span>"
        )
        # Added extra padding to absorb the new spacing shift below
        margin_t = 320 + (35 * len(active_goals))
        
    chart_title = dict(
        text=header_text, 
        x=0.5,           
        y=0.98,          
        xanchor="center", 
        yanchor="top",
        font=dict(color=text_color, size=32)
    )

    questions = {39: 'Made a lot of progress', 40: 'On track with plan', 41: 'Close to achieving goal'}
    colors = {
        'Strongly Disagree': '#D55E00', 
        'Disagree': '#f59c3c', 
        'Somewhat Disagree': '#fcbe75', 
        'Neutral': "#d3d3d3", 
        'Somewhat Agree': '#92c0df', 
        'Agree': "#6b9cc3", 
        'Strongly Agree': '#0072B2'
    }

    num_rows = len(time_points)
    
    fig = make_subplots(
        rows=num_rows, cols=1, 
        subplot_titles=[f"<b>Week {t}</b>" for t in time_points],
        shared_xaxes=True, 
        vertical_spacing=0.08 if num_rows > 1 else 0
    )

    for i, t in enumerate(time_points):
        row = i + 1
        y_labels, sd_vals, d_vals, swd_vals = [], [], [], []
        n_half_vals, n_raw_vals, swa_vals, a_vals, sa_vals = [], [], [], [], []
        sd_goals, d_goals, swd_goals, n_goals, swa_goals, a_goals, sa_goals = [], [], [], [], [], [], []
        neg_totals, pos_totals = [], []

        for q_num in [41, 40, 39]:
            q_responses = [r for r in responses if r['timepoint'] == t and r['q'] == q_num]
            counts = {v: 0 for v in range(1, 8)}
            goals_map = {v: [] for v in range(1, 8)}
            
            total_q = len(q_responses)
            if total_q > 0:
                for r in q_responses:
                    val = r['val']
                    if 1 <= val <= 7:
                        counts[val] += 1
                        g_idx = str(r['goal_index'])
                        if g_idx not in goals_map[val]:
                            goals_map[val].append(g_idx)
                
                for val in range(1, 8):
                    counts[val] = (counts[val] / total_q) * 100
                    if goals_map[val]:
                        goals_map[val] = "<br><b>Goal(s): " + ", ".join(sorted(goals_map[val])) + "</b>"
                    else:
                        goals_map[val] = ""
            else:
                for val in range(1, 8):
                    goals_map[val] = ""

            sd, d, swd, n, swa, a, sa = (counts[1], counts[2], counts[3], counts[4], counts[5], counts[6], counts[7])

            y_labels.append(f"{questions[q_num]}")
            
            sd_vals.append(sd); sd_goals.append(goals_map[1])
            d_vals.append(d); d_goals.append(goals_map[2])
            swd_vals.append(swd); swd_goals.append(goals_map[3])
            n_raw_vals.append(n); n_half_vals.append(n / 2); n_goals.append(goals_map[4])
            swa_vals.append(swa); swa_goals.append(goals_map[5])
            a_vals.append(a); a_goals.append(goals_map[6])
            sa_vals.append(sa); sa_goals.append(goals_map[7])

            neg_totals.append(sd + d + swd); pos_totals.append(sa + a + swa)

        bar_opts = dict(orientation='h', marker_line_width=0)
        show_legend = (i == 0)

        c_sd = [[v, g] for v, g in zip(sd_vals, sd_goals)]; c_d = [[v, g] for v, g in zip(d_vals, d_goals)]; c_swd = [[v, g] for v, g in zip(swd_vals, swd_goals)]
        c_n = [[v, g] for v, g in zip(n_raw_vals, n_goals)]; c_swa = [[v, g] for v, g in zip(swa_vals, swa_goals)]; c_a = [[v, g] for v, g in zip(a_vals, a_goals)]; c_sa = [[v, g] for v, g in zip(sa_vals, sa_goals)]

        fig.add_trace(go.Bar(y=y_labels, x=[-x for x in n_half_vals], customdata=c_n, name='Neutral', marker_color=colors['Neutral'], **bar_opts, showlegend=show_legend, legendgroup='Neutral', hovertemplate="%{y}: %{customdata[0]:.0f}% Neutral%{customdata[1]}<extra></extra>"), row=row, col=1)
        fig.add_trace(go.Bar(y=y_labels, x=[-x for x in swd_vals], customdata=c_swd, name='Somewhat Disagree', marker_color=colors['Somewhat Disagree'], **bar_opts, showlegend=show_legend, legendgroup='Somewhat Disagree', hovertemplate="%{y}: %{customdata[0]:.0f}% Somewhat Disagree%{customdata[1]}<extra></extra>"), row=row, col=1)
        fig.add_trace(go.Bar(y=y_labels, x=[-x for x in d_vals], customdata=c_d, name='Disagree', marker_color=colors['Disagree'], **bar_opts, showlegend=show_legend, legendgroup='Disagree', hovertemplate="%{y}: %{customdata[0]:.0f}% Disagree%{customdata[1]}<extra></extra>"), row=row, col=1)
        fig.add_trace(go.Bar(y=y_labels, x=[-x for x in sd_vals], customdata=c_sd, name='Strongly Disagree', marker_color=colors['Strongly Disagree'], **bar_opts, showlegend=show_legend, legendgroup='Strongly Disagree', hovertemplate="%{y}: %{customdata[0]:.0f}% Strongly Disagree%{customdata[1]}<extra></extra>"), row=row, col=1)

        fig.add_trace(go.Bar(y=y_labels, x=n_half_vals, customdata=c_n, name='Neutral', marker_color=colors['Neutral'], **bar_opts, showlegend=False, legendgroup='Neutral', hovertemplate="%{y}: %{customdata[0]:.0f}% Neutral%{customdata[1]}<extra></extra>"), row=row, col=1)
        fig.add_trace(go.Bar(y=y_labels, x=swa_vals, customdata=c_swa, name='Somewhat Agree', marker_color=colors['Somewhat Agree'], **bar_opts, showlegend=show_legend, legendgroup='Somewhat Agree', hovertemplate="%{y}: %{customdata[0]:.0f}% Somewhat Agree%{customdata[1]}<extra></extra>"), row=row, col=1)
        fig.add_trace(go.Bar(y=y_labels, x=a_vals, customdata=c_a, name='Agree', marker_color=colors['Agree'], **bar_opts, showlegend=show_legend, legendgroup='Agree', hovertemplate="%{y}: %{customdata[0]:.0f}% Agree%{customdata[1]}<extra></extra>"), row=row, col=1)
        fig.add_trace(go.Bar(y=y_labels, x=sa_vals, customdata=c_sa, name='Strongly Agree', marker_color=colors['Strongly Agree'], **bar_opts, showlegend=show_legend, legendgroup='Strongly Agree', hovertemplate="%{y}: %{customdata[0]:.0f}% Strongly Agree%{customdata[1]}<extra></extra>"), row=row, col=1)

        fig.add_trace(go.Scatter(y=y_labels, x=[-(val + n_val + 14) for val, n_val in zip(neg_totals, n_half_vals)], text=[f"{val:.0f}%" if val > 0 else "" for val in neg_totals], mode='text', textposition='middle left', showlegend=False, textfont=dict(color=text_color, size=18)), row=row, col=1)
        fig.add_trace(go.Scatter(y=y_labels, x=[(val + n_val + 14) for val, n_val in zip(pos_totals, n_half_vals)], text=[f"{val:.0f}%" if val > 0 else "" for val in pos_totals], mode='text', textposition='middle right', showlegend=False, textfont=dict(color=text_color, size=18)), row=row, col=1)

    plot_height = margin_t + 120 + (250 * num_rows)
    
    # Calculate an exact pixel gap above the plotting area (65 pixels).
    # This mathematically prevents the legend from flying up into the text 
    # on tall multi-week charts, while guaranteeing enough space on short 1-week charts!
    legend_y = 1.0 + (65.0 / (250 * num_rows))
    
    fig.update_layout(
        title=chart_title,
        barmode='relative', 
        height=plot_height, 
        paper_bgcolor=bg_transparent, 
        plot_bgcolor=bg_transparent, 
        margin=dict(t=margin_t, b=80, l=200, r=80), 
        bargap=0.15, 
        
        legend=dict(
            orientation="h", 
            y=legend_y, 
            yanchor="bottom", 
            xanchor="left", 
            x=-0.1, 
            font=dict(size=12, color=text_color),
        ),
        font=dict(family="Arial, sans-serif", size=base_font_size, color=text_color)
    )

    for i in range(1, num_rows + 1):
        fig.update_xaxes(
            title=dict(text="<b>Percentage (%)</b>", font=dict(size=18)) if i == num_rows else None,
            range=[-145, 145], 
            tickvals=[-100, -50, 0, 50, 100], 
            ticktext=['100', '50', '0', '50', '100'], 
            gridcolor=grid_color, 
            gridwidth=1, 
            zeroline=True, zerolinecolor=text_color, zerolinewidth=1.5, 
            tickfont=dict(size=16),
            row=i, col=1
        )
        fig.update_yaxes(
            tickfont=dict(size=18, color=text_color), 
            row=i, col=1
        )

    for annotation in fig['layout']['annotations']:
        if 'Week' in annotation['text']: 
            annotation['font'] = dict(size=22, color="#7b9eff")
            annotation['y'] = annotation['y'] + 0.015

    return fig.to_dict()