import fs from 'node:fs';

function replaceOnce(text, oldValue, newValue, label) {
  if (!text.includes(oldValue)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(oldValue, newValue);
}

let text = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
text = replaceOnce(
  text,
  "import { AccountabilityShareCard } from '@/components/solo/AccountabilityShareCard';\n",
  "import { AccountabilityShareCard } from '@/components/solo/AccountabilityShareCard';\nimport { WeeklyRecapDialog } from '@/components/recap/WeeklyRecapDialog';\n",
  'recap import',
);
text = replaceOnce(
  text,
  `      </main>\n    </div>\n  );`,
  `      </main>\n      <WeeklyRecapDialog seasonId={leagueDetails?.current_season?.id} />\n    </div>\n  );`,
  'recap dialog',
);
fs.writeFileSync('src/pages/Dashboard.tsx', text);
