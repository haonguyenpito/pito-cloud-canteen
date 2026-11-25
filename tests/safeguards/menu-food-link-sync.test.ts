/**
 * A menu save keeps each dish's `menuIdList` / `menuWeekDay` in sync
 * (restaurant search reads them). The sync must write the same values as
 * before while batching its Sharetribe reads, so a large menu saves within the
 * serverless timeout.
 *
 * Source: src/pages/api/apiServices/menu/updateMenuIdListAndMenuWeekDayListForFood.service.ts
 */
import {
  fetchListingsByChunkedIds,
  queryAllListings,
} from '@helpers/apiHelpers';
import updateMenuIdListAndMenuWeekDayListForFood from '@pages/api/apiServices/menu/updateMenuIdListAndMenuWeekDayListForFood.service';
import { getIntegrationSdk } from '@services/integrationSdk';

jest.mock('@services/integrationSdk', () => ({ getIntegrationSdk: jest.fn() }));
jest.mock('@helpers/apiHelpers', () => ({
  queryAllListings: jest.fn(),
  fetchListingsByChunkedIds: jest.fn(),
}));

const listing = (
  id: string,
  publicData: Record<string, unknown> = {},
  metadata: Record<string, unknown> = {},
) => ({
  id: { uuid: id },
  type: 'listing',
  attributes: { publicData, metadata },
});

const toQueryResponse = (listings: unknown[]) => ({
  data: { data: listings, included: [] },
});

describe('updateMenuIdListAndMenuWeekDayListForFood', () => {
  const update = jest.fn();
  const query = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    (getIntegrationSdk as jest.Mock).mockReturnValue({
      listings: { update, query },
    });
  });

  it('links new dishes, unlinks removed ones and writes only what changes', async () => {
    // Menu M now serves `a` on mon+tue and `c` on mon; `b` was removed.
    const menu = listing(
      'M',
      {},
      { monFoodIdList: ['a', 'c'], tueFoodIdList: ['a'] },
    );

    (fetchListingsByChunkedIds as jest.Mock).mockResolvedValue([
      listing('a', { menuIdList: ['X'], menuWeekDay: ['fri'] }),
      listing('c', { menuIdList: ['M'], menuWeekDay: ['mon'] }),
    ]);
    query.mockResolvedValue(
      toQueryResponse([
        listing('a', {
          menuIdList: ['X', 'M'],
          menuWeekDay: ['fri', 'mon', 'tue'],
        }),
        listing('b', { menuIdList: ['M', 'Y'], menuWeekDay: ['mon', 'wed'] }),
        listing('c', { menuIdList: ['M'], menuWeekDay: ['mon'] }),
      ]),
    );
    const servingMenus: Record<string, unknown[]> = {
      fri: [listing('X', {}, { friFoodIdList: ['a'] })],
      mon: [
        listing('M', {}, { monFoodIdList: ['a', 'c'] }),
        listing('Y', {}, { monFoodIdList: ['b'] }),
      ],
      tue: [listing('M', {}, { tueFoodIdList: ['a'] })],
      wed: [],
    };
    (queryAllListings as jest.Mock).mockImplementation(({ query: q }) => {
      const [key] = Object.keys(q);

      return Promise.resolve(servingMenus[key.slice(5, 8)]);
    });

    await updateMenuIdListAndMenuWeekDayListForFood(menu as never);

    expect(fetchListingsByChunkedIds).toHaveBeenCalledWith(
      ['a', 'c'],
      expect.anything(),
    );
    // One read per weekday, never one per dish and weekday.
    expect(queryAllListings).toHaveBeenCalledTimes(4);
    expect(update.mock.calls.map(([body]) => body)).toEqual([
      {
        id: 'a',
        // Day order follows getWeekDayFromListId, unchanged from before.
        publicData: {
          menuIdList: ['X', 'M'],
          menuWeekDay: ['fri', 'tue', 'mon'],
        },
      },
      {
        id: 'b',
        publicData: { menuIdList: ['Y'], menuWeekDay: ['mon'] },
      },
    ]);
  });

  it('writes nothing when every dish is already in sync', async () => {
    const menu = listing('M', {}, { monFoodIdList: ['a'] });

    (fetchListingsByChunkedIds as jest.Mock).mockResolvedValue([
      listing('a', { menuIdList: ['M'], menuWeekDay: ['mon'] }),
    ]);
    query.mockResolvedValue(
      toQueryResponse([
        listing('a', { menuIdList: ['M'], menuWeekDay: ['mon'] }),
      ]),
    );
    (queryAllListings as jest.Mock).mockResolvedValue([
      listing('M', {}, { monFoodIdList: ['a'] }),
    ]);

    await updateMenuIdListAndMenuWeekDayListForFood(menu as never);

    expect(update).not.toHaveBeenCalled();
  });
});
