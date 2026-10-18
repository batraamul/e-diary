#!/usr/bin/env python3
"""
E-Diary — turn a backup file into a real database and spreadsheet files.

    python3 tools/convert_backup.py e-diary-backup-2026-09-28.json

Creates, next to the backup:
    e-diary.sqlite        one SQLite database (open with "DB Browser for SQLite", DBeaver, Excel, Python…)
    e-diary-csv/          one CSV file per table (opens in Excel / Google Sheets / LibreOffice)

Only the Python standard library is used (Python 3.8+ on Windows, Mac or Linux).
"""
import csv, html, json, os, re, sqlite3, sys

TABLES = {
    'tasks': ['id', 'title', 'prio', 'num', 'status', 'date', 'time', 'dur', 'startDate', 'roleId', 'categoryId',
              'goalId', 'parentId', 'eventId', 'delegatedTo', 'alarm', 'alarmBefore', 'repeat', 'occ', 'exdates',
              'checklist', 'notes', 'fwdFrom', 'createdAt', 'updatedAt'],
    'events': ['id', 'title', 'date', 'allDay', 'start', 'end', 'color', 'repeat', 'exdates', 'location', 'notes', 'reminder'],
    'roles': ['id', 'name', 'icon', 'color', 'desc', 'order'],
    'categories': ['id', 'name', 'icon', 'color'],
    'goals': ['id', 'title', 'desc', 'valueId', 'roleId', 'color', 'startDate', 'due', 'done', 'doneAt'],
    'values': ['id', 'title', 'color', 'desc', 'order'],
    'notebooks': ['id', 'name', 'icon'],
    'notes': ['id', 'notebookId', 'title', 'html', 'done', 'pinned', 'createdAt', 'updatedAt'],
}


def text(h):
    """HTML → plain text (for readable columns)."""
    if not h:
        return ''
    h = re.sub(r'<(br|/p|/div|/li|/h\d)\s*/?>', '\n', h, flags=re.I)
    return html.unescape(re.sub(r'<[^>]+>', '', h)).strip()


def cell(v):
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, bool):
        return int(v)
    return v


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    with open(src, encoding='utf-8') as f:
        obj = json.load(f)
    data = obj.get('data', obj)  # backup file or raw diary
    out_dir = os.path.dirname(os.path.abspath(src))
    db_path = os.path.join(out_dir, 'e-diary.sqlite')
    csv_dir = os.path.join(out_dir, 'e-diary-csv')
    os.makedirs(csv_dir, exist_ok=True)
    if os.path.exists(db_path):
        os.remove(db_path)
    db = sqlite3.connect(db_path)

    rows_by_table = {}
    for name, cols in TABLES.items():
        items = data.get(name) or []
        extra = ['notes_text'] if name == 'tasks' else ['text'] if name == 'notes' else []
        rows = []
        for it in items:
            r = [cell(it.get(c)) for c in cols]
            if name == 'tasks':
                r.append(text(it.get('notes')))
            if name == 'notes':
                r.append(text(it.get('html')))
            rows.append(r)
        rows_by_table[name] = (cols + extra, rows)

    # diary pages and settings
    day = data.get('dayNotes') or {}
    rows_by_table['day_notes'] = (['date', 'html', 'text'], [[k, v, text(v)] for k, v in sorted(day.items())])
    rows_by_table['settings'] = (['key', 'value'], [[k, cell(v)] for k, v in (data.get('settings') or {}).items()])
    rows_by_table['mission'] = (['html', 'text'], [[(data.get('mission') or {}).get('html', ''), text((data.get('mission') or {}).get('html', ''))]])

    for name, (cols, rows) in rows_by_table.items():
        q = lambda c: '"' + c + '"'
        db.execute('CREATE TABLE %s (%s)' % (q(name), ', '.join(q(c) for c in cols)))
        db.executemany('INSERT INTO %s VALUES (%s)' % (q(name), ','.join('?' * len(cols))), rows)
        with open(os.path.join(csv_dir, name + '.csv'), 'w', newline='', encoding='utf-8-sig') as f:
            w = csv.writer(f)
            w.writerow(cols)
            w.writerows(rows)
        print('  %-11s %5d rows' % (name, len(rows)))

    # a friendly view: tasks with role, category and goal names
    db.execute('''CREATE VIEW task_list AS
        SELECT t.date, t.time, t.prio || COALESCE(t.num, '') AS code, t.title, t.status,
               r.name AS role, c.name AS category, g.title AS goal, t.delegatedTo, t.notes_text
        FROM tasks t LEFT JOIN roles r ON r.id = t.roleId
                     LEFT JOIN categories c ON c.id = t.categoryId
                     LEFT JOIN goals g ON g.id = t.goalId
        ORDER BY t.date, t.prio, t.num''')
    db.commit()
    db.close()
    print('\nWrote %s\n  and CSV files in %s' % (db_path, csv_dir))


if __name__ == '__main__':
    main()
