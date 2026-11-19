# Local Briefing Dashboard

The notebook's final section generates `Fairmont_LD_Dashboard.html` at the repository root. It runs offline and offers school context, learning progress, overlapping needs, attendance and adjusted models. Use the school, year, grade and subject controls for descriptive views. The model view reads fixed three-year estimates from the saved aggregate model tables.

The generated HTML embeds student-level records with derived identifiers. Generate it locally with the authorized input files described in [Data Availability](../data/README.md). This repository includes the generator, HTML template, chart and filtering code, and tests that use fixtures or saved aggregate estimates.
