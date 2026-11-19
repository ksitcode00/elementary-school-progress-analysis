"""Export the notebook's checked tables as a self-contained briefing dashboard."""
import json
from pathlib import Path

import pandas as pd

LEVELS = {'Well Below Benchmark': 0, 'Below Benchmark': 1, 'At Benchmark': 2, 'Above Benchmark': 3}


def build_payload(context, pairs, participation):
    context = context.reset_index(drop=True).copy()
    if context.duplicated(['student_id', 'school_year']).any():
        raise ValueError('The context table must have one row per student-year.')
    context['dashboard_record'] = range(len(context))
    context['dashboard_student'] = pd.factorize(context['student_id'])[0]
    joined = pairs.merge(
        context[['student_id', 'school_year', 'dashboard_record']],
        on=['student_id', 'school_year'], how='left', validate='many_to_one',
    ).merge(
        participation[['student_id', 'school_year', 'subject', 'fall_opportunity', 'spring_opportunity']],
        on=['student_id', 'school_year', 'subject'], how='left', validate='one_to_one',
    )
    if joined['dashboard_record'].isna().any():
        raise ValueError('A benchmark row has no student-year context.')

    def number(value):
        if pd.isna(value):
            return None
        return int(value) if float(value).is_integer() else float(value)

    def level(value):
        if pd.isna(value):
            return None
        if value not in LEVELS:
            raise ValueError(f'Unknown benchmark performance level: {value}')
        return LEVELS[value]

    contexts = [
        [int(r.dashboard_record), int(r.dashboard_student), int(r.school_id), int(r.school_year), int(r.grade_level),
         int(r.english_learner_flag), int(r.economically_disadvantaged_flag), int(r.special_education_flag),
         number(r.enrolled_instructional_days), number(r.absent_days)]
        for r in context.itertuples(index=False)
    ]
    records = [
        [int(r.dashboard_record), {'Reading': 0, 'Mathematics': 1}[r.subject], number(r.fall_score), number(r.spring_score),
         level(r.fall_performance_level), level(r.spring_performance_level), number(r.between_test_eligible_days),
         number(r.between_test_absent_days), number(r.fall_opportunity), number(r.spring_opportunity)]
        for r in joined.itertuples(index=False)
    ]
    schools = context[['school_id', 'school_name']].drop_duplicates().sort_values('school_id')
    return {'schools': [[int(r.school_id), r.school_name] for r in schools.itertuples(index=False)],
            'context': contexts, 'pairs': records}


def load_model_results(project_dir):
    """Read completed model exports; the dashboard never refits them."""
    project_dir = Path(project_dir)
    sources = {
        'probabilities': 'learning_results/persistence_adjusted_probabilities.csv',
        'contrasts': 'learning_results/persistence_adjusted_contrasts.csv',
        'samples': 'learning_results/persistence_model_sample.csv',
        'attendance': 'model_results/attendance_comparison.csv',
        'primary_samples': 'model_results/primary_model_summary.csv',
        'school_contrasts': 'model_results/model1_school_contrasts.csv',
    }
    result = {key: pd.read_csv(project_dir / path).to_dict('records')
              for key, path in sources.items()}
    result.update(years=[2024, 2025, 2026], absence_increment_pp=5, sources=sources)
    return result


def write_dashboard(payload, output_path):
    here = Path(__file__).parent
    text = (here / 'dashboard_template.html').read_text(encoding='utf-8')
    text = text.replace('__DASHBOARD_DATA__', json.dumps(payload, separators=(',', ':'), allow_nan=False).replace('<', '\\u003c'))
    text = text.replace('__DASHBOARD_CORE__', (here / 'dashboard_core.js').read_text().replace('export class Fairmont', 'class Fairmont'))
    text = text.replace('__DASHBOARD_UI__', (here / 'dashboard_ui.js').read_text())
    output_path = Path(output_path)
    output_path.write_text(text, encoding='utf-8')
    return output_path


def build_dashboard(context, pairs, participation, output_path):
    payload = build_payload(context, pairs, participation)
    payload['models'] = load_model_results(Path(output_path).resolve().parent)
    return write_dashboard(payload, output_path)
