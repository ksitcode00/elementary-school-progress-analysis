"""Check notebook diagnostics against independent, artificial model examples."""
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import pytest
import statsmodels.formula.api as smf

NOTEBOOK = Path(__file__).resolve().parents[1] / 'notebooks' / 'fairmont_school_analysis.ipynb'

def run_notebook_setup(namespace):
    notebook = json.loads(NOTEBOOK.read_text())
    setup = next(cell for cell in notebook['cells'] if cell.get('id') == '8e18f64c')
    exec(''.join(setup['source']), namespace)


@pytest.fixture
def helpers():
    notebook = json.loads(NOTEBOOK.read_text())
    namespace = {}
    run_notebook_setup(namespace)
    for cell in notebook['cells']:
        if cell.get('id', '').startswith('assumption-functions-'):
            exec(''.join(cell['source']), namespace)
    return namespace

@pytest.fixture
def frame():
    rng = np.random.default_rng(42)
    student = np.repeat(np.arange(30), 3)
    fall = rng.normal(145, 12, 90)
    absence = rng.uniform(0, .2, 90)
    return pd.DataFrame({
        'student_id': student,
        'school_year': np.tile([2024, 2025, 2026], 30),
        'school_id': 101 + student % 4,
        'grade_level': np.tile([0, 1, 2], 30),
        'subject': 'Reading',
        'fall_score': fall,
        'between_test_absence_rate': absence,
        'spring_score': 35 + .85 * fall - 12 * absence + rng.normal(0, 5, 90),
    }, index=np.arange(1000, 1090))

FORMULA = 'spring_score ~ fall_score + C(school_id) + C(grade_level)'

def fit_clustered(frame):
    model = smf.ols(FORMULA, data=frame)
    used = frame.loc[model.data.row_labels]
    return model.fit(cov_type='cluster', cov_kwds={'groups': used.student_id})

# A diagnostic that uses positional rows would attach residuals to the wrong students.
def test_aligns_formula_dropped_rows_and_shuffled_data(helpers, frame):
    assert callable(helpers.get('check_ols_model')), 'Runnable assumption checks have not been implemented yet.'
    frame.loc[1005, 'fall_score'] = np.nan
    result = fit_clustered(frame)
    report = helpers['check_ols_model'](result, frame.sample(frac=1, random_state=1), 'Reading M1')
    assert len(report['rows']) == 89
    assert 1005 not in report['rows'].index
    assert report['rows'].index.tolist() == result.model.data.row_labels.tolist()
    np.testing.assert_allclose(report['rows']['residual'], report['rows']['spring_score'] - report['rows']['fitted'])
    assert report['summary']['Unique students'] == 30
    assert report['summary']['Students with repeated records'] == 30
    assert report['summary']['Unused supplied rows'] == 1

# Reusing the index of an edited table must not quietly produce plausible diagnostics.
@pytest.mark.parametrize('column', ['fall_score', 'spring_score'])
def test_rejects_data_changed_after_fitting(helpers, frame, column):
    result = fit_clustered(frame)
    changed = frame.copy()
    changed.loc[1001, column] += 10
    with pytest.raises(ValueError, match='match|changed'):
        helpers['check_ols_model'](result, changed)

def test_rejects_duplicate_index(helpers, frame):
    result = fit_clustered(frame)
    duplicate = pd.concat([frame, frame.iloc[[0]]])
    with pytest.raises(ValueError, match='unique index'):
        helpers['check_ols_model'](result, duplicate)

# School clusters can appear statistically valid while representing the wrong unit.
def test_rejects_clusters_that_are_not_students(helpers, frame):
    result = smf.ols(FORMULA, data=frame).fit(cov_type='cluster', cov_kwds={'groups': frame.school_id})
    with pytest.raises(ValueError, match='student|cluster'):
        helpers['check_ols_model'](result, frame)

# Encoded student labels still describe the same clusters.
def test_accepts_encoded_student_clusters(helpers, frame):
    coded = frame.student_id.astype(str).map(lambda s: 'student-' + s)
    result = smf.ols(FORMULA, data=frame).fit(cov_type='cluster', cov_kwds={'groups': coded})
    report = helpers['check_ols_model'](result, frame)
    assert report['summary']['Unique students'] == 30

def test_unclustered_fit_is_flagged_without_refitting(helpers, frame):
    result = smf.ols(FORMULA, data=frame).fit()
    parameters = result.params.copy()
    report = helpers['check_ols_model'](result, frame)
    assert any('not clustered by student' in s for s in report['notes'])
    pd.testing.assert_series_equal(result.params, parameters)

# A redundant predictor must be visible, rather than declared an assumption pass.
def test_rank_deficiency_is_reported(helpers, frame):
    frame['same_fall'] = frame.fall_score
    result = smf.ols(FORMULA + ' + same_fall', data=frame).fit()
    report = helpers['check_ols_model'](result, frame)
    assert report['summary']['Design rank'] < report['summary']['Design columns']
    assert any('rank deficient' in s for s in report['notes'])

# Flagged observations must stay available for review, never be silently excluded.
def test_influence_screen_keeps_extreme_record_and_renders_plots(helpers, frame):
    frame.loc[1000, 'spring_score'] += 100
    result = fit_clustered(frame)
    report = helpers['check_ols_model'](result, frame)
    assert report['rows'].loc[1000, 'influence_flag']
    assert len(report['rows']) == 90
    figures = [helpers['plot_residual_checks'](report), helpers['plot_influence_checks'](report)]
    assert all(len(fig.axes) >= 3 for fig in figures)
    for fig in figures:
        plt.close(fig)

def test_rejects_wls_instead_of_using_ols_influence(helpers, frame):
    result = smf.wls(FORMULA, data=frame, weights=np.ones(len(frame))).fit()
    with pytest.raises(TypeError, match='OLS'):
        helpers['check_ols_model'](result, frame)

# A notebook run before modeling should leave clear prompts, without fitting anything.
def test_default_notebook_checks_wait_for_models(capsys):
    notebook = json.loads(NOTEBOOK.read_text())
    namespace = {}
    run_notebook_setup(namespace)
    for cell in notebook['cells']:
        if cell['cell_type'] == 'code' and cell.get('id', '').startswith('assumption-'):
            exec(''.join(cell['source']), namespace)
    assert namespace['assumption_results'] == {}
    assert 'No fitted models connected yet' in capsys.readouterr().out
