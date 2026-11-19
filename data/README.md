# Data Availability

The case study uses nine synthetic SIS tables for a seven-school district across 2023–24, 2024–25 and 2025–26. The four elementary schools are the focus of the briefing. The publicly included result tables and briefing figures contain aggregate statistics.

The supplied source files and task materials are held locally. The public notebook has cleared outputs, and the downloadable dashboard export is generated locally because it embeds student-level records with derived keys. The dashboard source and tests are available in the repository.

If you already have the supplied data, place these filenames in `data/source/`:

- `assessment_results.csv`
- `attendance_daily.csv`
- `discipline_incidents.csv`
- `enrollments.csv`
- `school_calendar.csv`
- `schools.csv`
- `students.csv`
- `teacher_assignments.csv`
- `teachers.csv`

Open `notebooks/fairmont_school_analysis.ipynb` and run all cells. The notebook reads the CSVs and regenerates the aggregate results and local HTML dashboard. The public result tables, figures and tests can be reviewed without the source files.
