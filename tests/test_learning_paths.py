"""Protect transition denominators, missing tests, and unique-student overlap counts."""
import json
from pathlib import Path
import numpy as np
import pandas as pd
import pytest

NOTEBOOK = Path(__file__).resolve().parents[1] / 'notebooks' / 'fairmont_school_analysis.ipynb'

def run_notebook_setup(namespace):
    notebook = json.loads(NOTEBOOK.read_text())
    setup = next(cell for cell in notebook['cells'] if cell.get('id') == '8e18f64c')
    exec(''.join(setup['source']), namespace)


@pytest.fixture
def helpers():
    namespace = {}
    run_notebook_setup(namespace)
    for cell in json.loads(NOTEBOOK.read_text())['cells']:
        if cell.get('id', '').startswith('learning-focus-functions'):
            exec(''.join(cell['source']), namespace)
    return namespace

@pytest.fixture
def pairs():
    return pd.DataFrame({
        'student_id': range(1, 9), 'school_year': 2026, 'school_id': 101,
        'school_name': 'Cedar Ridge Elementary', 'grade_level': 4, 'subject': 'Reading',
        'fall_score': [100, 100, 120, 120, 100, 100, np.nan, 100],
        'spring_score': [110, 120, 110, 125, 110, np.nan, 120, 110],
        'fall_performance_level': ['Below Benchmark', 'Below Benchmark', 'At Benchmark',
            'At Benchmark', 'Well Below Benchmark', 'Below Benchmark', None, 'Below Benchmark'],
        'spring_performance_level': ['Below Benchmark', 'At Benchmark', 'Below Benchmark',
            'Above Benchmark', 'Below Benchmark', None, 'At Benchmark', None],
    })

def available(helpers, name):
    assert callable(helpers.get(name)), f'{name} has not been implemented.'
    return helpers[name]

# Treating an unpaired test as a non-below result would invent transitions.
def test_transition_classification_keeps_missing_tests_unknown(helpers, pairs):
    out = available(helpers, 'make_learning_paths')(pairs)
    assert out.learning_path.tolist() == [
        'Below in both windows', 'Moved to At/Above', 'Moved below', 'At/Above in both windows',
        'Below in both windows', 'Incomplete tests', 'Incomplete tests', 'Paired scores; missing levels',
    ]
    assert pd.isna(out.loc[5, 'persistent_below'])
    assert pd.isna(out.loc[7, 'persistent_below'])
    assert out.loc[4, 'level_improved'] and out.loc[4, 'score_change'] == 10
    assert out.loc[0, 'persistent_below']

# A paired denominator of five and a Fall-below denominator of three are different.
def test_summary_uses_the_fall_below_denominator_and_retains_exclusions(helpers, pairs):
    paths = available(helpers, 'make_learning_paths')(pairs)
    summary = available(helpers, 'summarize_learning_paths')(paths, ['subject']).iloc[0]
    assert summary.enrolled_subject_rows == 8
    assert summary.classified_pairs == 5
    assert summary.incomplete_tests == 2 and summary.missing_levels == 1
    assert summary.fall_below == 3 and summary.persistent_below == 2
    assert summary.persistent_pct_of_fall_below == pytest.approx(200/3)
    assert summary.persistent_pct_of_pairs == 40
    assert summary.moved_to_at_above == 1 and summary.moved_below == 1

@pytest.mark.parametrize('change', ['duplicate', 'unknown_level', 'missing_id'])
def test_invalid_keys_and_unrecognized_levels_stop_classification(helpers, pairs, change):
    function = available(helpers, 'make_learning_paths')
    if change == 'duplicate': pairs = pd.concat([pairs, pairs.iloc[[0]]], ignore_index=True)
    elif change == 'unknown_level': pairs.loc[0, 'fall_performance_level'] = 'Unknown label'
    else: pairs.loc[0, 'student_id'] = np.nan
    with pytest.raises(ValueError): function(pairs)

# Counting subject rows twice, or classifying a missing subject as no need, changes the follow-up list.
def test_joint_needs_counts_students_once_and_retains_partial_information(helpers, pairs):
    reading = pairs.iloc[:4].copy()
    math = reading.iloc[:3].copy(); math['subject'] = 'Mathematics'
    math.loc[1, 'spring_performance_level'] = 'Below Benchmark'
    paths = available(helpers, 'make_learning_paths')(pd.concat([reading, math], ignore_index=True))
    context = reading[['student_id', 'school_year', 'school_id', 'school_name', 'grade_level']].copy()
    context['absence_rate'] = [.10, .099, .20, np.nan]
    context.loc[2, 'grade_level'] = 5
    # Update the test records too: grade consistency is required at the join.
    paths.loc[paths.student_id.eq(3), 'grade_level'] = 5
    out = available(helpers, 'make_joint_needs')(paths, context, 2026).set_index('student_id')
    assert len(out) == 4
    assert out.loc[1, 'academic_need'] == 'Persistent below in both subjects'
    assert out.loc[2, 'academic_need'] == 'Persistent below in Mathematics only'
    assert out.loc[3, 'academic_need'] == 'No persistent-below pattern in either subject'
    assert out.loc[4, 'academic_need'] == 'Incomplete paired information'
    assert out.loc[1, 'overlapping_identified_needs']
    assert not out.loc[2, 'overlapping_identified_needs']
    assert out.loc[4, 'attendance_band'] == 'Attendance unavailable'
    assert pd.isna(out.loc[4, 'persistent_math'])
    assert out.loc[1, 'potential_next_grade'] == 5
    assert pd.isna(out.loc[3, 'potential_next_grade'])

def test_joint_needs_rejects_context_join_mismatch(helpers, pairs):
    paths = available(helpers, 'make_learning_paths')(pairs)
    context = pairs[['student_id', 'school_year', 'school_id', 'school_name', 'grade_level']].copy()
    context['absence_rate'] = .05
    context.loc[0, 'school_id'] = 104
    function = available(helpers, 'make_joint_needs')
    with pytest.raises(ValueError, match='context|school|grade'): function(paths, context, 2026)

def test_zero_classified_pairs_has_undefined_percent_not_zero(helpers, pairs):
    paths = available(helpers, 'make_learning_paths')(pairs.iloc[5:7])
    summary = available(helpers, 'summarize_learning_paths')(paths, ['subject']).iloc[0]
    assert summary.classified_pairs == 0
    assert pd.isna(summary.persistent_pct_of_pairs)
    assert pd.isna(summary.persistent_pct_of_fall_below)

# The overview appears before detailed plots: it must not depend on their imports.
# Its second panel must use the persistent group, not the larger Fall-below group.
def test_progress_figure_uses_each_panel_denominator_without_later_imports():
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    notebook = json.loads(NOTEBOOK.read_text())
    cell = next(c for c in notebook['cells'] if c.get('id') == 'learning-focus-progress-plot')
    namespace = {
        'plt': plt, 'pd': pd, 'np': np, 'learning_latest_label': '2025-26',
        'learning_latest_summary': pd.DataFrame({
            'subject': ['Reading', 'Mathematics'], 'persistent_below': [2, 3],
            'moved_to_at_above': [1, 1],
        }),
        'persistent_score_summary': pd.DataFrame({
            'subject': ['Reading', 'Mathematics'], 'students': [2, 3],
            'positive_score_change': [1, 2],
        }),
    }
    run_notebook_setup(namespace)
    try:
        with pytest.warns(UserWarning, match='non-interactive'):
            exec(''.join(cell['source']), namespace)
        axes = namespace['learning_progress_figure'].axes
        assert axes[0].patches[0].get_width() == pytest.approx(2/3)
        assert axes[1].patches[0].get_width() == pytest.approx(1/2)
        assert axes[1].patches[1].get_width() == pytest.approx(2/3)
        namespace['learning_progress_figure'].canvas.draw()
    finally:
        plt.close('all')
