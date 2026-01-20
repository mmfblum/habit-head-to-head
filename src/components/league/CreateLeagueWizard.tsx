import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Copy, Share2, Trophy, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateLeague, useCreateSeason, useConfigureSeasonTasks } from '@/hooks/useLeagues';
import { useTaskTemplatesByCategory, TaskTemplate } from '@/hooks/useTaskTemplates';
import { toast } from 'sonner';
import { TaskSelectionGrid } from './TaskSelectionGrid';

type WizardStep = 'details' | 'tasks' | 'invite';

interface LeagueFormData {
  name: string;
  description: string;
  weeksCount: number;
}

export function CreateLeagueWizard({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>('details');
  const [formData, setFormData] = useState<LeagueFormData>({
    name: '',
    description: '',
    weeksCount: 4,
  });
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [createdLeague, setCreatedLeague] = useState<{ id: string; invite_code: string | null } | null>(null);
  const [createdSeason, setCreatedSeason] = useState<{ id: string } | null>(null);

  const { groupedTemplates, isLoading: tasksLoading } = useTaskTemplatesByCategory();
  const createLeague = useCreateLeague();
  const createSeason = useCreateSeason();
  const configureTasks = useConfigureSeasonTasks();

  const handleDetailsSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a league name');
      return;
    }

    try {
      const league = await createLeague.mutateAsync({
        name: formData.name,
        description: formData.description,
      });

      const season = await createSeason.mutateAsync({
        leagueId: league.id,
        name: 'Season 1',
        weeksCount: formData.weeksCount,
        startDate: new Date(),
      });

      setCreatedLeague(league);
      setCreatedSeason(season);
      setStep('tasks');
    } catch (error) {
      toast.error('Failed to create league');
    }
  };

  const handleTasksSubmit = async () => {
    if (selectedTasks.length < 3) {
      toast.error('Please select at least 3 tasks');
      return;
    }

    if (!createdSeason) return;

    try {
      await configureTasks.mutateAsync({
        seasonId: createdSeason.id,
        taskConfigs: selectedTasks.map((taskId, index) => ({
          task_template_id: taskId,
          display_order: index,
        })),
      });

      setStep('invite');
      toast.success('Tasks configured!');
    } catch (error) {
      toast.error('Failed to configure tasks');
    }
  };

  const copyInviteCode = () => {
    if (createdLeague?.invite_code) {
      navigator.clipboard.writeText(createdLeague.invite_code);
      toast.success('Invite code copied!');
    }
  };

  const shareInvite = async () => {
    if (createdLeague?.invite_code && navigator.share) {
      try {
        await navigator.share({
          title: `Join ${formData.name} on ProGrind`,
          text: `Use invite code: ${createdLeague.invite_code}`,
          url: window.location.origin,
        });
      } catch {
        copyInviteCode();
      }
    } else {
      copyInviteCode();
    }
  };

  const finishSetup = () => {
    onClose();
    navigate('/league');
  };

  const steps = [
    { id: 'details', label: 'Details', icon: Trophy },
    { id: 'tasks', label: 'Tasks', icon: Zap },
    { id: 'invite', label: 'Invite', icon: Users },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border z-10">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={step === 'details' ? onClose : () => setStep(steps[currentStepIndex - 1].id as WizardStep)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {step === 'details' ? 'Cancel' : 'Back'}
              </Button>
              <h2 className="font-display font-bold text-lg">Create League</h2>
              <div className="w-16" />
            </div>

            {/* Progress */}
            <div className="flex items-center justify-center gap-2">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      i <= currentStepIndex
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {i < currentStepIndex ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`w-12 h-0.5 mx-1 ${
                        i < currentStepIndex ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
          <AnimatePresence mode="wait">
            {step === 'details' && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <Trophy className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h3 className="text-xl font-display font-bold">Name Your League</h3>
                  <p className="text-muted-foreground">Create a league for you and your friends to compete</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">League Name</Label>
                    <Input
                      id="name"
                      placeholder="The Productivity Pros"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="A league for serious grinders..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weeks">Season Length</Label>
                    <div className="flex gap-2">
                      {[2, 3, 4].map((weeks) => (
                        <Button
                          key={weeks}
                          type="button"
                          variant={formData.weeksCount === weeks ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() => setFormData({ ...formData, weeksCount: weeks })}
                        >
                          {weeks} weeks
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleDetailsSubmit}
                  className="w-full"
                  size="lg"
                  disabled={createLeague.isPending || createSeason.isPending}
                >
                  {createLeague.isPending || createSeason.isPending ? 'Creating...' : 'Continue'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            )}

            {step === 'tasks' && (
              <motion.div
                key="tasks"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <Zap className="w-12 h-12 text-secondary mx-auto mb-3" />
                  <h3 className="text-xl font-display font-bold">Select Tasks</h3>
                  <p className="text-muted-foreground">
                    Choose which tasks members will compete on ({selectedTasks.length} selected)
                  </p>
                </div>

                {tasksLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
                ) : (
                  <TaskSelectionGrid
                    groupedTemplates={groupedTemplates || {}}
                    selectedTasks={selectedTasks}
                    onToggleTask={(taskId) => {
                      setSelectedTasks((prev) =>
                        prev.includes(taskId)
                          ? prev.filter((id) => id !== taskId)
                          : [...prev, taskId]
                      );
                    }}
                  />
                )}

                <div className="sticky bottom-4 pt-4 bg-gradient-to-t from-background via-background to-transparent">
                  <Button
                    onClick={handleTasksSubmit}
                    className="w-full"
                    size="lg"
                    disabled={selectedTasks.length < 3 || configureTasks.isPending}
                  >
                    {configureTasks.isPending ? 'Saving...' : `Continue with ${selectedTasks.length} tasks`}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 'invite' && (
              <motion.div
                key="invite"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-display font-bold">League Created!</h3>
                  <p className="text-muted-foreground">Share this code with friends to invite them</p>
                </div>

                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">Invite Code</p>
                      <p className="text-3xl font-display font-bold tracking-wider text-primary uppercase">
                        {createdLeague?.invite_code || '...'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={copyInviteCode}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Code
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={shareInvite}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  <Users className="w-4 h-4 inline mr-1" />
                  Need at least 4 members to start the season
                </div>

                <Button onClick={finishSetup} className="w-full" size="lg">
                  Go to League
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
