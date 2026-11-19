"""Check complete samples, cluster inference, and primary-model result tables."""
import json
from pathlib import Path
import numpy as np
import pandas as pd
import pytest

NOTEBOOK=Path(__file__).resolve().parents[1]/'notebooks'/'fairmont_school_analysis.ipynb'

def run_notebook_setup(namespace):
    notebook = json.loads(NOTEBOOK.read_text())
    setup = next(cell for cell in notebook['cells'] if cell.get('id') == '8e18f64c')
    exec(''.join(setup['source']), namespace)


@pytest.fixture
def helpers():
    n=json.loads(NOTEBOOK.read_text());ns={}
    run_notebook_setup(ns)
    for c in n['cells']:
        if c.get('id','').startswith('primary-functions-'):exec(''.join(c['source']),ns)
    return ns

@pytest.fixture
def frame():
    rng=np.random.default_rng(114)
    student=np.repeat(np.arange(60),3)
    n=len(student)
    school=101+student%4
    fall=rng.normal(145,12,n)
    absence=rng.uniform(0,4,n)
    y=30+.85*fall-2*absence+np.repeat(rng.normal(0,3,60),3)+rng.normal(0,2,n)
    return pd.DataFrame({'student_id':student,'fall_score':fall,'absence_5pp':absence,
                         'school_id':school,'grade_level':np.tile([0,1,2],60),
                         'school_year':2024+(student//4)%3,'spring_score':y},index=np.arange(800,980))

FORMULA='spring_score ~ fall_score + C(school_id, Treatment(reference=101)) + C(grade_level) + C(school_year)'

# Dropped rows would make Model 1 and 2 answer questions on different samples.
def test_primary_fit_retains_every_row_and_clusters_by_student(helpers,frame):
    assert callable(helpers.get('fit_primary_model')),'Primary-model fitting has not been implemented.'
    result=helpers['fit_primary_model'](frame,FORMULA)
    assert result.nobs==180 and result.cov_type=='cluster' and result.use_t
    assert result.model.data.row_labels.tolist()==frame.index.tolist()
    np.testing.assert_array_equal(result.cov_kwds['groups'],frame.student_id)
    assert result.df_resid_inference==59

@pytest.mark.parametrize('column',['spring_score','fall_score','student_id'])
def test_primary_fit_rejects_missing_required_rows(helpers,frame,column):
    assert callable(helpers.get('fit_primary_model'))
    frame.loc[800,column]=np.nan
    with pytest.raises(ValueError,match='missing|complete'):
        helpers['fit_primary_model'](frame,FORMULA)

# A summary must use the fitted clustered intervals and preserve the reference.
def test_result_table_matches_clustered_fit(helpers,frame):
    assert callable(helpers.get('fit_primary_model')) and callable(helpers.get('primary_result_tables'))
    result=helpers['fit_primary_model'](frame,FORMULA+' + absence_5pp')
    coefficients,terms=helpers['primary_result_tables'](result,'Reading','Model 2')
    row=coefficients.set_index('term').loc['absence_5pp']
    expected=result.conf_int().loc['absence_5pp']
    assert row.estimate==pytest.approx(result.params['absence_5pp'])
    assert row.ci_low==pytest.approx(expected.iloc[0]) and row.ci_high==pytest.approx(expected.iloc[1])
    school=terms.loc[terms.term.str.startswith('C(school_id')].iloc[0]
    assert school.df_numerator==3 and school.df_denominator==59
    assert len(coefficients)==len(result.params)-1

# The same absence effect should appear in Model 2, not be read from Model 1.
def test_attendance_estimate_is_extracted_from_correct_model(helpers,frame):
    assert callable(helpers.get('fit_primary_model')) and callable(helpers.get('primary_result_tables'))
    m1=helpers['fit_primary_model'](frame,FORMULA)
    m2=helpers['fit_primary_model'](frame,FORMULA+' + absence_5pp')
    c1,_=helpers['primary_result_tables'](m1,'Reading','Model 1')
    c2,_=helpers['primary_result_tables'](m2,'Reading','Model 2')
    assert 'absence_5pp' not in set(c1.term)
    assert c2.loc[c2.term.eq('absence_5pp'),'estimate'].iloc[0]==pytest.approx(m2.params.absence_5pp)
