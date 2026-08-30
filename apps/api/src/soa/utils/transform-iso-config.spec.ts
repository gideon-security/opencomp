import { loadISOConfig } from './transform-iso-config';

describe('loadISOConfig', () => {
  it('loads the packaged ISO seed configuration', async () => {
    const config = await loadISOConfig();

    expect(config.columns).toEqual(
      expect.arrayContaining([
        { name: 'title', type: 'string' },
        { name: 'isApplicable', type: 'boolean' },
      ]),
    );
    expect(config.questions.length).toBeGreaterThan(0);
    expect(config.questions[0]).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^iso-control-/),
        text: expect.any(String),
      }),
    );
  });
});
