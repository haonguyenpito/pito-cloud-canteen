import { createSlice } from '@reduxjs/toolkit';
import omit from 'lodash/omit';

import {
  adminToggleUserDisabledApi,
  createDraftPartnerApi,
  deletePartnerApi,
  publishDraftPartnerApi,
  queryRestaurantListingsApi,
  showRestaurantApi,
  updateRestaurantApi,
  updateRestaurantStatusApi,
} from '@apis/index';
import { createAsyncThunk } from '@redux/redux.helper';
import { denormalisedResponseEntities } from '@utils/data';
import { EImageVariants, EListingStates, EListingType } from '@utils/enums';
import { storableError } from '@utils/errors';
import type { TObject, TPagination } from '@utils/types';

export const MANAGE_PARTNER_RESULT_PAGE_SIZE = 10;

type TPartnerStates = {
  // Manage partners page slice
  restaurantRefs: any[];
  queryRestaurantsInProgress: boolean;
  queryRestaurantsError: any;
  pagination: TPagination;
  restaurantTableActionInProgress: any;
  restaurantTableActionError: any;

  deletePartnerInProgress: any;
  deletePartnerError: any;

  // Holds the restaurantId of the row whose lock is being toggled.
  togglePartnerDisabledInProgress: any;
  togglePartnerDisabledError: any;

  // Create or edit partner slice
  createDraftPartnerInProgress: boolean;
  createDraftPartnerError: any;

  updatePartnerListingInProgress: boolean;
  updatePartnerListingError: any;

  uploadedAvatars: any;
  uploadedAvatarsOrder: any[];
  removedAvatarIds: any[];
  uploadAvatarError: any;
  uploadingAvatars: boolean;

  uploadedCovers: any;
  uploadedCoversOrder: any[];
  removedCoverIds: any[];
  uploadCoverError: any;
  uploadingCovers: boolean;

  showPartnerListingInProgress: boolean;
  showPartnerListingError: any;

  partnerListingRef: null;

  uploadedBusinessLicense: any;
  uploadedBusinessLicensesOrder: any[];
  removedBusinessLicenseIds: any[];
  uploadBusinessLicenseError: any;
  uploadingBusinessLicenses: boolean;

  uploadedFoodCertificate: any;
  uploadedFoodCertificatesOrder: any[];
  removedFoodCertificateIds: any[];
  uploadFoodCertificateError: any;
  uploadingFoodCertificates: boolean;

  uploadedPartyInsurance: any;
  uploadedPartyInsurancesOrder: any[];
  removedPartyInsuranceIds: any[];
  uploadPartyInsuranceError: any;
  uploadingPartyInsurances: boolean;

  publishDraftPartnerInProgress: boolean;
  publishDraftPartnerError: any;

  discardDraftPartnerInProgress: boolean;
  discardDraftPartnerError: any;
};

const QUERY_RESTAURANTS = 'app/ManagePartnersPage/QUERY_RESTAURANTS';

const SET_RESTAURANT_STATUS = 'app/ManagePartnersPage/SET_RESTAURANT_STATUS';

const DELETE_RESTAURANT = 'app/ManagePartnersPage/DELETE_RESTAURANT';
const TOGGLE_PARTNER_DISABLED =
  'app/ManagePartnersPage/TOGGLE_PARTNER_DISABLED';

const REQUEST_AVATAR_UPLOAD =
  'app/CreateAndEditPartnerPage/REQUEST_AVATAR_UPLOAD';

const REQUEST_BUSINESS_LICENSE_UPLOAD =
  'app/CreateAndEditPartnerPage/REQUEST_BUSINESS_LICENSE_UPLOAD';

const REQUEST_FOOD_CERTIFICATE_UPLOAD =
  'app/CreateAndEditPartnerPage/REQUEST_FOOD_CERTIFICATE_UPLOAD';

const REQUEST_PARTY_INSURANCE_UPLOAD =
  'app/CreateAndEditPartnerPage/REQUEST_PARTY_INSURANCE_UPLOAD';

const REQUEST_COVER_UPLOAD =
  'app/CreateAndEditPartnerPage/REQUEST_COVER_UPLOAD';

const CREATE_DRAFT_PARTNER =
  'app/CreateAndEditPartnerPage/CREATE_DRAFT_PARTNER';

const SHOW_PARTNER_RESTAURANT_LISTING =
  'app/CreateAndEditPartnerPage/SHOW_PARTNER_RESTAURANT_LISTING';

const UPDATE_PARTNER_RESTAURANT_LISTING =
  'app/CreateAndEditPartnerPage/UPDATE_PARTNER_RESTAURANT_LISTING';

const PUBLISH_PARTNER = 'app/CreateAndEditPartnerPage/PUBLISH_PARTNER';
const DISCARD_DRAFT_PARTNER =
  'app/CreateAndEditPartnerPage/DISCARD_DRAFT_PARTNER';

const SHOW_RESTAURANT_LISTING_PARAMS = {
  include: ['author', 'author.profileImage', 'images'],
  'fields.image': [
    // Listing page
    'variants.landscape-crop',
    'variants.landscape-crop2x',
    'variants.landscape-crop4x',
    'variants.landscape-crop6x',

    // Social media
    'variants.facebook',
    'variants.twitter',

    // Image carousel
    'variants.scaled-small',
    'variants.scaled-medium',
    'variants.scaled-large',
    'variants.scaled-xlarge',

    // Avatars
    'variants.square-small',
    'variants.square-small2x',
  ],
};

const requestAvatarUpload = createAsyncThunk(
  REQUEST_AVATAR_UPLOAD,
  async (
    payload: TObject,
    { extra: sdk, fulfillWithValue, rejectWithValue },
  ) => {
    const { file, id } = payload || {};
    try {
      const response = await sdk.images.upload(
        { image: file },
        {
          expand: true,
          'fields.image': ['variants.square-small', 'variants.square-small2x'],
        },
      );
      const img = response.data.data;

      return fulfillWithValue({ ...img, id, imageId: img.id });
    } catch (error) {
      console.error('error', error);

      return rejectWithValue({ id, error: storableError(error) });
    }
  },
);

const requestCoverUpload = createAsyncThunk(
  REQUEST_COVER_UPLOAD,
  async (
    payload: TObject,
    { extra: sdk, fulfillWithValue, rejectWithValue },
  ) => {
    const { file, id } = payload || {};
    try {
      const response = await sdk.images.upload(
        { image: file },
        {
          expand: true,
          'fields.image': [
            `variants.${EImageVariants.scaledLarge}`,
            `variants.${EImageVariants.landscapeCrop2x}`,
            `variants.${EImageVariants.scaledMedium}`,
            `variants.${EImageVariants.scaledXLarge}`,
          ],
        },
      );
      const img = response.data.data;

      return fulfillWithValue({ ...img, id, imageId: img.id });
    } catch (error) {
      console.error(error);

      return rejectWithValue({ id, error: storableError(error) });
    }
  },
);

const requestBusinessLicenseUpload = createAsyncThunk(
  REQUEST_BUSINESS_LICENSE_UPLOAD,
  async (payload: any, { extra: sdk, fulfillWithValue, rejectWithValue }) => {
    const { file, id } = payload || {};
    try {
      const response = await sdk.images.upload(
        { image: file },
        {
          expand: true,
          'fields.image': [
            `variants.${EImageVariants.scaledLarge}`,
            `variants.${EImageVariants.scaledMedium}`,
            `variants.${EImageVariants.scaledXLarge}`,
          ],
        },
      );
      const img = response.data.data;

      return fulfillWithValue({ ...img, id, imageId: img.id });
    } catch (error) {
      console.error('error', error);

      return rejectWithValue({ id, error: storableError(error) });
    }
  },
);

const requestFoodCertificateUpload = createAsyncThunk(
  REQUEST_FOOD_CERTIFICATE_UPLOAD,
  async (payload: any, { extra: sdk, fulfillWithValue, rejectWithValue }) => {
    const { file, id } = payload || {};
    try {
      const response = await sdk.images.upload(
        { image: file },
        {
          expand: true,
          'fields.image': [
            `variants.${EImageVariants.scaledLarge}`,
            `variants.${EImageVariants.scaledMedium}`,
            `variants.${EImageVariants.scaledXLarge}`,
          ],
        },
      );
      const img = response.data.data;

      return fulfillWithValue({ ...img, id, imageId: img.id });
    } catch (error) {
      console.error('error', error);

      return rejectWithValue({ id, error: storableError(error) });
    }
  },
);

const requestPartyInsuranceUpload = createAsyncThunk(
  REQUEST_PARTY_INSURANCE_UPLOAD,
  async (payload: any, { extra: sdk, fulfillWithValue, rejectWithValue }) => {
    const { file, id } = payload || {};
    try {
      const response = await sdk.images.upload(
        { image: file },
        {
          expand: true,
          'fields.image': [
            `variants.${EImageVariants.scaledLarge}`,
            `variants.${EImageVariants.scaledMedium}`,
            `variants.${EImageVariants.scaledXLarge}`,
          ],
        },
      );
      const img = response.data.data;

      return fulfillWithValue({ ...img, id, imageId: img.id });
    } catch (error) {
      console.error('error', error);

      return rejectWithValue({ id, error: storableError(error) });
    }
  },
);

const publishDraftPartner = createAsyncThunk(
  PUBLISH_PARTNER,
  async (values: any, { fulfillWithValue, rejectWithValue }) => {
    try {
      const { data } = await publishDraftPartnerApi(values);
      const { user, listing } = data;
      const [partner] = denormalisedResponseEntities(user);
      const [restaurant] = denormalisedResponseEntities(listing);

      return fulfillWithValue({ restaurant, partner });
    } catch (error) {
      console.error('error', error);

      return rejectWithValue(storableError(error));
    }
  },
);

const discardDraftPartner = createAsyncThunk(
  DISCARD_DRAFT_PARTNER,
  async (values: any, { fulfillWithValue, rejectWithValue }) => {
    try {
      const { data } = await deletePartnerApi(values);
      const { user, listing } = data;
      const [partner] = denormalisedResponseEntities(user);
      const [restaurant] = denormalisedResponseEntities(listing);

      return fulfillWithValue({ restaurant, partner });
    } catch (error) {
      console.error('error', error);

      return rejectWithValue(storableError(error));
    }
  },
);

const createDraftPartner = createAsyncThunk(
  CREATE_DRAFT_PARTNER,
  async (values: TObject, { fulfillWithValue, rejectWithValue }) => {
    try {
      const { userData, listingData } = values;
      const submitValues = {
        userParams: {
          userDataParams: userData,
          userQueryParams: {
            expand: true,
          },
        },
        listingParams: {
          listingDataParams: listingData,
          listingQueryParams: {
            ...SHOW_RESTAURANT_LISTING_PARAMS,
            expand: true,
          },
        },
      };
      const { data } = await createDraftPartnerApi(submitValues);
      const { listing: listingRes, user: userRes } = data;
      const [listing] = denormalisedResponseEntities(listingRes);
      const [user] = denormalisedResponseEntities(userRes);

      return fulfillWithValue({ listing, user });
    } catch (error: any) {
      console.error(error);

      return rejectWithValue(storableError(error.response.data));
    }
  },
);

const showPartnerRestaurantListing = createAsyncThunk(
  SHOW_PARTNER_RESTAURANT_LISTING,
  async (id: any, { fulfillWithValue, rejectWithValue }) => {
    try {
      const { data } = await showRestaurantApi({
        id,
        dataParams: {
          ...SHOW_RESTAURANT_LISTING_PARAMS,
        },
        queryParams: {
          expand: true,
        },
      });
      const [partner] = denormalisedResponseEntities(data);

      return fulfillWithValue(partner);
    } catch (error) {
      console.error(error);

      return rejectWithValue(storableError(error));
    }
  },
);

const updatePartnerRestaurantListing = createAsyncThunk(
  UPDATE_PARTNER_RESTAURANT_LISTING,
  async (values: any, { fulfillWithValue, rejectWithValue }) => {
    try {
      const { data } = await updateRestaurantApi({
        dataParams: values,
        queryParams: {
          ...SHOW_RESTAURANT_LISTING_PARAMS,
          expand: true,
        },
      });
      const [restaurant] = denormalisedResponseEntities(data);

      return fulfillWithValue(restaurant);
    } catch (error) {
      console.error(error);

      return rejectWithValue(storableError(error));
    }
  },
);

const setRestaurantStatus = createAsyncThunk(
  SET_RESTAURANT_STATUS,
  async (params: any, { fulfillWithValue, rejectWithValue }) => {
    try {
      const { data } = await updateRestaurantStatusApi({
        dataParams: params,
        queryParams: {
          ...SHOW_RESTAURANT_LISTING_PARAMS,
          expand: true,
        },
      });
      const [restaurant] = denormalisedResponseEntities(data);

      return fulfillWithValue(restaurant);
    } catch (error: any) {
      console.error('Query company error : ', error);

      return rejectWithValue(storableError(error.response.data));
    }
  },
);

const deleteRestaurant = createAsyncThunk(
  DELETE_RESTAURANT,
  async (params: any, { fulfillWithValue, rejectWithValue }) => {
    try {
      const { partnerId: id } = params;
      const { data } = await deletePartnerApi({ id });

      return fulfillWithValue(data);
    } catch (error) {
      console.error('error', error);

      return rejectWithValue(storableError(error));
    }
  },
);

type TTogglePartnerDisabledParams = {
  partnerId: string;
  // `restaurantId` labels the in-flight row for the spinner; not sent to the API.
  restaurantId: string;
  isDisabled: boolean;
};

const togglePartnerDisabled = createAsyncThunk(
  TOGGLE_PARTNER_DISABLED,
  async (
    { partnerId, isDisabled }: TTogglePartnerDisabledParams,
    { fulfillWithValue, rejectWithValue },
  ) => {
    try {
      const { data } = await adminToggleUserDisabledApi(partnerId, isDisabled);

      return fulfillWithValue(data);
    } catch (error) {
      console.error('Toggle partner disabled error : ', error);

      return rejectWithValue(
        storableError(
          (error as { response?: { data?: unknown } })?.response?.data || error,
        ),
      );
    }
  },
);

const queryRestaurants = createAsyncThunk(
  QUERY_RESTAURANTS,
  async (params: any, { fulfillWithValue, rejectWithValue }) => {
    try {
      const dataParams = {
        ...params,
        meta_listingState: [EListingStates.draft, EListingStates.published],
        meta_listingType: EListingType.restaurant,
        meta_isDeleted: false,
        perPage: MANAGE_PARTNER_RESULT_PAGE_SIZE,
        include: ['author'],
        'fields.listing': [
          'title',
          'geolocation',
          'price',
          'publicData',
          'metadata',
        ],
      };
      const { data } = await queryRestaurantListingsApi({
        dataParams,
        queryParams: { expand: true },
      });
      const restaurantRefs = denormalisedResponseEntities(data);

      return fulfillWithValue({ restaurantRefs, response: data });
    } catch (error: any) {
      console.error('Query company error : ', error);

      return rejectWithValue(storableError(error.response.data));
    }
  },
);

export const partnerThunks = {
  requestAvatarUpload,
  createDraftPartner,
  requestCoverUpload,
  showPartnerRestaurantListing,
  updatePartnerRestaurantListing,
  requestBusinessLicenseUpload,
  requestFoodCertificateUpload,
  requestPartyInsuranceUpload,
  publishDraftPartner,
  discardDraftPartner,
  queryRestaurants,
  setRestaurantStatus,
  deleteRestaurant,
  togglePartnerDisabled,
};

const initialState: TPartnerStates = {
  restaurantRefs: [],
  queryRestaurantsInProgress: false,
  queryRestaurantsError: null,
  pagination: {
    totalItems: 0,
    totalPages: 0,
    page: 0,
    perPage: 0,
  },
  restaurantTableActionInProgress: null,
  restaurantTableActionError: null,

  deletePartnerInProgress: false,
  deletePartnerError: null,

  togglePartnerDisabledInProgress: null,
  togglePartnerDisabledError: null,
  // handle create partner
  createDraftPartnerInProgress: false,
  createDraftPartnerError: null,

  // update partner

  updatePartnerListingInProgress: false,
  updatePartnerListingError: null,

  // Show partner
  partnerListingRef: null,
  showPartnerListingInProgress: false,
  showPartnerListingError: null,

  // Handle upload image
  uploadedAvatars: {},
  uploadedAvatarsOrder: [],
  removedAvatarIds: [],
  uploadAvatarError: null,
  uploadingAvatars: false,

  uploadedCovers: {},
  uploadedCoversOrder: [],
  removedCoverIds: [],
  uploadCoverError: null,
  uploadingCovers: false,

  uploadedBusinessLicense: {},
  uploadedBusinessLicensesOrder: [],
  removedBusinessLicenseIds: [],
  uploadBusinessLicenseError: null,
  uploadingBusinessLicenses: false,

  uploadedFoodCertificate: {},
  uploadedFoodCertificatesOrder: [],
  removedFoodCertificateIds: [],
  uploadFoodCertificateError: null,
  uploadingFoodCertificates: false,

  uploadedPartyInsurance: {},
  uploadedPartyInsurancesOrder: [],
  removedPartyInsuranceIds: [],
  uploadPartyInsuranceError: null,
  uploadingPartyInsurances: false,

  publishDraftPartnerInProgress: false,
  publishDraftPartnerError: null,

  discardDraftPartnerInProgress: false,
  discardDraftPartnerError: null,
};

export const partnerSlice = createSlice({
  name: 'partners',
  initialState,
  reducers: {
    resetInitialStates: () => {
      return { ...initialState };
    },
    removeAvatar: (state: any, { payload }) => {
      const id = payload;
      // Only mark the image removed if it hasn't been added to the
      // listing already
      const removedAvatarIds = state.uploadedAvatars[id]
        ? state.removedAvatarIds
        : state.removedAvatarIds.concat(id);

      // Always remove from the draft since it might be a new image to
      // an existing listing.
      const uploadedAvatars = omit(state.uploadedAvatars, id);
      const uploadedAvatarsOrder = state.uploadedAvatarsOrder.filter(
        (i: any) => i !== id,
      );

      return {
        ...state,
        uploadedAvatars,
        uploadedAvatarsOrder,
        removedAvatarIds,
      };
    },
    removeCover: (state: any, { payload }) => {
      const id = payload;
      // Only mark the image removed if it hasn't been added to the
      // listing already

      const removedCoverIds = state.uploadedCovers[id]
        ? state.removedCoverIds
        : state.removedCoverIds.concat(id);

      // Always remove from the draft since it might be a new image to
      // an existing listing.
      const uploadedCovers = omit(state.uploadedCovers, id);
      const uploadedCoversOrder = state.uploadedCoversOrder.filter(
        (i: any) => i !== id,
      );

      return {
        ...state,
        uploadedCovers,
        uploadedCoversOrder,
        removedCoverIds,
      };
    },
    removeBusinessLicense: (state: any, { payload }) => {
      const id = payload;
      // Only mark the image removed if it hasn't been added to the
      // listing already

      const removedBusinessLicenseIds = state.uploadedBusinessLicense[id]
        ? state.removedBusinessLicenseIds
        : state.removedBusinessLicenseIds.concat(id);

      // Always remove from the draft since it might be a new image to
      // an existing listing.
      const uploadedBusinessLicense = omit(state.uploadedBusinessLicense, id);
      const uploadedBusinessLicensesOrder =
        state.uploadedBusinessLicensesOrder.filter((i: any) => i !== id);

      return {
        ...state,
        uploadedBusinessLicense,
        uploadedBusinessLicensesOrder,
        removedBusinessLicenseIds,
      };
    },
    removeFoodCertificate: (state: any, { payload }) => {
      const id = payload;
      // Only mark the image removed if it hasn't been added to the
      // listing already

      const removedFoodCertificateIds = state.uploadedFoodCertificate[id]
        ? state.removedFoodCertificateIds
        : state.removedFoodCertificateIds.concat(id);

      // Always remove from the draft since it might be a new image to
      // an existing listing.
      const uploadedFoodCertificate = omit(state.uploadedFoodCertificate, id);
      const uploadedFoodCertificatesOrder =
        state.uploadedFoodCertificatesOrder.filter((i: any) => i !== id);

      return {
        ...state,
        uploadedFoodCertificate,
        uploadedFoodCertificatesOrder,
        removedFoodCertificateIds,
      };
    },
    removePartyInsurance: (state: any, { payload }) => {
      const id = payload;
      // Only mark the image removed if it hasn't been added to the
      // listing already

      const removedPartyInsuranceIds = state.uploadedPartyInsurance[id]
        ? state.removedPartyInsuranceIds
        : state.removedPartyInsuranceIds.concat(id);

      // Always remove from the draft since it might be a new image to
      // an existing listing.
      const uploadedPartyInsurance = omit(state.uploadedPartyInsurance, id);
      const uploadedPartyInsurancesOrder =
        state.uploadedPartyInsurancesOrder.filter((i: any) => i !== id);

      return {
        ...state,
        uploadedPartyInsurance,
        uploadedPartyInsurancesOrder,
        removedPartyInsuranceIds,
      };
    },
    clearDeletePartnerError: (state) => {
      state.deletePartnerError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(queryRestaurants.pending, (state) => ({
        ...state,
        queryRestaurantsError: null,
        queryRestaurantsInProgress: true,
      }))
      .addCase(queryRestaurants.fulfilled, (state, action) => {
        const { restaurantRefs, response } = action.payload || {};

        return {
          ...state,
          restaurantRefs,
          queryRestaurantsInProgress: false,
          pagination: response.data.meta,
        };
      })
      .addCase(queryRestaurants.rejected, (state, action) => ({
        ...state,
        queryRestaurantsError: action.payload,
        queryRestaurantsInProgress: false,
      }))
      .addCase(setRestaurantStatus.pending, (state, action) => {
        return {
          ...state,
          restaurantTableActionInProgress: action.meta.arg.id,
          restaurantTableActionError: null,
        };
      })
      .addCase(setRestaurantStatus.fulfilled, (state, action) => ({
        ...state,
        partnerListingRef: action.payload,
        restaurantTableActionInProgress: null,
      }))
      .addCase(setRestaurantStatus.rejected, (state, action) => ({
        ...state,
        restaurantTableActionInProgress: null,
        restaurantTableActionError: action.payload,
      }))
      .addCase(deleteRestaurant.pending, (state, action) => {
        return {
          ...state,
          deletePartnerInProgress: action.meta.arg.restaurantId,
          deletePartnerError: null,
        };
      })
      .addCase(deleteRestaurant.fulfilled, (state) => ({
        ...state,
        deletePartnerInProgress: null,
      }))
      .addCase(deleteRestaurant.rejected, (state, action) => ({
        ...state,
        deletePartnerInProgress: null,
        deletePartnerError: action.payload,
      }))
      .addCase(togglePartnerDisabled.pending, (state, action) => ({
        ...state,
        togglePartnerDisabledInProgress: action.meta.arg.restaurantId,
        togglePartnerDisabledError: null,
      }))
      .addCase(togglePartnerDisabled.fulfilled, (state) => ({
        ...state,
        togglePartnerDisabledInProgress: null,
      }))
      .addCase(togglePartnerDisabled.rejected, (state, action) => ({
        ...state,
        togglePartnerDisabledInProgress: null,
        togglePartnerDisabledError: action.payload,
      }))
      .addCase(requestAvatarUpload.pending, (state, action) => {
        const { id } = action.meta.arg;

        const uploadedAvatars = {
          ...state.uploadedAvatars,
          [id]: { ...action.meta.arg },
        };

        return {
          ...state,
          uploadedAvatars,
          uploadedAvatarsOrder: state.uploadedAvatarsOrder.concat([id]),
          uploadAvatarError: null,
          uploadingAvatars: true,
        };
      })
      .addCase(requestAvatarUpload.fulfilled, (state, action) => {
        const { id, ...rest } = action.payload;
        const uploadedAvatars = {
          ...state.uploadedAvatars,
          [id]: { id, ...rest },
        };

        return { ...state, uploadedAvatars, uploadingAvatars: false };
      })
      .addCase(requestAvatarUpload.rejected, (state, action: any) => {
        const { id, error } = action.payload;
        const uploadedAvatarsOrder = state.uploadedAvatarsOrder.filter(
          (i: any) => i !== id,
        );
        const uploadedAvatars = omit(state.uploadedAvatars, id);

        return {
          ...state,
          uploadedAvatarsOrder,
          uploadedAvatars,
          uploadAvatarError: error,
          uploadingAvatars: false,
        };
      })
      .addCase(requestCoverUpload.pending, (state, action) => {
        // payload.params: { id: 'tempId', file }
        const { id } = action.meta.arg;

        const uploadedCovers = {
          ...state.uploadedCovers,
          [id]: { ...action.meta.arg },
        };

        return {
          ...state,
          uploadedCovers,
          uploadedCoversOrder: state.uploadedCoversOrder.concat([id]),
          uploadCoverError: null,
          uploadingCovers: true,
        };
      })
      .addCase(requestCoverUpload.fulfilled, (state, action) => {
        // payload.params: { id: 'tempId', imageId: 'some-real-id', attributes, type }
        const { id, ...rest } = action.payload;
        const uploadedCovers = {
          ...state.uploadedCovers,
          [id]: { id, ...rest },
        };

        return { ...state, uploadedCovers, uploadingCovers: false };
      })
      .addCase(requestCoverUpload.rejected, (state, action: any) => {
        const { id, error } = action.payload;
        const uploadedCoversOrder = state.uploadedCoversOrder.filter(
          (i: any) => i !== id,
        );
        const uploadedCovers = omit(state.uploadedCovers, id);

        return {
          ...state,
          uploadedCoversOrder,
          uploadedCovers,
          uploadCoverError: error,
          uploadingCovers: false,
        };
      })
      .addCase(createDraftPartner.pending, (state) => {
        return {
          ...state,
          createDraftPartnerInProgress: true,
          createDraftPartnerError: null,
        };
      })
      .addCase(createDraftPartner.fulfilled, (state, action) => {
        return {
          ...state,
          createDraftPartnerInProgress: false,
          partnerListingRef: action.payload.listing,
        };
      })
      .addCase(createDraftPartner.rejected, (state, action) => {
        return {
          ...state,
          createDraftPartnerInProgress: false,
          createDraftPartnerError: action.payload,
        };
      })
      .addCase(showPartnerRestaurantListing.pending, (state) => {
        return {
          ...state,
          showPartnerListingInProgress: true,
          showPartnerListingError: null,
        };
      })
      .addCase(showPartnerRestaurantListing.fulfilled, (state, action) => {
        return {
          ...state,
          showPartnerListingInProgress: false,
          partnerListingRef: action.payload,
        };
      })
      .addCase(showPartnerRestaurantListing.rejected, (state, action) => {
        return {
          ...state,
          showPartnerListingInProgress: false,
          showPartnerListingError: action.payload,
        };
      })
      .addCase(updatePartnerRestaurantListing.pending, (state) => {
        return {
          ...state,
          updatePartnerListingInProgress: true,
          updatePartnerListingError: null,
        };
      })
      .addCase(updatePartnerRestaurantListing.fulfilled, (state, action) => {
        return {
          ...state,
          updatePartnerListingInProgress: false,
          partnerListingRef: action.payload,
        };
      })
      .addCase(updatePartnerRestaurantListing.rejected, (state, action) => {
        return {
          ...state,
          updatePartnerListingInProgress: false,
          updatePartnerListingError: action.payload,
        };
      })
      .addCase(requestBusinessLicenseUpload.pending, (state, action) => {
        // payload.params: { id: 'tempId', file }
        const { id } = action.meta.arg;

        const uploadedBusinessLicense = {
          ...state.uploadedBusinessLicense,
          [id]: { ...action.meta.arg },
        };

        return {
          ...state,
          uploadedBusinessLicense,
          uploadedBusinessLicensesOrder:
            state.uploadedBusinessLicensesOrder.concat([id]),
          uploadBusinessLicenseError: null,
          uploadingBusinessLicenses: true,
        };
      })
      .addCase(requestBusinessLicenseUpload.fulfilled, (state, action) => {
        // payload.params: { id: 'tempId', imageId: 'some-real-id', attributes, type }
        const { id, ...rest } = action.payload;
        const uploadedBusinessLicense = {
          ...state.uploadedBusinessLicense,
          [id]: { id, ...rest },
        };

        return {
          ...state,
          uploadedBusinessLicense,
          uploadingBusinessLicenses: false,
        };
      })
      .addCase(requestBusinessLicenseUpload.rejected, (state, action: any) => {
        const { id, error } = action.payload;
        const uploadedBusinessLicensesOrder =
          state.uploadedBusinessLicensesOrder.filter((i: any) => i !== id);
        const uploadedBusinessLicense = omit(state.uploadedBusinessLicense, id);

        return {
          ...state,
          uploadedBusinessLicensesOrder,
          uploadedBusinessLicense,
          uploadBusinessLicenseError: error,
          uploadingBusinessLicenses: false,
        };
      })
      .addCase(requestFoodCertificateUpload.pending, (state, action) => {
        // payload.params: { id: 'tempId', file }
        const { id } = action.meta.arg;

        const uploadedFoodCertificate = {
          ...state.uploadedFoodCertificate,
          [id]: { ...action.meta.arg },
        };

        return {
          ...state,
          uploadedFoodCertificate,
          uploadedFoodCertificatesOrder:
            state.uploadedFoodCertificatesOrder.concat([id]),
          uploadFoodCertificateError: null,
          uploadingFoodCertificates: true,
        };
      })
      .addCase(requestFoodCertificateUpload.fulfilled, (state, action) => {
        // payload.params: { id: 'tempId', imageId: 'some-real-id', attributes, type }
        const { id, ...rest } = action.payload;
        const uploadedFoodCertificate = {
          ...state.uploadedFoodCertificate,
          [id]: { id, ...rest },
        };

        return {
          ...state,
          uploadedFoodCertificate,
          uploadingFoodCertificates: false,
        };
      })
      .addCase(requestFoodCertificateUpload.rejected, (state, action: any) => {
        const { id, error } = action.payload;
        const uploadedFoodCertificatesOrder =
          state.uploadedFoodCertificatesOrder.filter((i: any) => i !== id);
        const uploadedFoodCertificate = omit(state.uploadedFoodCertificate, id);

        return {
          ...state,
          uploadedFoodCertificatesOrder,
          uploadedFoodCertificate,
          uploadFoodCertificateError: error,
          uploadingFoodCertificates: false,
        };
      })
      .addCase(requestPartyInsuranceUpload.pending, (state, action) => {
        // payload.params: { id: 'tempId', file }
        const { id } = action.meta.arg;

        const uploadedPartyInsurance = {
          ...state.uploadedPartyInsurance,
          [id]: { ...action.meta.arg },
        };

        return {
          ...state,
          uploadedPartyInsurance,
          uploadedPartyInsurancesOrder:
            state.uploadedPartyInsurancesOrder.concat([id]),
          uploadPartyInsuranceError: null,
          uploadingPartyInsurances: true,
        };
      })
      .addCase(requestPartyInsuranceUpload.fulfilled, (state, action) => {
        // payload.params: { id: 'tempId', imageId: 'some-real-id', attributes, type }
        const { id, ...rest } = action.payload;
        const uploadedPartyInsurance = {
          ...state.uploadedPartyInsurance,
          [id]: { id, ...rest },
        };

        return {
          ...state,
          uploadedPartyInsurance,
          uploadingPartyInsurances: false,
        };
      })
      .addCase(requestPartyInsuranceUpload.rejected, (state, action: any) => {
        const { id, error } = action.payload;
        const uploadedPartyInsurancesOrder =
          state.uploadedPartyInsurancesOrder.filter((i: any) => i !== id);
        const uploadedPartyInsurance = omit(state.uploadedPartyInsurance, id);

        return {
          ...state,
          uploadedPartyInsurancesOrder,
          uploadedPartyInsurance,
          uploadPartyInsuranceError: error,
          uploadingPartyInsurances: false,
        };
      })
      .addCase(publishDraftPartner.pending, (state) => {
        return {
          ...state,
          publishDraftPartnerInProgress: true,
          publishDraftError: null,
        };
      })
      .addCase(publishDraftPartner.fulfilled, (state) => {
        return {
          ...state,
          publishDraftPartnerInProgress: false,
        };
      })
      .addCase(publishDraftPartner.rejected, (state, action) => {
        return {
          ...state,
          publishDraftPartnerInProgress: false,
          publishDraftPartnerError: action.payload,
        };
      })
      .addCase(discardDraftPartner.pending, (state) => {
        return {
          ...state,
          discardDraftPartnerInProgress: true,
          discardDraftPartnerError: null,
        };
      })
      .addCase(discardDraftPartner.fulfilled, (state) => {
        return {
          ...state,
          discardDraftPartnerInProgress: false,
        };
      })
      .addCase(discardDraftPartner.rejected, (state, action) => {
        return {
          ...state,
          discardDraftPartnerInProgress: false,
          discardDraftPartnerError: action.payload,
        };
      });
  },
});

export const {
  removeAvatar,
  removeCover,
  removeBusinessLicense,
  removeFoodCertificate,
  removePartyInsurance,
  resetInitialStates,
  clearDeletePartnerError,
} = partnerSlice.actions;

export default partnerSlice.reducer;
