import { redactPathForLog } from './checkr.utils';

describe('redactPathForLog', () => {
  it('strips the query string that carries the candidate email', () => {
    expect(
      redactPathForLog('/v1/candidates?email=ada%40example.com'),
    ).toBe('/v1/candidates');
  });

  it('leaves paths without a query string untouched', () => {
    expect(redactPathForLog('/v1/reports/rep_1')).toBe('/v1/reports/rep_1');
  });
});
