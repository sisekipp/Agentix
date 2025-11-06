import { db } from '../src/lib/db';
import { scenarios, scenarioVersions } from '../src/lib/db/schema';
import { sql } from 'drizzle-orm';

/**
 * Fix scenarios that have empty nodes array
 * Adds a trigger node to prevent execution failures
 */
async function fixEmptyScenarios() {
  console.log('🔍 Finding scenarios with empty nodes...');

  // Find all scenario versions with empty or missing nodes
  const emptyVersions = await db
    .select()
    .from(scenarioVersions)
    .where(sql`
      (orchestration_definition->'nodes' IS NULL
       OR jsonb_array_length(orchestration_definition->'nodes') = 0)
    `);

  console.log(`Found ${emptyVersions.length} scenario versions with no nodes`);

  for (const version of emptyVersions) {
    console.log(`Fixing version ${version.id} for scenario ${version.scenarioId}`);

    // Get the scenario to know the trigger type
    const [scenario] = await db
      .select()
      .from(scenarios)
      .where(sql`id = ${version.scenarioId}`)
      .limit(1);

    if (!scenario) {
      console.warn(`  ⚠️  Scenario ${version.scenarioId} not found, skipping`);
      continue;
    }

    // Create orchestration with trigger node
    const fixedOrchestration = {
      nodes: [
        {
          id: 'trigger-node',
          type: 'scenario-trigger',
          position: { x: 250, y: 100 },
          data: {
            label: 'Trigger',
            config: {
              triggerType: scenario.triggerType,
            },
          },
        },
      ],
      edges: [],
    };

    // Update the version
    await db
      .update(scenarioVersions)
      .set({
        orchestrationDefinition: fixedOrchestration,
      })
      .where(sql`id = ${version.id}`);

    // Also update the main scenario
    await db
      .update(scenarios)
      .set({
        orchestrationDefinition: fixedOrchestration,
      })
      .where(sql`id = ${scenario.id}`);

    console.log(`  ✅ Fixed scenario ${scenario.name} (${scenario.id})`);
  }

  console.log('✨ Done!');
}

fixEmptyScenarios()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error fixing scenarios:', error);
    process.exit(1);
  });
