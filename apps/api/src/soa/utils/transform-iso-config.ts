import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Transforms ISO control JSON into SOA configuration format
 */

type ISOControl = {
  title: string;
  control_objective: string | null;
  closure: string;
  isApplicable: boolean | null;
};

type SOAColumn = {
  name: string;
  type: 'string' | 'boolean' | 'text';
};

type SOAQuestion = {
  id: string;
  text: string;
  columnMapping: {
    title: string;
    closure: string;
    control_objective: string | null;
    isApplicable: boolean | null;
    justification: string | null;
  };
};

type SOAConfiguration = {
  columns: SOAColumn[];
  questions: SOAQuestion[];
};

function transformISOConfigToSOA(controls: ISOControl[]): SOAConfiguration {
  const columns: SOAColumn[] = [
    { name: 'closure', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'control_objective', type: 'string' },
    { name: 'isApplicable', type: 'boolean' },
    { name: 'justification', type: 'string' },
  ];

  const questions: SOAQuestion[] = controls
    .filter((control) => {
      return (
        control.title &&
        control.control_objective !== null &&
        control.control_objective.trim() !== ''
      );
    })
    .map((control, index) => {
      const id = `iso-control-${index}-${control.title.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`;

      return {
        id,
        text: control.control_objective || control.title,
        columnMapping: {
          closure: control.closure,
          title: control.title,
          control_objective: control.control_objective,
          isApplicable: control.isApplicable ?? null,
          justification: null,
        },
      };
    });

  return {
    columns,
    questions,
  };
}

/**
 * Loads and transforms ISO config JSON file
 */
export async function loadISOConfig(): Promise<SOAConfiguration> {
  // Nest copies seedJson beside the compiled SOA module. Keeping the lookup
  // relative to this file makes the same path work in source and dist builds.
  const configPath = join(__dirname, '../seedJson/ISO/config.json');

  try {
    const configContent = await readFile(configPath, 'utf-8');
    const isoControls: ISOControl[] = JSON.parse(configContent);
    return transformISOConfigToSOA(isoControls);
  } catch (error) {
    throw new Error(
      `Failed to load ISO config at ${configPath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
