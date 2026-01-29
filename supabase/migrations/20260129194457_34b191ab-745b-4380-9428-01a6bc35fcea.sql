-- Delete duplicate task templates, keeping the one with richer config (non-empty default_config, latest created)
DELETE FROM task_templates 
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY name ORDER BY 
             CASE WHEN default_config::text != '{}' THEN 0 ELSE 1 END,
             created_at DESC
           ) as rn
    FROM task_templates
  ) t WHERE rn > 1
);