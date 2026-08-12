import fs from 'node:fs';

function replaceOnce(text, oldValue, newValue, label) {
  if (!text.includes(oldValue)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(oldValue, newValue);
}

let wizard = fs.readFileSync('src/components/league/CreateLeagueWizard.tsx', 'utf8');
wizard = replaceOnce(
  wizard,
  `        await navigator.share({
          title: \`Join ${'${'}formData.name} on Zrizin\`,
          text: \`Use invite code: ${'${'}createdLeague.invite_code}\`,
          url: window.location.origin,
        });`,
  `        const inviteUrl = \`${'${'}window.location.origin}/?join=${'${'}encodeURIComponent(createdLeague.invite_code)}\`;
        await navigator.share({
          title: \`Join ${'${'}formData.name} on Zrizin\`,
          text: 'Tap the link to join my Zrizin league.',
          url: inviteUrl,
        });`,
  'shareable invite URL',
);
fs.writeFileSync('src/components/league/CreateLeagueWizard.tsx', wizard);

let tasks = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');
tasks = replaceOnce(
  tasks,
  "import { DailyCheckinList } from '@/components/checkin';\n",
  "import { DailyCheckinList } from '@/components/checkin';\nimport { FinishMyCard, countFinishableTasks } from '@/components/checkin/FinishMyCard';\n",
  'FinishMyCard import',
);
tasks = replaceOnce(
  tasks,
  "  const [activeCategory, setActiveCategory] = useState<string | null>(null);\n",
  "  const [activeCategory, setActiveCategory] = useState<string | null>(null);\n  const [finishCardOpen, setFinishCardOpen] = useState(false);\n",
  'FinishMyCard state',
);
tasks = replaceOnce(
  tasks,
  "  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;\n",
  "  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;\n  const finishableCount = countFinishableTasks(tasks);\n",
  'FinishMyCard count',
);
tasks = replaceOnce(
  tasks,
  `              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {scoringChancesLeft === 0 && tasks.length > 0
                    ? 'Perfect card — everything scored.'
                    : \`${'${'}scoringChancesLeft} scoring chance${'${'}scoringChancesLeft === 1 ? '' : 's'} left\`}
                </span>
                <span className="score-text text-sm text-primary">{Math.round(progress)}%</span>
              </div>`,
  `              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {scoringChancesLeft === 0 && tasks.length > 0
                    ? 'Perfect card — everything scored.'
                    : \`${'${'}scoringChancesLeft} scoring chance${'${'}scoringChancesLeft === 1 ? '' : 's'} left\`}
                </span>
                <span className="score-text text-sm text-primary">{Math.round(progress)}%</span>
              </div>
              {isToday && finishableCount >= 2 && (
                <Button variant="outline" className="w-full mt-3 h-9 gap-2" onClick={() => setFinishCardOpen(true)}>
                  <Zap className="w-3.5 h-3.5 text-secondary" />
                  Finish My Card · {finishableCount} quick decisions
                </Button>
              )}`,
  'FinishMyCard button',
);
tasks = replaceOnce(
  tasks,
  `      </main>
    </div>
  );`,
  `      </main>
      <FinishMyCard tasks={tasks} open={finishCardOpen} onOpenChange={setFinishCardOpen} />
    </div>
  );`,
  'FinishMyCard dialog',
);
fs.writeFileSync('src/pages/Tasks.tsx', tasks);
