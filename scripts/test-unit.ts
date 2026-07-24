import { normalizeCompany } from '@anchorproposal/shared';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

// Company normalization tests
assert(normalizeCompany('Google') === 'google', 'Google -> google');
assert(normalizeCompany('Google LLC') === 'google', 'Google LLC -> google');
assert(normalizeCompany('GOOGLE, Inc.') === 'google', 'GOOGLE Inc -> google');
assert(normalizeCompany('Microsoft Corporation') === 'microsoft', 'Microsoft Corporation');

// Duplicate key consistency
const key1 = normalizeCompany('Google') + '-profile1';
const key2 = normalizeCompany('Google LLC') + '-profile1';
assert(key1 === key2, 'Duplicate keys should match for Google/Google LLC');

console.log('All unit tests passed (5 assertions)');
