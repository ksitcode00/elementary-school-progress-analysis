"""Check binary coding, repeated-student inference, and common-mix probability contrasts."""
import json
from pathlib import Path
import numpy as np
import pandas as pd
import pytest
from scipy.special import expit
from scipy import stats

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
        if cell.get('id','').startswith('persistence-functions'):
            exec(''.join(cell['source']), namespace)
    return namespace

def available(helpers,name):
    assert callable(helpers.get(name)), f'{name} has not been implemented.'
    return helpers[name]

@pytest.fixture
def binary_data():
    # Exact observed probabilities: 20/40 = .5 versus 30/40 = .75.
    return pd.DataFrame({
        'student_id':np.repeat(np.arange(40),2), 'school_year':np.tile([2025,2026],40),
        'fall_well_below':np.repeat([0,1],40),
        'spring_below':np.r_[np.tile([0,1],20),np.tile([0,1,1,1],10)],
    },index=np.arange(100,180))

# Restricting the question to Fall-below students must not turn missing status into a zero outcome.
def test_preparation_codes_the_outcome_and_explicit_fall_subset(helpers):
    frame=pd.DataFrame({
        'student_id':[1,2,3,4], 'school_year':2026,
        'fall_performance_level':['Well Below Benchmark','Below Benchmark','At Benchmark','Below Benchmark'],
        'spring_performance_level':['Below Benchmark','At Benchmark','Below Benchmark',None],
    })
    prepare=available(helpers,'prepare_persistence_samples')
    with pytest.raises(ValueError,match='level|missing'):prepare({'Reading':frame})
    data,audit=prepare({'Reading':frame.iloc[:3]})
    assert data['Reading'].student_id.tolist()==[1,2]
    assert data['Reading'].fall_well_below.tolist()==[1,0]
    assert data['Reading'].spring_below.tolist()==[1,0]
    assert audit.iloc[0].paired_rows==3 and audit.iloc[0].fall_below_rows==2

# Independent-row SEs or dropped records would invalidate the planned repeated-student test.
def test_binary_fit_retains_rows_and_uses_student_clusters(helpers,binary_data):
    result=available(helpers,'fit_persistence_model')(binary_data,'spring_below ~ fall_well_below')
    assert result.converged and result.cov_type=='cluster' and result.use_t
    assert result.nobs==80 and result.df_resid_inference==39
    np.testing.assert_array_equal(result.cov_kwds['groups'],binary_data.student_id)
    assert result.model.data.row_labels.tolist()==binary_data.index.tolist()
    assert result.params['fall_well_below']==pytest.approx(np.log(3))

@pytest.mark.parametrize('problem',['missing','nonbinary','duplicate','single_outcome'])
def test_invalid_binary_samples_stop_before_inference(helpers,binary_data,problem):
    function=available(helpers,'fit_persistence_model')
    frame=binary_data.copy()
    if problem=='missing':frame.loc[100,'spring_below']=np.nan
    elif problem=='nonbinary':frame.loc[100,'spring_below']=2
    elif problem=='duplicate':frame=pd.concat([frame,frame.iloc[[0]]])
    else:frame['spring_below']=1
    with pytest.raises(ValueError):function(frame,'spring_below ~ fall_well_below')

# A probability contrast is .75-.50 = .25, not an odds ratio of 3.
# Independent finite differences check the covariance propagation without reusing its design helper.
def test_standardized_probabilities_and_contrast_use_cluster_covariance(helpers,binary_data):
    result=available(helpers,'fit_persistence_model')(binary_data,'spring_below ~ fall_well_below')
    risks,contrast=available(helpers,'standardized_persistence')(result,binary_data)
    assert risks.probability.tolist()==pytest.approx([.5,.75])
    assert contrast['difference_pp']==pytest.approx(25)
    cov=np.asarray(result.cov_params())
    beta=np.asarray(result.params)
    def difference(parameters):return expit(parameters[0]+parameters[1])-expit(parameters[0])
    step=1e-6;gradient=[]
    for j in range(2):
        offset=np.zeros(2);offset[j]=step
        gradient.append((difference(beta+offset)-difference(beta-offset))/(2*step))
    se=100*np.sqrt(np.asarray(gradient)@cov@np.asarray(gradient))
    assert contrast['clustered_se_pp']==pytest.approx(se,rel=1e-6)
    critical=stats.t.ppf(.975,39)
    assert contrast['ci_low_pp']==pytest.approx(25-critical*se,rel=1e-6)
    assert contrast['ci_high_pp']==pytest.approx(25+critical*se,rel=1e-6)
    assert risks.ci_low.between(0,1).all() and risks.ci_high.between(0,1).all()

# Paired-source flags use nullable booleans; prediction must use the same numeric coding as fitting.
def test_standardization_handles_binary_labels_from_the_original_source(helpers,binary_data):
    fit=available(helpers,'fit_persistence_model')
    standardize=available(helpers,'standardized_persistence')
    data=binary_data.copy();data['recorded_flag']=np.tile([0,0,1,1],20)
    result=fit(data,'spring_below ~ fall_well_below + recorded_flag')
    source=data.copy();source['recorded_flag']=source.recorded_flag.astype('boolean')
    risks,_=standardize(result,source)
    expected=[result.predict(data.assign(fall_well_below=group)).mean() for group in [0,1]]
    assert risks.probability.tolist()==pytest.approx(expected)
