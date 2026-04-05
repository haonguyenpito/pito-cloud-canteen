/**
 * SANITIZE UTILITY SAFEGUARDS
 *
 * These tests protect XSS sanitization logic applied to user-generated
 * content from Sharetribe entities (users and listings).
 *
 * Key contract: < and > are replaced with fullwidth Unicode equivalents
 * (ＵFF1C / ＵFF1E) to neutralize script injection in entity fields.
 *
 * Source file: src/utils/sanitize.ts
 */

import { sanitizeEntity, sanitizeListing, sanitizeUser } from '@utils/sanitize';

const FULLWIDTH_LT = '\uff1c'; // ＜
const FULLWIDTH_GT = '\uff1e'; // ＞

// ---------------------------------------------------------------------------
// sanitizeUser
// ---------------------------------------------------------------------------

describe('sanitizeUser', () => {
  it('replaces < and > in firstName', () => {
    const entity = {
      attributes: {
        profile: { firstName: '<script>', lastName: 'Safe' },
      },
    };
    const result = sanitizeUser(entity);
    expect(result.attributes.profile.firstName).toBe(
      `${FULLWIDTH_LT}script${FULLWIDTH_GT}`,
    );
  });

  it('replaces < and > in lastName', () => {
    const entity = {
      attributes: {
        profile: { firstName: 'Safe', lastName: '<b>Name</b>' },
      },
    };
    const result = sanitizeUser(entity);
    expect(result.attributes.profile.lastName).toBe(
      `${FULLWIDTH_LT}b${FULLWIDTH_GT}Name${FULLWIDTH_LT}/b${FULLWIDTH_GT}`,
    );
  });

  it('replaces < and > in displayName', () => {
    const entity = {
      attributes: {
        profile: { displayName: '<b>Display</b>' },
      },
    };
    const result = sanitizeUser(entity);
    expect(result.attributes.profile.displayName).toBe(
      `${FULLWIDTH_LT}b${FULLWIDTH_GT}Display${FULLWIDTH_LT}/b${FULLWIDTH_GT}`,
    );
  });

  it('replaces < and > in bio', () => {
    const entity = {
      attributes: {
        profile: { bio: 'Hello <world>' },
      },
    };
    const result = sanitizeUser(entity);
    expect(result.attributes.profile.bio).toBe(
      `Hello ${FULLWIDTH_LT}world${FULLWIDTH_GT}`,
    );
  });

  it('leaves clean text unchanged', () => {
    const entity = {
      attributes: {
        profile: { firstName: 'Nguyễn', lastName: 'An' },
      },
    };
    const result = sanitizeUser(entity);
    expect(result.attributes.profile.firstName).toBe('Nguyễn');
    expect(result.attributes.profile.lastName).toBe('An');
  });

  it('handles missing profile gracefully', () => {
    const entity = { attributes: {} };
    expect(() => sanitizeUser(entity)).not.toThrow();
  });

  it('handles null entity gracefully', () => {
    expect(() => sanitizeUser(null as any)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// sanitizeListing
// ---------------------------------------------------------------------------

describe('sanitizeListing', () => {
  it('replaces < and > in title', () => {
    const entity = {
      attributes: { title: '<h1>Title</h1>' },
    };
    const result = sanitizeListing(entity);
    expect(result.attributes.title).toBe(
      `${FULLWIDTH_LT}h1${FULLWIDTH_GT}Title${FULLWIDTH_LT}/h1${FULLWIDTH_GT}`,
    );
  });

  it('replaces < and > in description', () => {
    const entity = {
      attributes: { description: 'Clean <script>evil()</script> end' },
    };
    const result = sanitizeListing(entity);
    expect(result.attributes.description).toContain(FULLWIDTH_LT);
    expect(result.attributes.description).not.toContain('<');
  });

  it('sanitizes location address', () => {
    const entity = {
      attributes: {
        publicData: {
          location: { address: '123 <Street>', building: 'B' },
        },
      },
    };
    const result = sanitizeListing(entity);
    expect(result.attributes.publicData.location.address).not.toContain('<');
  });

  it('sanitizes rules', () => {
    const entity = {
      attributes: {
        publicData: { rules: 'No <script>alert(1)</script>' },
      },
    };
    const result = sanitizeListing(entity);
    expect(result.attributes.publicData.rules).not.toContain('<');
  });

  it('leaves clean text unchanged', () => {
    const entity = {
      attributes: { title: 'Cơm gà xối mỡ', description: 'Ngon lắm' },
    };
    const result = sanitizeListing(entity);
    expect(result.attributes.title).toBe('Cơm gà xối mỡ');
    expect(result.attributes.description).toBe('Ngon lắm');
  });
});

// ---------------------------------------------------------------------------
// sanitizeEntity (router)
// ---------------------------------------------------------------------------

describe('sanitizeEntity', () => {
  it('routes listing type to sanitizeListing', () => {
    const entity = {
      type: 'listing',
      attributes: { title: '<script>' },
    };
    const result = sanitizeEntity(entity);
    expect(result.attributes.title).not.toContain('<');
  });

  it('routes user type to sanitizeUser', () => {
    const entity = {
      type: 'user',
      attributes: { profile: { firstName: '<b>Name</b>' } },
    };
    const result = sanitizeEntity(entity);
    expect(result.attributes.profile.firstName).not.toContain('<');
  });

  it('returns entity unchanged for unknown type', () => {
    const entity = { type: 'unknown', data: '<raw>' };
    const result = sanitizeEntity(entity);
    expect(result).toEqual(entity);
  });
});
