import { normalizeCompany } from '../src/utils';

describe('normalizeCompany', () => {
  it('normalizes company names', () => {
    expect(normalizeCompany('Google')).toBe('google');
    expect(normalizeCompany('Google LLC')).toBe('google');
    expect(normalizeCompany('GOOGLE, Inc.')).toBe('google');
    expect(normalizeCompany('  Acme Corp  ')).toBe('acme');
  });

  it('handles legal suffixes', () => {
    expect(normalizeCompany('Microsoft Corporation')).toBe('microsoft');
    expect(normalizeCompany('Apple Ltd.')).toBe('apple');
  });
});
