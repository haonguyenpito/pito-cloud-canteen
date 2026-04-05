/**
 * DATA UTILITY SAFEGUARDS
 *
 * Tests for the core entity normalisation/denormalisation utilities and
 * accessor factory functions (User, Listing, Transaction, etc.).
 * These are used everywhere in the app to read Sharetribe API responses.
 *
 * Source file: src/utils/data.ts
 */

import {
  combinedRelationships,
  combinedResourceObjects,
  ensureBooking,
  ensureCurrentUser,
  ensureListing,
  ensureTransaction,
  ensureUser,
  getArrayByUuid,
  getDataWithRemovedOtherField,
  getListWithNewOtherValues,
  getUniqueString,
  getUniqueUsers,
  humanizeLineItemCode,
  IntegrationMenuListing,
  isTimeRangeWithinInterval,
  Listing,
  Transaction,
  updatedEntities,
  User,
  userAbbreviatedName,
  userDisplayNameAsString,
} from '@utils/data';

// ---------------------------------------------------------------------------
// combinedRelationships
// ---------------------------------------------------------------------------

describe('combinedRelationships', () => {
  it('returns null when both inputs are null/undefined', () => {
    expect(combinedRelationships(null, null)).toBeNull();
    expect(combinedRelationships(undefined, undefined)).toBeNull();
  });

  it('merges two relationship objects', () => {
    const result = combinedRelationships({ a: 1 }, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('new values overwrite old values for the same key', () => {
    const result = combinedRelationships({ a: 1 }, { a: 99 });
    expect(result).toEqual({ a: 99 });
  });

  it('returns existing rels when new is null', () => {
    expect(combinedRelationships({ a: 1 }, null)).toEqual({ a: 1 });
  });
});

// ---------------------------------------------------------------------------
// combinedResourceObjects
// ---------------------------------------------------------------------------

describe('combinedResourceObjects', () => {
  const makeRes = (uuid: string, type: string, attrs = {}) => ({
    id: { uuid },
    type,
    attributes: attrs,
  });

  it('merges attributes from both objects', () => {
    const old = makeRes('123', 'listing', { title: 'Old' });
    const next = makeRes('123', 'listing', { description: 'New' });
    const result = combinedResourceObjects(old, next);
    expect(result.attributes.title).toBe('Old');
    expect(result.attributes.description).toBe('New');
  });

  it('new attributes overwrite old attributes', () => {
    const old = makeRes('123', 'listing', { title: 'Old' });
    const next = makeRes('123', 'listing', { title: 'New' });
    const result = combinedResourceObjects(old, next);
    expect(result.attributes.title).toBe('New');
  });

  it('throws when merging objects with different ids', () => {
    const old = makeRes('123', 'listing');
    const next = makeRes('456', 'listing');
    expect(() => combinedResourceObjects(old, next)).toThrow();
  });

  it('throws when merging objects with different types', () => {
    const old = makeRes('123', 'listing');
    const next = makeRes('123', 'user');
    expect(() => combinedResourceObjects(old, next)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ensure* shell helpers
// ---------------------------------------------------------------------------

describe('ensureTransaction', () => {
  it('returns default shell when given undefined', () => {
    const result = ensureTransaction(undefined);
    expect(result.type).toBe('transaction');
    expect(result.id).toBeNull();
  });

  it('preserves provided fields', () => {
    const tx = { id: { uuid: 'abc' }, attributes: { lastTransition: 'x' } };
    const result = ensureTransaction(tx);
    expect(result.id).toEqual({ uuid: 'abc' });
  });
});

describe('ensureListing', () => {
  it('returns shell with publicData and metadata when given null', () => {
    const result = ensureListing(null);
    expect(result.type).toBe('listing');
    expect(result.attributes.publicData).toEqual({});
    expect(result.attributes.metadata).toEqual({});
    expect(result.images).toEqual([]);
  });

  it('preserves provided listing data', () => {
    const listing = { id: { uuid: 'ld1' }, attributes: { title: 'Cơm gà' } };
    const result = ensureListing(listing);
    expect(result.attributes.title).toBe('Cơm gà');
  });
});

describe('ensureUser', () => {
  it('returns shell with empty profile when given null', () => {
    const result = ensureUser(null);
    expect(result.type).toBe('user');
    expect(result.attributes.profile).toEqual({});
  });

  it('deep-merges profile fields', () => {
    const user = {
      id: { uuid: 'u1' },
      attributes: { profile: { firstName: 'An' } },
    };
    const result = ensureUser(user);
    expect(result.attributes.profile.firstName).toBe('An');
  });
});

describe('ensureCurrentUser', () => {
  it('returns shell with emailVerified=false when given undefined', () => {
    const result = ensureCurrentUser(undefined);
    expect(result.type).toBe('currentUser');
    expect(result.attributes.emailVerified).toBe(false);
    expect(result.attributes.banned).toBe(false);
  });
});

describe('ensureBooking', () => {
  it('returns shell with type=booking when given undefined', () => {
    const result = ensureBooking(undefined);
    expect(result.type).toBe('booking');
    expect(result.id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// userDisplayNameAsString / userAbbreviatedName
// ---------------------------------------------------------------------------

describe('userDisplayNameAsString', () => {
  it('returns displayName when present', () => {
    const user = {
      attributes: { profile: { displayName: 'Nguyễn An' } },
    } as any;
    expect(userDisplayNameAsString(user, 'default')).toBe('Nguyễn An');
  });

  it('returns defaultUserDisplayName when displayName is missing', () => {
    const user = { attributes: { profile: {} } } as any;
    expect(userDisplayNameAsString(user, 'default')).toBe('default');
  });

  it('returns empty string when user is null and no default provided', () => {
    expect(userDisplayNameAsString(null as any, '')).toBe('');
  });
});

describe('userAbbreviatedName', () => {
  it('returns abbreviatedName when present', () => {
    const user = {
      attributes: { profile: { abbreviatedName: 'NA' } },
    } as any;
    expect(userAbbreviatedName(user, 'XX')).toBe('NA');
  });

  it('returns default when abbreviatedName is missing', () => {
    const user = { attributes: { profile: {} } } as any;
    expect(userAbbreviatedName(user, 'XX')).toBe('XX');
  });
});

// ---------------------------------------------------------------------------
// humanizeLineItemCode
// ---------------------------------------------------------------------------

describe('humanizeLineItemCode', () => {
  it('strips the line-item/ prefix and capitalises', () => {
    expect(humanizeLineItemCode('line-item/base-order-price' as any)).toBe(
      'Base order price',
    );
  });

  it('throws for invalid code format', () => {
    expect(() => humanizeLineItemCode('invalid-code' as any)).toThrow();
  });

  it('handles single-word code', () => {
    expect(humanizeLineItemCode('line-item/fee' as any)).toBe('Fee');
  });
});

// ---------------------------------------------------------------------------
// User accessor factory
// ---------------------------------------------------------------------------

describe('User()', () => {
  const makeUser = (overrides: any = {}) => ({
    id: { uuid: 'user-001' },
    type: 'user',
    attributes: {
      profile: {
        firstName: 'An',
        lastName: 'Nguyễn',
        metadata: { isPartner: false },
        privateData: { oneSignalUserIds: ['os-123'] },
        publicData: { phone: '0901234567' },
        protectedData: { secret: 'x' },
      },
    },
    ...overrides,
  });

  it('getId() returns uuid', () => {
    expect(User(makeUser()).getId()).toBe('user-001');
  });

  it('getProfile() returns profile object', () => {
    const profile = User(makeUser()).getProfile();
    expect(profile.firstName).toBe('An');
  });

  it('getMetadata() returns metadata', () => {
    expect(User(makeUser()).getMetadata().isPartner).toBe(false);
  });

  it('getPrivateData() returns privateData', () => {
    expect(User(makeUser()).getPrivateData().oneSignalUserIds).toEqual([
      'os-123',
    ]);
  });

  it('getPublicData() returns publicData', () => {
    expect(User(makeUser()).getPublicData().phone).toBe('0901234567');
  });

  it('handles null gracefully — getId() returns undefined', () => {
    expect(User(null as any).getId()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Listing accessor factory
// ---------------------------------------------------------------------------

describe('Listing()', () => {
  const makeListing = (metadataOverrides: any = {}) =>
    ({
      id: { uuid: 'listing-001' },
      type: 'listing',
      attributes: {
        title: 'Cơm bụi',
        publicData: { menuType: 'fixed-menu' },
        metadata: { startDate: 1700000000000, ...metadataOverrides },
      },
    } as any);

  it('getId() returns uuid', () => {
    expect(Listing(makeListing()).getId()).toBe('listing-001');
  });

  it('getMetadata() returns metadata', () => {
    expect(Listing(makeListing()).getMetadata().startDate).toBe(1700000000000);
  });

  it('getPublicData() returns publicData', () => {
    expect(Listing(makeListing()).getPublicData().menuType).toBe('fixed-menu');
  });

  it('handles null gracefully — getId() returns undefined', () => {
    expect(Listing(null).getId()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Transaction accessor factory
// ---------------------------------------------------------------------------

describe('Transaction()', () => {
  const makeTx = () =>
    ({
      id: { uuid: 'tx-001' },
      attributes: {
        lastTransition: 'transition/complete-delivery',
        metadata: { planId: 'plan-xyz' },
      },
    } as any);

  it('getId() returns uuid', () => {
    expect(Transaction(makeTx()).getId()).toBe('tx-001');
  });

  it('getMetadata() returns metadata', () => {
    expect(Transaction(makeTx()).getMetadata().planId).toBe('plan-xyz');
  });
});

// ---------------------------------------------------------------------------
// getArrayByUuid
// ---------------------------------------------------------------------------

describe('getArrayByUuid', () => {
  it('deduplicates items by id', () => {
    const items = [
      { id: 'a', name: 'first' },
      { id: 'a', name: 'duplicate' },
      { id: 'b', name: 'second' },
    ];
    const result = getArrayByUuid(items);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('first');
  });

  it('skips items without an id', () => {
    const items = [{ name: 'no-id' }, { id: 'ok', name: 'has-id' }];
    const result = getArrayByUuid(items);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('has-id');
  });
});

// ---------------------------------------------------------------------------
// getUniqueString
// ---------------------------------------------------------------------------

describe('getUniqueString', () => {
  it('removes duplicate strings', () => {
    expect(getUniqueString(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for empty input', () => {
    expect(getUniqueString([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getUniqueUsers
// ---------------------------------------------------------------------------

describe('getUniqueUsers', () => {
  const makeUser = (uuid: string) =>
    ({
      id: { uuid },
      type: 'user',
      attributes: { profile: {} },
    } as any);

  it('removes duplicate users by id', () => {
    const users = [makeUser('u1'), makeUser('u2'), makeUser('u1')];
    const result = getUniqueUsers(users);
    expect(result).toHaveLength(2);
  });

  it('preserves all unique users', () => {
    const users = [makeUser('u1'), makeUser('u2'), makeUser('u3')];
    expect(getUniqueUsers(users)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// getDataWithRemovedOtherField
// ---------------------------------------------------------------------------

describe('getDataWithRemovedOtherField', () => {
  it('removes the string "other" from array', () => {
    expect(getDataWithRemovedOtherField(['a', 'other', 'b'])).toEqual([
      'a',
      'b',
    ]);
  });

  it('returns unchanged array when no "other" present', () => {
    expect(getDataWithRemovedOtherField(['a', 'b'])).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// getListWithNewOtherValues
// ---------------------------------------------------------------------------

describe('getListWithNewOtherValues', () => {
  it('returns list unchanged when newOtherValue already exists in list', () => {
    const result = getListWithNewOtherValues(
      'custom',
      'old',
      ['custom', 'other'],
      true,
    );
    expect(result).toEqual(['custom', 'other']);
  });

  it('replaces old other value with new other value', () => {
    const result = getListWithNewOtherValues(
      'newVal',
      'oldVal',
      ['a', 'oldVal'],
      true,
    );
    expect(result).toContain('newVal');
    expect(result).not.toContain('oldVal');
  });

  it('appends newOtherValue when no old value is in list', () => {
    const result = getListWithNewOtherValues('custom', '', ['a', 'b'], true);
    expect(result).toContain('custom');
  });

  it('removes old value when hasOtherValueInList is false', () => {
    const result = getListWithNewOtherValues(
      'custom',
      'old',
      ['a', 'old'],
      false,
    );
    expect(result).not.toContain('old');
  });
});

// ---------------------------------------------------------------------------
// isTimeRangeWithinInterval
// ---------------------------------------------------------------------------

describe('isTimeRangeWithinInterval', () => {
  it('returns true when range is fully within interval', () => {
    expect(isTimeRangeWithinInterval('08:00', '17:00', '09:00', '16:00')).toBe(
      true,
    );
  });

  it('returns false when range partially overlaps', () => {
    expect(isTimeRangeWithinInterval('08:00', '12:00', '11:00', '13:00')).toBe(
      false,
    );
  });

  it('returns false for missing input', () => {
    expect(
      isTimeRangeWithinInterval(undefined, '17:00', '09:00', '16:00'),
    ).toBe(false);
    expect(
      isTimeRangeWithinInterval('08:00', undefined, '09:00', '16:00'),
    ).toBe(false);
  });

  it('returns false for invalid time format', () => {
    expect(isTimeRangeWithinInterval('8am', '5pm', '9am', '4pm')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// IntegrationMenuListing.getListFoodIds
// ---------------------------------------------------------------------------

describe('IntegrationMenuListing', () => {
  it('aggregates all food IDs across weekdays', () => {
    const listing = {
      id: { uuid: 'm-001' },
      attributes: {
        metadata: {
          monFoodIdList: ['f1', 'f2'],
          tueFoodIdList: ['f2', 'f3'],
          wedFoodIdList: [],
        },
      },
    } as any;
    const ids = IntegrationMenuListing(listing).getListFoodIds();
    // f2 appears twice but should be deduped
    expect(ids).toContain('f1');
    expect(ids).toContain('f2');
    expect(ids).toContain('f3');
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });

  it('returns empty array when no food lists present', () => {
    const listing = {
      id: { uuid: 'm-002' },
      attributes: { metadata: {} },
    } as any;
    expect(IntegrationMenuListing(listing).getListFoodIds()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// updatedEntities (normalisation)
// ---------------------------------------------------------------------------

describe('updatedEntities', () => {
  it('indexes a single entity by type and uuid', () => {
    const apiResponse = {
      data: { id: { uuid: 'l1' }, type: 'listing', attributes: { title: 'T' } },
      included: [],
    };
    const result = updatedEntities({}, apiResponse);
    expect(result.listing.l1.attributes.title).toBe('T');
  });

  it('merges new entity attributes into existing ones', () => {
    const existing = {
      listing: {
        l1: {
          id: { uuid: 'l1' },
          type: 'listing',
          attributes: { title: 'Old', description: 'Old desc' },
        },
      },
    };
    const apiResponse = {
      data: {
        id: { uuid: 'l1' },
        type: 'listing',
        attributes: { title: 'Updated title', description: 'New desc' },
      },
      included: [],
    };
    const result = updatedEntities(existing, apiResponse);
    // New attributes win when present (sanitizeListing processes both fields)
    expect(result.listing.l1.attributes.title).toBe('Updated title');
    expect(result.listing.l1.attributes.description).toBe('New desc');
  });
});
