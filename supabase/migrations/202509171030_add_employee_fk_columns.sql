alter table employees add column employee_type_id uuid references employee_types(id);
alter table employees add column appraisal_eligibility_id uuid references appraisal_eligibility(id);
alter table employees add column pf_eligibility_id uuid references pf_eligibility(id);
alter table employees add column team_id uuid references teams(id);