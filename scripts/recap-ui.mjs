import fs from 'node:fs';

let text = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

if (!text.includes("import { WeeklyRecapDialog } from '@/components/recap/WeeklyRecapDialog';")) {
  const importAnchor = "import { AccountabilityShareCard } from '@/components/solo/AccountabilityShareCard';\n";
  if (!text.includes(importAnchor)) throw new Error('Missing recap import anchor');
  text = text.replace(importAnchor, `${importAnchor}import { WeeklyRecapDialog } from '@/components/recap/WeeklyRecapDialog';\n`);
}

const recapLine = '      <WeeklyRecapDialog seasonId={leagueDetails?.current_season?.id} />\n';
text = text.replaceAll(recapLine, '');

const renderAnchor = `      </main>\n    </div>\n  );`;
const index = text.lastIndexOf(renderAnchor);
if (index < 0) throw new Error('Missing final Dashboard render anchor');
text = `${text.slice(0, index)}      </main>\n${recapLine}    </div>\n  );${text.slice(index + renderAnchor.length)}`;

fs.writeFileSync('src/pages/Dashboard.tsx', text);
