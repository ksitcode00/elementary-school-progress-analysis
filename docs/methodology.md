# Methodology

## Scope and samples

Data-quality checks covered all nine SIS tables and seven schools. The briefing focused on four elementary schools and grades K–5. The checks evaluated unique keys, valid references and date ranges, grade consistency, attendance coverage and assessment windows. Attendance was summarized before joins to protect the enrollment denominator. Fourteen employed teacher-year records lacked assignment coverage, which limited staffing conclusions.

| Analysis | Unit and sample |
| --- | --- |
| Enrollment and annual attendance | 4,141 student-year records across three years and 1,401 students enrolled in the latest year. Annual absence uses enrolled instructional days. |
| Spring Benchmark status | Students tested in spring, separated by grade and subject. |
| Score change and primary models | Students with paired fall and spring tests, with valid between-test attendance for modeling. The models used 3,653 reading and 3,606 math pairs. |
| Overlapping learning needs | All latest-year enrolled students, classified by what is known across both subjects. |

Official testing windows were unavailable. Testing opportunity was estimated from observed test dates and enrollment overlap. Paired students had longer average enrollment. Recorded program labels were fixed across years and cannot describe annual eligibility changes.

## Outcome definitions

- **Below at both tests** includes supplied Below and Well Below Benchmark labels at the two observed endpoints. Students may gain points and still remain below at spring testing. The task did not supply expected-growth targets.
- **Overlapping learning needs** count students once. The 618 total consists of 542 with complete pairs in both subjects and 76 with a known pattern in one subject and incomplete information in the other. Independent reconciliation gives 443 reading plus 429 math minus 254 in both.
- **Between-test absence** uses enrolled instructional days strictly between the observed fall and spring test dates. The 10% threshold in the overlap analysis instead uses annual enrolled days and is exploratory.

## Models and uncertainty

Two OLS specifications were fit within each subject on the same records. Model 1 regressed spring score on fall score, school, grade and year. Model 2 added between-test absence, measured in five-percentage-point units. Standard errors were clustered by student to account for repeated records. One-predictor estimates used cluster-based inference and described raw associations. Predictor selection followed the project questions and adjustment plan.

The review checked sample alignment, rank, residual behavior, functional form and influential observations. Sensitivity fits considered recorded English learner, economic disadvantage and special education labels, along with temporary omission of flagged students. Shared classroom or school conditions can still introduce dependence between students.

An exploratory logistic model in each subject compared Below and Well Below fall groups on spring status, adjusting for school, grade and year. Both groups were standardized to the same observed distribution of those covariates within subject. Intervals allow repeated student records. The two starting-group coefficient tests used Holm adjustment. The models describe the historical case-study sample and were not validated on a new cohort.

## Briefing decisions

The ten slides prioritize coverage and decision relevance. They recognize observed progress, identify ongoing learning needs across subjects, and recommend verifying current enrollments, supports and attendance barriers. Historical counts are starting points for conversations. They do not establish current eligibility, causation or the effect of a particular service.

See the [notebook](../notebooks/fairmont_school_analysis.ipynb) for the exact formulas and checks, and the [aggregate results](../README.md#key-findings) for the reported estimates.
