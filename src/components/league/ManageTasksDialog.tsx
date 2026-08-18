import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Clock, Plus, Settings2, Sparkles, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTaskTemplates, TaskTemplate } from '@/hooks/useTaskTemplates';
import { useLeagueTaskConfigs, useUpdateTaskConfig, useRemoveTaskConfig, useAddTaskConfig, LeagueTaskConfig } from '@/hooks/useLeagueTaskConfigs';
import { TaskConfigurationPanel, TaskConfigOverrides, getInitialConfig } from './TaskConfigurationPanel';
import { CustomChallengeBuilder, type CustomChallengeValue } from './CustomChallengeBuilder';
import { toast } from 'sonner';

interface ManageTasksDialogProps { open: boolean; onOpenChange: (open: boolean) => void; seasonId: string; nextWeekStart?: string; }
const CUSTOM_PREFIX = 'Custom Challenge —';

export function ManageTasksDialog({ open, onOpenChange, seasonId, nextWeekStart }: ManageTasksDialogProps) {
  const { data: configs, isLoading: configsLoading } = useLeagueTaskConfigs(seasonId);
  const { data: templates } = useTaskTemplates();
  const updateConfig = useUpdateTaskConfig();
  const removeConfig = useRemoveTaskConfig();
  const addConfig = useAddTaskConfig();
  const [expandedConfigId, setExpandedConfigId] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newCustomTask, setNewCustomTask] = useState<CustomChallengeValue | undefined>();

  const enabledConfigs = configs?.filter((config) => config.is_enabled && config.task_template) || [];
  const customTemplates = templates?.filter((template) => template.name.startsWith(CUSTOM_PREFIX)) || [];
  const customTemplateIds = new Set(customTemplates.map((template) => template.id));
  const addedStandardIds = new Set(enabledConfigs.filter((config) => !customTemplateIds.has(config.task_template_id)).map((config) => config.task_template_id));
  const availableTemplates = templates?.filter((template) => !customTemplateIds.has(template.id) && !addedStandardIds.has(template.id)) || [];

  const timingDescription = nextWeekStart ? `Changes take effect ${nextWeekStart}` : 'Changes saved';

  const handleUpdateConfig = async (configId: string, overrides: TaskConfigOverrides) => {
    try { await updateConfig.mutateAsync({ configId, updates: { config_overrides: overrides } }); toast.success('Task configuration updated', { description: timingDescription }); }
    catch { toast.error('Failed to update task'); }
  };
  const handleRemoveTask = async (configId: string, taskName: string) => {
    try { await removeConfig.mutateAsync(configId); toast.success(`${taskName} removed`, { description: timingDescription }); }
    catch { toast.error('Failed to remove task'); }
  };
  const handleAddTask = async (template: TaskTemplate) => {
    try { await addConfig.mutateAsync({ seasonId, taskTemplateId: template.id, configOverrides: getInitialConfig(template) }); toast.success(`${template.name} added`, { description: timingDescription }); }
    catch { toast.error('Failed to add task'); }
  };
  const handleAddCustom = async () => {
    if (!newCustomTask?.config.custom_name?.trim()) { toast.error('Give the custom task a name'); return; }
    try {
      await addConfig.mutateAsync({ seasonId, taskTemplateId: newCustomTask.templateId, configOverrides: newCustomTask.config as never });
      toast.success(`${newCustomTask.config.custom_name} added`, { description: timingDescription });
      setNewCustomTask(undefined);
    } catch { toast.error('Failed to add custom task'); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 className="w-5 h-5" />Manage League Tasks</DialogTitle></DialogHeader>
        {nextWeekStart && <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"><Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" /><p className="text-sm text-amber-500">Changes take effect at the start of next week ({nextWeekStart})</p></div>}

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {configsLoading ? <div className="text-center py-8 text-muted-foreground">Loading tasks...</div> : enabledConfigs.length === 0 ? <div className="text-center py-8"><AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No tasks configured yet</p></div> : <div className="space-y-3">{enabledConfigs.map((config) => <TaskConfigCard key={config.id} config={config} isExpanded={expandedConfigId===config.id} onToggleExpand={()=>setExpandedConfigId(expandedConfigId===config.id?null:config.id)} onUpdate={(overrides)=>handleUpdateConfig(config.id,overrides)} onRemove={()=>handleRemoveTask(config.id, String((config.config_overrides as Record<string, unknown> | null)?.custom_name || config.task_template.name))} isUpdating={updateConfig.isPending} isRemoving={removeConfig.isPending} />)}</div>}

          <AnimatePresence>{showAddTask && <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden"><div className="border border-dashed border-border rounded-xl p-4 space-y-5">
            <div className="flex items-center justify-between"><div><h4 className="font-medium">Add tasks</h4><p className="text-xs text-muted-foreground">Use defaults or create as many league-specific tasks as you want.</p></div><Button variant="ghost" size="icon" onClick={()=>setShowAddTask(false)}><X className="w-4 h-4"/></Button></div>
            {availableTemplates.length>0 && <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Default tasks</p><div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">{availableTemplates.map((template)=><button key={template.id} onClick={()=>handleAddTask(template)} disabled={addConfig.isPending} className="p-3 rounded-lg border border-border bg-card hover:bg-accent/50 text-left transition-colors disabled:opacity-50"><p className="font-medium text-sm truncate">{template.name}</p><p className="text-xs text-muted-foreground capitalize">{template.category}</p></button>)}</div></div>}
            <div className="border-t border-border pt-4 space-y-3"><div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-secondary"/><p className="text-sm font-semibold">Custom task</p></div><CustomChallengeBuilder templates={customTemplates} value={newCustomTask} onChange={setNewCustomTask}/>{newCustomTask && <Button type="button" className="w-full" onClick={()=>void handleAddCustom()} disabled={addConfig.isPending||!newCustomTask.config.custom_name?.trim()}><Plus className="w-4 h-4 mr-2"/>Add this custom task</Button>}<p className="text-[11px] text-muted-foreground text-center">Add another after saving—there is no custom-task limit.</p></div>
          </div></motion.div>}</AnimatePresence>
        </div>

        <div className="flex gap-2 pt-4 border-t border-border"><Button variant="outline" onClick={()=>setShowAddTask((current)=>!current)} className="flex-1"><Plus className="w-4 h-4 mr-2"/>{showAddTask?'Hide':'Add Task'}</Button><Button onClick={()=>onOpenChange(false)} className="flex-1">Done</Button></div>
      </DialogContent>
    </Dialog>
  );
}

interface TaskConfigCardProps { config: LeagueTaskConfig; isExpanded:boolean; onToggleExpand:()=>void; onUpdate:(overrides:TaskConfigOverrides)=>void; onRemove:()=>void; isUpdating:boolean; isRemoving:boolean; }
function TaskConfigCard({config,isExpanded,onToggleExpand,onUpdate,onRemove,isRemoving}:TaskConfigCardProps){
  const template=config.task_template;
  const currentOverrides=(config.config_overrides||{}) as unknown as TaskConfigOverrides;
  if(!template)return null;
  const displayName=currentOverrides.custom_name?.trim()||template.name;
  return <motion.div layout className="rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div className="flex-1 min-w-0"><p className="font-medium truncate">{displayName}</p><div className="flex items-center gap-2 mt-1"><Badge variant="outline" className="text-xs capitalize">{template.name.startsWith(CUSTOM_PREFIX)?'custom':template.category}</Badge>{currentOverrides?.scoring_mode==='binary'&&<Badge variant="secondary" className="text-xs">Goal</Badge>}{currentOverrides?.target_time&&<Badge variant="secondary" className="text-xs">{currentOverrides.target_time}</Badge>}</div></div><Button variant="ghost" size="icon" onClick={onRemove} disabled={isRemoving} className="text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4"/></Button></div><TaskConfigurationPanel template={template} config={currentOverrides||getInitialConfig(template)} onChange={onUpdate} isExpanded={isExpanded} onToggleExpand={onToggleExpand}/></motion.div>;
}
