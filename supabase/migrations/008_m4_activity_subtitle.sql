-- Milestone 4 follow-up — activities.subtitle
-- =================================================================
-- 007_m4_activities.sql didn't account for the short descriptive subtitle
-- StepActivity.tsx shows under each activity name (e.g. "Class III–IV
-- rapids"). Discovered while rewiring that component to read from the
-- activities table instead of its own hardcoded ACTS array. Additive,
-- nullable — safe to run after 007 regardless of whether it's been
-- applied to a database with existing activities rows already.

alter table activities
  add column if not exists subtitle text;

update activities set subtitle = 'Class III–IV rapids'      where key = 'kayak'  and subtitle is null;
update activities set subtitle = 'Technical canyon terrain' where key = 'hike'   and subtitle is null;
update activities set subtitle = 'Off-road vehicles'        where key = 'atv'    and subtitle is null;
update activities set subtitle = 'Top-rope & lead'          where key = 'climb'  and subtitle is null;
