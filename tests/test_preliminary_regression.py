"""Check sample consistency, attendance units, and clustered term tests."""
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
    n = json.loads(NOTEBOOK.read_text())
    namespace = {}
    run_notebook_setup(namespace)
    for cell in n['cells']:
        if cell.get('id', '').startswith('preliminary-functions-'):
            exec(''.join(cell['source']), namespace)
    return namespace

@pytest.fixture
def pairs():
    return pd.DataFrame({
        'student_id': [0, 1, 2, 3] * 2,
        'school_year': [2026] * 8,
        'school_id': [101, 102, 103, 104] * 2,
        'grade_level': [0, 1, 2, 3] * 2,
        'subject': ['Reading'] * 4 + ['Mathematics'] * 4,
        'has_fall_spring_pair': [True, True, True, False] * 2,
        'fall_score': [140.] * 8,
        'spring_score': [160.] * 8,
        'between_test_absence_rate': [0., .1, np.nan, .05, .2, 0., .05, .1],
        'between_test_eligible_days': [140] * 8,
    })

# A per-model drop would make unadjusted and adjusted coefficients use different people.
def test_common_samples_keep_zero_absence_and_document_extra_exclusions(helpers, pairs):
    assert callable(helpers.get('prepare_regression_samples')), 'Preliminary sample preparation has not been implemented.'
    before = pairs.copy(deep=True)
    samples, audit = helpers['prepare_regression_samples'](pairs)
    assert samples['Reading'].index.tolist() == [0, 1]
    assert samples['Mathematics'].index.tolist() == [4, 5, 6]
    assert samples['Reading'].loc[0, 'absence_5pp'] == 0
    assert samples['Reading'].loc[1, 'absence_5pp'] == 2
    a = audit.set_index('subject')
    assert a.loc['Reading', 'paired_rows'] == 3
    assert a.loc['Reading', 'model_rows'] == 2
    assert a.loc['Reading', 'extra_exclusions'] == 1
    assert a.loc['Mathematics', 'unique_students'] == 3
    pd.testing.assert_frame_equal(pairs, before)

# Invalid attendance values must not turn into legitimate covariates.
@pytest.mark.parametrize('bad_rate', [-.1, 1.1, np.inf])
def test_rejects_invalid_nonmissing_absence_rates(helpers, pairs, bad_rate):
    assert callable(helpers.get('prepare_regression_samples'))
    pairs.loc[0, 'between_test_absence_rate'] = bad_rate
    with pytest.raises(ValueError, match='absence'):
        helpers['prepare_regression_samples'](pairs)

def test_rejects_duplicate_student_year_subject_keys(helpers, pairs):
    assert callable(helpers.get('prepare_regression_samples'))
    pairs = pd.concat([pairs, pairs.iloc[[0]]], ignore_index=True)
    with pytest.raises(ValueError, match='duplicate'):
        helpers['prepare_regression_samples'](pairs)

@pytest.fixture
def regression_data():
    rng = np.random.default_rng(19)
    student = np.repeat(np.arange(40), 3)
    return pd.DataFrame({
        'student_id': student,
        'school_year': np.tile([2024, 2025, 2026], 40),
        'school_id': 101 + student % 4,
        'grade_level': np.tile([0, 1, 2], 40),
        'fall_score': rng.normal(140, 10, 120),
        'absence_5pp': rng.uniform(0, 4, 120),
        'spring_score': rng.normal(160, 8, 120),
    }, index=np.arange(500, 620))

# All five terms must remain present even if their p values are large.
def test_fits_all_prespecified_terms_with_the_same_rows_and_student_clusters(helpers, regression_data):
    assert callable(helpers.get('fit_univariable_models'))
    fits, overall, coefficients = helpers['fit_univariable_models'](regression_data, 'Reading')
    assert set(fits) == {'Fall score', 'School', 'Grade', 'School year', 'Between-test absence'}
    assert len(overall) == 5
    assert (overall['model_rows'] == 120).all()
    assert (overall['unique_students'] == 40).all()
    assert (overall['p_value'] > .2).any()
    for result in fits.values():
        assert result.cov_type == 'cluster' and result.use_t
        assert result.model.data.row_labels.tolist() == regression_data.index.tolist()
        np.testing.assert_array_equal(result.cov_kwds['groups'], regression_data.student_id)
    assert set(coefficients['variable']) == set(fits)

# For a four-school factor, testing one coefficient or the intercept gives the wrong answer.
def test_school_p_value_is_a_joint_test_of_three_school_contrasts(helpers, regression_data):
    assert callable(helpers.get('fit_univariable_models'))
    fits, overall, _ = helpers['fit_univariable_models'](regression_data, 'Reading')
    school = fits['School']
    restriction = np.eye(4)[1:, :]
    expected = school.wald_test(restriction, use_f=True, scalar=True)
    row = overall.set_index('variable').loc['School']
    assert row['df_numerator'] == 3
    assert row['df_denominator'] == 39
    assert row['p_value'] == pytest.approx(float(expected.pvalue))

# Attendance coefficient must refer to 5 percentage points, not a full 100-point rate change.
def test_absence_coefficient_has_the_declared_five_point_units(helpers, regression_data):
    assert callable(helpers.get('fit_univariable_models'))
    frame = regression_data.copy()
    frame['absence_5pp'] = np.repeat(np.linspace(0, 4, 40), 3)
    # The balanced errors are orthogonal to this evenly spaced absence sequence.
    error = (np.repeat(np.tile([1, -1, -1, 1], 10), 3)
             + np.tile([-1, 0, 1], 40) * np.repeat(np.tile([1, -1, 2, -2], 10), 3)
             + np.tile([1, -2, 1], 40) * np.repeat(np.tile([1, 1, -1, -1], 10), 3))
    frame['spring_score'] = 160 - 4 * frame.absence_5pp + error
    _, _, coefficients = helpers['fit_univariable_models'](frame, 'Reading')
    row = coefficients.set_index('term').loc['absence_5pp']
    assert row['estimate'] == pytest.approx(-4., abs=1e-10)
    assert row['ci_low'] < -4 < row['ci_high']
