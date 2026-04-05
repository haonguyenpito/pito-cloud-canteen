// Auto-mock for sharetribe-flex-integration-sdk.
// integrationSdk.ts calls createInstance() at module load time, which throws
// "clientId must be provided" when FLEX_INTEGRATION_CLIENT_ID is not set.
// This mock prevents that error in all test files.

const noop = () => Promise.resolve({ data: { data: {} } });
const noopList = () => Promise.resolve({ data: { data: [] } });

module.exports = {
  createInstance: () => ({
    listings: { show: noop, query: noopList },
    users: { show: noop, updateProfile: noop },
    transactions: { show: noop, query: noopList, updateMetadata: noop },
  }),
};
