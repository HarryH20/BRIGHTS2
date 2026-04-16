import sqlalchemy

# ================================================================
# CODEBOOKS
# ================================================================
CONDITION_MAP = {
    1: "(1) Purpose Outcome Obstacle Plan Condition",
    2: "(2) Goal Outcome Obstacle Plan Condition",
    3: "(3) Control Condition"
}

RACE_MAP = {
    1: "African American/Black",
    2: "Asian American/Asian",
    3: "Hispanic, Latino/a, or Spanish origin",
    4: "Middle Eastern/North African",
    5: "Native American",
    6: "Native Hawaiian, Samoan, or other Pacific Islander",
    7: "White/Caucasian",
    8: "Prefer not to say",
    9: "Other"
}

EDU_MAP = {
    1: "Some high school",
    2: "High school graduate",
    3: "Some college/vocational school",
    4: "College/vocational school graduate",
    5: "Some graduate school",
    6: "Graduate school graduate"
}

INCOME_MAP = {
    1: "Less than $25,000",
    2: "$25,000 - $49,999",
    3: "$50,000 - $74,999",
    4: "$75,000 - $99,999",
    5: "$100,000 - $149,999",
    6: "$150,000 or more",
    7: "Prefer not to say"
}

SES_MAP = {
    1: "Upper class",
    2: "Upper-middle class",
    3: "Middle class",
    4: "Lower-middle class",
    5: "Lower class"
}

EMP_MAP = {
    1: "Employee of a for-profit company or business or of an individual, for wages, salary, or commissions",
    2: "Employee of a not-for-profit, tax-exempt, or charitable organization",
    3: "Local government employee (city, county, etc.)",
    4: "State government employee",
    5: "Federal government employee",
    6: "Self-employed in own not-incorporated business, professional practice, or farm",
    7: "Self-employed in own incorporated business, professional practice, or farm",
    8: "Working without pay in family business or farm"
}

MAR_MAP = {
    1: "Currently married",
    2: "Widowed",
    3: "Divorced",
    4: "Separated",
    5: "Never married"
}

RELIGION_MAP = {
    1: "Protestant (Christian)",
    2: "Catholic",
    3: "Buddhist",
    4: "Hindu",
    5: "Jewish",
    6: "Muslim",
    7: "None",
    8: "Atheist",
    9: "Agnostic",
    10: "Other"
}

RELIGIOSITY_MAP = {i: f"Level {i}" for i in range(1, 8)}

POL_MAP = {
    1: "Very conservative",
    2: "Conservative",
    3: "Slightly conservative",
    4: "Moderate",
    5: "Slightly liberal",
    6: "Liberal",
    7: "Very liberal"
}

POLAFF_MAP = {
    1: "Republican",
    2: "Democrat",
    3: "Independent",
    4: "Other",
    5: "No preference"
}

GENDER_LABELS = [
    "Male", "Female", "Non-binary", "Prefer not to say", "Other",
    "Transgender", "Cisgender", "Genderqueer", "Agender"
]

# ================================================================
# DB FETCH HELPERS (SQLAlchemy 2.0 version)
# ================================================================
DEM_COLS = """
"Condition","Age",
"Gender_1","Gender_2","Gender_3","Gender_4","Gender_5","Gender_6","Gender_7","Gender_8","Gender_9",
"Race","Race_9_TEXT",
"Religion","Religion_10_TEXT",
"Religiosity","SES","Income","Edu","Work","Pol","PolAff","PolAff_4_TEXT","Marital"
"""

def fetch_all_rows(engine):
    with engine.connect() as conn:
        rows = conn.execute(sqlalchemy.text(
            f"SELECT {DEM_COLS} FROM \"GoalIntervention\""
        )).fetchall()
    return [dict(r._mapping) for r in rows]

def fetch_one(engine, pid):
    with engine.connect() as conn:
        row = conn.execute(sqlalchemy.text(
            f"SELECT {DEM_COLS} FROM \"GoalIntervention\" WHERE \"ID\" = :pid"
        ), {"pid": pid}).fetchone()
    return dict(row._mapping) if row else None

# ================================================================
# COUNTING HELPERS
# ================================================================
def to_int(x):
    try:
        return int(str(x))
    except:
        return None

def count_categories(rows, field, mapping):
    counts = {label: 0 for label in mapping.values()}
    for r in rows:
        key = to_int(r.get(field))
        if key in mapping:
            counts[mapping[key]] += 1
    return counts

def count_gender(rows):
    counts = {g: 0 for g in GENDER_LABELS}
    for r in rows:
        for i, lbl in enumerate(GENDER_LABELS, start=1):
            if to_int(r.get(f"Gender_{i}")) == 1:
                counts[lbl] += 1
    return counts

def age_group(a):
    a = to_int(a)
    if a is None:
        return None
    if a <= 17:
        return "17 and under"
    if 18 <= a <= 24:
        return "18–24"
    if 25 <= a <= 34:
        return "25–34"
    if 35 <= a <= 44:
        return "35–44"
    if 45 <= a <= 54:
        return "45–54"
    if 55 <= a <= 64:
        return "55–64"
    if a >= 65:
        return "65+"

def count_age(rows):
    order = [
        "17 and under",
        "18–24",
        "25–34",
        "35–44",
        "45–54",
        "55–64",
        "65+",
    ]
    counts = {o: 0 for o in order}

    for r in rows:
        grp = age_group(r.get("Age"))
        if grp in counts:
            counts[grp] += 1

    return counts

# ================================================================
# USER GENDER RESOLUTION
# ================================================================
def user_gender_label(row):
    if not row:
        return None

    selected = []
    for i, lbl in enumerate(GENDER_LABELS, start=1):
        if to_int(row.get(f"Gender_{i}")) == 1:
            selected.append(lbl)

    if not selected:
        return None
    if len(selected) == 1:
        return selected[0]
    return ", ".join(selected)

def build_figure(all_rows, single_row=None, user_id=None):

    cond = count_categories(all_rows, "Condition", CONDITION_MAP)
    race = count_categories(all_rows, "Race", RACE_MAP)
    edu  = count_categories(all_rows, "Edu", EDU_MAP)
    inc  = count_categories(all_rows, "Income", INCOME_MAP)
    ses  = count_categories(all_rows, "SES", SES_MAP)
    emp  = count_categories(all_rows, "Work", EMP_MAP)
    mar  = count_categories(all_rows, "Marital", MAR_MAP)
    rel  = count_categories(all_rows, "Religion", RELIGION_MAP)
    relg = count_categories(all_rows, "Religiosity", RELIGIOSITY_MAP)
    pol  = count_categories(all_rows, "Pol", POL_MAP)
    pola = count_categories(all_rows, "PolAff", POLAFF_MAP)
    age  = count_age(all_rows)
    gend = count_gender(all_rows)

    def hl(map_obj, field):
        if not single_row:
            return None

        raw = single_row.get(field)
        if raw is None:
            return None

        # Case 1: numeric coded value
        key = to_int(raw)
        if key in map_obj:
            return map_obj[key]

        # Case 2: stored as string label
        if isinstance(raw, str) and raw in map_obj.values():
            return raw
        
        return None
    
    def hl_required(map_obj, field):
        return hl(map_obj, field)
    
    def hl_other(field, map_obj, text_field):
        if not single_row:
            return None

        raw = single_row.get(field)
        if raw is None:
            return None

        key = to_int(raw)
        if key is not None and key in map_obj:
            label = map_obj[key]
        elif isinstance(raw, str) and raw in map_obj.values():
            label = raw
        else:
            return None

        if label == "Other":
            txt = (single_row.get(text_field) or "").strip()
            return f"Other, {txt}" if txt else "Other"

        return label

    def subtitle_fmt(label):
        if single_row and label:
            return f"User #{user_id}: {label}"
        return None

    # Gender (corrected highlight + subtitle)
    user_gender = user_gender_label(single_row)

    return {
        "condition": {
            "type": "bar",
            "title": "Condition",
            "labels": list(cond.keys()),
            "values": list(cond.values()),
            "highlight": hl(CONDITION_MAP, "Condition"),
            "subtitle": subtitle_fmt(hl(CONDITION_MAP, "Condition"))
        },

        "gender": {
            "type": "donut",
            "title": "Gender",
            "labels": GENDER_LABELS,
            "values": [gend[g] for g in GENDER_LABELS],
            "highlight": user_gender,
            "subtitle": subtitle_fmt(user_gender)
        },

        "age": {
            "type": "bar",
            "title": "Age",
            "labels": list(age.keys()),
            "values": list(age.values()),
            "highlight": age_group(single_row["Age"]) if single_row else None,
            "subtitle": (
                f"User #{user_id}: {to_int(single_row['Age'])}"
                if single_row and to_int(single_row.get("Age")) is not None
                else None
            )
        },

        "race_ethnicity": {
            "type": "bar",
            "title": "Race/Ethnicity",
            "labels": list(race.keys()),
            "values": list(race.values()),
            "highlight": hl_other("Race", RACE_MAP, "Race_9_TEXT"),
            "subtitle": subtitle_fmt(hl_other("Race", RACE_MAP, "Race_9_TEXT"))
        },

        "marital_status": {
            "type": "bar",
            "title": "Marital Status",
            "labels": list(mar.keys()),
            "values": list(mar.values()),
            "highlight": hl(MAR_MAP, "Marital"),
            "subtitle": subtitle_fmt(hl(MAR_MAP, "Marital"))
        },

        "education": {
            "type": "bar",
            "title": "Education",
            "labels": list(edu.keys()),
            "values": list(edu.values()),
            "highlight": hl(EDU_MAP, "Edu"),
            "subtitle": subtitle_fmt(hl(EDU_MAP, "Edu"))
        },

        "employment_status": {
            "type": "bar",
            "title": "Employment Status",
            "labels": list(emp.keys()),
            "values": list(emp.values()),
            "highlight": hl_required(EMP_MAP, "Work"),
            "subtitle": subtitle_fmt(hl_required(EMP_MAP, "Work"))
        },

        "annual_income": {
            "type": "bar",
            "title": "Annual Income",
            "labels": list(inc.keys()),
            "values": list(inc.values()),
            "highlight": hl_required(INCOME_MAP, "Income"),
            "subtitle": subtitle_fmt(hl_required(INCOME_MAP, "Income"))
        },

        "socioeconomic_status": {
            "type": "bar",
            "title": "Socioeconomic Status",
            "labels": list(ses.keys()),
            "values": list(ses.values()),
            "highlight": hl(SES_MAP, "SES"),
            "subtitle": subtitle_fmt(hl(SES_MAP, "SES"))
        },

        "religion": {
            "type": "bar",
            "title": "Religion",
            "labels": list(rel.keys()),
            "values": list(rel.values()),
            "highlight": hl_other("Religion", RELIGION_MAP, "Religion_10_TEXT"),
            "subtitle": subtitle_fmt(hl_other("Religion", RELIGION_MAP, "Religion_10_TEXT"))
        },

        "religiosity": {
            "type": "bar",
            "title": "Religiosity",
            "labels": list(relg.keys()),
            "values": list(relg.values()),
            "highlight": hl(RELIGIOSITY_MAP, "Religiosity"),
            "subtitle": subtitle_fmt(hl(RELIGIOSITY_MAP, "Religiosity"))
        },

        "political_affiliation": {
            "type": "bar",
            "title": "Political Affiliation",
            "labels": list(pola.keys()),
            "values": list(pola.values()),
            "highlight": hl_other("PolAff", POLAFF_MAP, "PolAff_4_TEXT"),
            "subtitle": subtitle_fmt(hl_other("PolAff", POLAFF_MAP, "PolAff_4_TEXT"))
        },

        "political_orientation": {
            "type": "bar",
            "title": "Political Orientation",
            "labels": list(pol.keys()),
            "values": list(pol.values()),
            "highlight": hl(POL_MAP, "Pol"),
            "subtitle": subtitle_fmt(hl(POL_MAP, "Pol"))
        }
    }
