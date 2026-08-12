import fs from 'node:fs';

let text = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

if (!text.includes("import { WeeklyRecapDialog } from '@/components/recap/WeeklyRecapDialog';")) {
  const importAnchor = "import { AccountabilityShareCard } from '@/components/solo/AccountabilityShareCard';\n";
  if (!text.includes(importAnchor)) throw new Error('Missing recap import anchor');
  text = text.replace(importAnchor, `${importAnchor}import { WeeklyRecapDialog } from '@/components/recap/WeeklyRecapDialog';\n`);
}

if (!text.includes('<WeeklyRecapDialog seasonId={leagueDetails?.current_season?.id} />')) {
  const renderAnchor = `      </main>\n    </div>\n  );`;
  if (!text.includes(renderAnchor)) throw new Error('Missing recap render anchor');
  text = text.replace(
    renderAnchor,
    `      </main>\n      <WeeklyRecapDialog seasonId={leagueDetails?.current_season?.id} />\n    </div>\n  );`
  );
}

fs.writeFileSync('src/pages/Dashboard.tsx', text);
