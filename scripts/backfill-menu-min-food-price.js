#!/usr/bin/env node
/**
 * One-off backfill for review item 12 (docs/plans/ra-soat-phu-phi-thuc-don.md).
 *
 * `<day>MinFoodPrice` on a menu is now fee-inclusive: it feeds the restaurant
 * search budget filter (`pub_<day>MinFoodPrice <= packagePerMember`), and the
 * package is fee-inclusive. Menus saved before that change still store the
 * base-price minimum. This recomputes it for every menu that has extra fees.
 *
 * Mirrors `getMinBillablePrice` in src/helpers/menuExtraFee.ts — keep in sync.
 * Prices come from the food listings, exactly like `updateMenuExtraFees`.
 * A day whose dishes cannot be resolved is left untouched.
 *
 * Usage (dry run by default — prints the changes, writes nothing):
 *   node scripts/backfill-menu-min-food-price.js --env=.env.local
 *   node scripts/backfill-menu-min-food-price.js --env=.env.production --apply
 *
 * Needs FLEX_INTEGRATION_CLIENT_ID / FLEX_INTEGRATION_CLIENT_SECRET.
 */
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** 0 is a valid fee; junk and negative values are dropped. */
const sanitizeExtraFeeMap = (foodExtraFees) =>
  Object.entries(foodExtraFees || {}).reduce((result, [foodId, rawFee]) => {
    const fee = Number(rawFee);

    return Number.isFinite(fee) && fee >= 0
      ? { ...result, [foodId]: fee }
      : result;
  }, {});

const getMinBillablePrice = (foods, extraFeeByFoodId = {}) =>
  foods.reduce((min, { foodId, price = 0 }, index) => {
    const billable =
      (Number(price) || 0) + (Number(extraFeeByFoodId[foodId]) || 0);

    return index === 0 ? billable : Math.min(min, billable);
  }, 0);

/**
 * The `<day>MinFoodPrice` values that differ from what the menu stores.
 * Pure: `priceByFoodId` holds the base price of every resolvable dish.
 */
const computeMinFoodPriceChanges = ({
  publicData,
  metadata,
  priceByFoodId,
}) => {
  const extraFees = sanitizeExtraFeeMap(publicData.foodExtraFees);

  return DAY_KEYS.reduce((changes, day) => {
    const dayFoods = (metadata[`${day}FoodIdList`] || [])
      .filter((foodId) => foodId in priceByFoodId)
      .map((foodId) => ({ foodId, price: priceByFoodId[foodId] }));

    if (dayFoods.length === 0) {
      return changes;
    }

    const next = getMinBillablePrice(dayFoods, extraFees);
    const key = `${day}MinFoodPrice`;

    return publicData[key] === next ? changes : { ...changes, [key]: next };
  }, {});
};

const hasExtraFees = (publicData) =>
  Object.values(sanitizeExtraFeeMap(publicData.foodExtraFees)).some(
    (fee) => fee > 0,
  );

const toEntities = (response) =>
  response.data.data.map((entity) => ({
    id: entity.id.uuid,
    attributes: entity.attributes,
  }));

const queryAllMenus = async (sdk) => {
  const menus = [];
  let page = 1;
  let totalPages = 1;

  do {
    // eslint-disable-next-line no-await-in-loop
    const response = await sdk.listings.query({
      meta_listingType: 'menu',
      perPage: 100,
      page,
    });
    menus.push(...toEntities(response));
    totalPages = response.data.meta?.totalPages || 1;
    page += 1;
  } while (page <= totalPages);

  return menus;
};

const fetchPriceByFoodId = async (sdk, foodIds) => {
  const priceByFoodId = {};

  for (let i = 0; i < foodIds.length; i += 100) {
    // eslint-disable-next-line no-await-in-loop
    const response = await sdk.listings.query({
      ids: foodIds.slice(i, i + 100),
    });
    toEntities(response).forEach(({ id, attributes }) => {
      priceByFoodId[id] = attributes.price?.amount || 0;
    });
  }

  return priceByFoodId;
};

const main = async () => {
  const args = process.argv.slice(2);
  const shouldApply = args.includes('--apply');
  const envArg = args.find((arg) => arg.startsWith('--env='));

  // eslint-disable-next-line global-require
  require('dotenv').config(envArg ? { path: envArg.slice(6) } : undefined);
  // eslint-disable-next-line global-require
  const flexIntegrationSdk = require('sharetribe-flex-integration-sdk');
  const sdk = flexIntegrationSdk.createInstance({
    clientId: process.env.FLEX_INTEGRATION_CLIENT_ID,
    clientSecret: process.env.FLEX_INTEGRATION_CLIENT_SECRET,
  });

  const menus = (await queryAllMenus(sdk)).filter(
    ({ attributes }) =>
      !attributes.metadata?.isDeleted &&
      hasExtraFees(attributes.publicData || {}),
  );
  console.log(`Menus with extra fees: ${menus.length}`);

  // Sequential on purpose: keeps the Integration API rate limit comfortable.
  const changedCount = await menus.reduce(async (countPromise, menu) => {
    const count = await countPromise;
    const publicData = menu.attributes.publicData || {};
    const metadata = menu.attributes.metadata || {};
    const foodIds = [
      ...new Set(DAY_KEYS.flatMap((day) => metadata[`${day}FoodIdList`] || [])),
    ];
    const priceByFoodId = await fetchPriceByFoodId(sdk, foodIds);
    const changes = computeMinFoodPriceChanges({
      publicData,
      metadata,
      priceByFoodId,
    });

    if (Object.keys(changes).length === 0) {
      return count;
    }

    const diff = Object.entries(changes)
      .map(([key, next]) => `${key}: ${publicData[key] ?? '∅'} → ${next}`)
      .join(', ');
    console.log(
      `${menu.id} [${metadata.listingState}] ${menu.attributes.title} — ${diff}`,
    );

    if (shouldApply) {
      await sdk.listings.update({ id: menu.id, publicData: changes });
    }

    return count + 1;
  }, Promise.resolve(0));

  console.log(
    `${changedCount} menu(s) ${
      shouldApply ? 'updated' : 'would change (dry run, nothing written)'
    }.`,
  );
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.data || error);
    process.exit(1);
  });
}

module.exports = { computeMinFoodPriceChanges, getMinBillablePrice };
