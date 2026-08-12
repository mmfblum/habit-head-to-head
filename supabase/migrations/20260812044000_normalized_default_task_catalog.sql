-- Normalize Zrizin's default task catalog around a simple 3-point Goal contract.
-- Existing league_task_configs remain unchanged; this defines cleaner defaults for new leagues.

UPDATE public.task_templates
SET is_active = FALSE,
    updated_at = now()
WHERE name IN ('Daily Steps', 'Active Minutes');

UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object('scoring_mode','binary','target',10000,'binary_points',3,'prefer_exact_entry',true),
    supports_integration = TRUE,
    allowed_data_sources = ARRAY['manual','apple_health','health_connect']::text[],
    updated_at = now()
WHERE name = 'Steps';

UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object('scoring_mode','binary','threshold',30,'binary_points',3,'points_for_threshold',3,'verification',jsonb_build_object('method','manual_action','allowed_sources',jsonb_build_array('manual'),'requires_confirmation',false)), updated_at = now()
WHERE name = 'Workout';

UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object('scoring_mode','binary','threshold',20,'binary_points',3,'points_for_threshold',3,'verification',jsonb_build_object('method','manual_action','allowed_sources',jsonb_build_array('manual'),'requires_confirmation',false)), updated_at = now()
WHERE name = 'Reading';

UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object('scoring_mode','binary','threshold',5,'binary_points',3,'points_for_threshold',3,'verification',jsonb_build_object('method','manual_action','allowed_sources',jsonb_build_array('manual'),'requires_confirmation',false)), updated_at = now()
WHERE name = 'Journaling';

UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object('scoring_mode','binary','threshold',10,'binary_points',3,'verification',jsonb_build_object('method','manual_action','allowed_sources',jsonb_build_array('manual'),'requires_confirmation',false)), updated_at = now()
WHERE name = 'Meditation';

UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object('scoring_mode','binary','threshold',8,'binary_points',3,'points_at_threshold',3,'verification',jsonb_build_object('method','manual_action','allowed_sources',jsonb_build_array('manual'),'requires_confirmation',false)), updated_at = now()
WHERE name = 'Water Intake';

UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object('scoring_mode','binary','daily_limit_minutes',120,'target',120,'binary_points',3,'prefer_exact_entry',true), updated_at = now()
WHERE name = 'Screen Time';

UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object('scoring_mode','binary','target_time','06:30','binary_points',3,'points_for_success',3), updated_at = now()
WHERE name = 'Wake Time';

UPDATE public.task_templates
SET default_config = default_config || jsonb_build_object('scoring_mode','binary','target_time','23:00','binary_points',3,'points_for_success',3), updated_at = now()
WHERE name = 'Bedtime';

INSERT INTO public.task_templates (name,description,category,icon,input_type,unit,scoring_type,default_config,min_value,max_value,is_active)
SELECT 'Healthy Eating','Finish the day without junk food.','nutrition','apple','binary','boolean','binary_yesno','{"scoring_mode":"binary","binary_points":3,"verification":{"method":"manual_action","allowed_sources":["manual"],"requires_confirmation":false}}'::jsonb,NULL,NULL,TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.task_templates WHERE name='Healthy Eating');

INSERT INTO public.task_templates (name,description,category,icon,input_type,unit,scoring_type,default_config,min_value,max_value,is_active)
SELECT 'Outside Time','Spend at least 20 minutes outside.','wellness','trees','duration','minutes','threshold','{"scoring_mode":"binary","threshold":20,"binary_points":3,"points_for_threshold":3,"verification":{"method":"manual_action","allowed_sources":["manual"],"requires_confirmation":false}}'::jsonb,0,600,TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.task_templates WHERE name='Outside Time');

INSERT INTO public.task_templates (name,description,category,icon,input_type,unit,scoring_type,default_config,min_value,max_value,is_active)
SELECT 'Stretching','Stretch or do mobility work for 10 minutes.','fitness','move','duration','minutes','threshold','{"scoring_mode":"binary","threshold":10,"binary_points":3,"points_for_threshold":3,"verification":{"method":"manual_action","allowed_sources":["manual"],"requires_confirmation":false}}'::jsonb,0,240,TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.task_templates WHERE name='Stretching');

INSERT INTO public.task_templates (name,description,category,icon,input_type,unit,scoring_type,default_config,min_value,max_value,is_active)
SELECT 'Something New','Learn, try, build, visit, or do something new today.','learning','sparkles','binary','boolean','binary_yesno','{"scoring_mode":"binary","binary_points":3,"verification":{"method":"manual_action","allowed_sources":["manual"],"requires_confirmation":false}}'::jsonb,NULL,NULL,TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.task_templates WHERE name='Something New');

INSERT INTO public.task_templates (name,description,category,icon,input_type,unit,scoring_type,default_config,min_value,max_value,is_active)
SELECT 'Deep Work','Complete one focused 45-minute work block.','productivity','focus','duration','minutes','threshold','{"scoring_mode":"binary","threshold":45,"binary_points":3,"points_for_threshold":3,"verification":{"method":"manual_action","allowed_sources":["manual"],"requires_confirmation":false}}'::jsonb,0,720,TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.task_templates WHERE name='Deep Work');

INSERT INTO public.task_templates (name,description,category,icon,input_type,unit,scoring_type,default_config,min_value,max_value,is_active)
SELECT 'Sleep Duration','Get at least 7 hours of sleep.','sleep','bed','numeric','hours','threshold','{"scoring_mode":"binary","threshold":7,"binary_points":3,"points_at_threshold":3,"verification":{"method":"manual_action","allowed_sources":["manual","apple_health","health_connect"],"requires_confirmation":false}}'::jsonb,0,24,TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.task_templates WHERE name='Sleep Duration');

INSERT INTO public.task_templates (name,description,category,icon,input_type,unit,scoring_type,default_config,min_value,max_value,is_active)
SELECT 'Run / Walk','Run or walk intentionally for at least 20 minutes.','fitness','route','duration','minutes','threshold','{"scoring_mode":"binary","threshold":20,"binary_points":3,"points_for_threshold":3,"verification":{"method":"manual_action","allowed_sources":["manual","apple_health","health_connect"],"requires_confirmation":false}}'::jsonb,0,720,TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.task_templates WHERE name='Run / Walk');

INSERT INTO public.task_templates (name,description,category,icon,input_type,unit,scoring_type,default_config,min_value,max_value,is_active)
SELECT 'Connection Time','Spend at least 20 intentional minutes with family or friends.','social','users','duration','minutes','threshold','{"scoring_mode":"binary","threshold":20,"binary_points":3,"points_for_threshold":3,"verification":{"method":"manual_action","allowed_sources":["manual"],"requires_confirmation":false}}'::jsonb,0,720,TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.task_templates WHERE name='Connection Time');
