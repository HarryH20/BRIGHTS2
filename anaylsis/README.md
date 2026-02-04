# Analysis Directory

This is where all data science work lives. Your Jupyter notebooks, chart generators, and data exploration go here.

---

## First-Time Setup

### 1. Install Git
Download from [git-scm.com/downloads](https://git-scm.com/downloads)

### 2. Clone the Repository
```bash
git clone https://github.com/HarryH20/BRIGHTS2.git
cd BRIGHTS2
```

### 3. Set Up Your Git Identity
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 4. Set Up Environment
```bash
cp .env.example .env
```
Ask a team member for the Supabase database credentials to put in `.env`.

### 5. Install Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```
This gives you access to `psycopg2`, `plotly`, `pandas`, etc.

---

## Git Workflow

### Starting Your Work
```bash
# 1. Get the latest code
git checkout master
git pull origin master

# 2. Create your own branch (name it whatever you want)
git checkout -b my-branch-name
```

### Saving Your Work
```bash
# See what you changed
git status

# Add specific files (don't use "git add .")
git add anaylsis/notebooks/my_notebook.ipynb
git add anaylsis/chart_generators.py

# Commit with a message
git commit -m "Add goal progress chart"

# Push to GitHub
git push origin my-branch-name
```

### Merging to Master
1. Go to [github.com](https://github.com) → the BRIGHTS2 repository
2. Click **Pull requests** → **New pull request**
3. Set base: `master` and compare: `your-branch-name`
4. Add a title and description
5. Click **Create pull request**
6. Once reviewed, click **Merge pull request**

---

## Folder Structure

```
anaylsis/
├── notebooks/              # Your Jupyter notebooks (exploration, testing)
├── chart_generators.py     # Production functions (imported by backend)
└── README.md               # You are here
```

- **notebooks/**: Scratch work, exploration, prototyping. Go wild here.
- **chart_generators.py**: Clean, production-ready functions that the backend imports.

---

## Database Connection

We use a shared **Supabase PostgreSQL** database. Connection details are in the `.env` file.

### Connecting from a Notebook
```python
import os
from dotenv import load_dotenv
import psycopg2
import pandas as pd

load_dotenv()

conn = psycopg2.connect(os.getenv("DATABASE_URL"))

# Example query
df = pd.read_sql("""
    SELECT * FROM form_submissions
    WHERE user_id = %s
""", conn, params=[user_id])

conn.close()
```

### Available Tables

**users**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| username | VARCHAR(80) | Unique username |
| email | VARCHAR(120) | Unique email |
| created_at | DATETIME | Account creation time |

**form_submissions** (for goal tracking)
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to users |
| goal_text | TEXT | The user's goal |
| goal_category | VARCHAR(100) | Category (health, career, etc.) |
| target_date | DATE | Goal deadline |
| progress | INTEGER | 0-100 percentage |
| submitted_at | TIMESTAMP | When submitted |
| parent_goal_id | INTEGER | Links updates to original goal |

---

## Writing Chart Generators

The backend imports functions from `chart_generators.py`. Each function should:
1. Accept a `user_id` parameter
2. Query the database
3. Build a Plotly figure
4. Return the figure as JSON

### Example Function
```python
import os
import psycopg2
import pandas as pd
import plotly.express as px
from dotenv import load_dotenv

load_dotenv()

def goal_progress_chart(user_id: int) -> str:
    """
    Creates a bar chart showing progress on each goal.
    Returns Plotly figure as JSON string.
    """
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))

    df = pd.read_sql("""
        SELECT goal_text, progress, goal_category
        FROM form_submissions
        WHERE user_id = %s
        ORDER BY submitted_at DESC
    """, conn, params=[user_id])

    conn.close()

    fig = px.bar(
        df,
        x="goal_text",
        y="progress",
        color="goal_category",
        title="Your Goal Progress"
    )

    return fig.to_json()


def goals_by_category(user_id: int) -> str:
    """
    Creates a pie chart of goals grouped by category.
    """
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))

    df = pd.read_sql("""
        SELECT goal_category, COUNT(*) as count
        FROM form_submissions
        WHERE user_id = %s
        GROUP BY goal_category
    """, conn, params=[user_id])

    conn.close()

    fig = px.pie(df, names="goal_category", values="count", title="Goals by Category")

    return fig.to_json()
```

---

## How Your Code Connects to the App

```
You write:                 Backend calls:                User sees:
───────────────────────────────────────────────────────────────────
chart_generators.py   →   GET /api/charts/goal_progress   →   Dashboard
       │                           │
       └── Returns Plotly JSON ────┘
```

The CS team handles the API routing. You focus on:
1. SQL queries to get the right data
2. Plotly visualizations
3. Returning clean JSON

---

## Common Git Commands

```bash
# Check what branch you're on
git branch

# Switch branches
git checkout branch-name

# See what changed
git status
git diff

# Undo changes to a file (before committing)
git checkout -- filename

# Get latest master into your branch
git checkout your-branch
git merge master
```

---

## Questions?

- **Git help**: Ask the CS team or search the error message
- **Database access**: Credentials are in `.env` (ask a teammate)
- **What charts to build**: Check the team architecture doc or group chat
