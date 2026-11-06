/* eslint-disable @typescript-eslint/no-shadow */
import { createSlice } from '@reduxjs/toolkit';
import chunk from 'lodash/chunk';
import flatten from 'lodash/flatten';
import omit from 'lodash/omit';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

import { responseApprovalRequestApi } from '@apis/admin';
import { partnerFoodApi } from '@apis/foodApi';
import { queryAllPages } from '@helpers/apiHelpers';
import { sleep } from '@helpers/index';
import { getImportDataFromCsv } from '@pages/admin/partner/[restaurantId]/settings/food/utils';
import { createAsyncThunk } from '@redux/redux.helper';
import { denormalisedResponseEntities } from '@utils/data';
import type { EFoodApprovalState } from '@utils/enums';
import { EImageVariants, EListingType } from '@utils/enums';
import { storableAxiosError, storableError } from '@utils/errors';
import type {
  TImage,
  TIntegrationListing,
  TListing,
  TObject,
  TPagination,
} from '@utils/types';

export const MANAGE_FOOD_PAGE_SIZE = 10;

// ================ Initial states ================ //
type TFoodSliceState = {
  foods: any[];
  queryFoodsInProgress: boolean;
  queryFoodsError: any;
  managePartnerFoodPagination: TPagination | null;

  uploadedImages: any;
  uploadedImagesOrder: any[];
  removedImageIds: any[];
  uploadImageError: any;
  uploadingImages: boolean;

  createFoodInProgress: boolean;
  createFoodError: any;

  showFoodInProgress: boolean;
  showFoodError: any;

  currentFoodListing: TListing | null;

  updateFoodInProgress: boolean;
  updateFoodError: any;

  removeFoodInProgress: boolean;
  removeFoodError: any;

  createPartnerFoodFromCsvInProgress: boolean;
  createPartnerFoodFromCsvError: any;

  menuPickedFoods: TIntegrationListing[];
  queryMenuPickedFoodsInProgress: boolean;
  queryMenuPickedFoodsError: any;

  publishOrCloseFoodId: string | null;
  publishOrCloseFoodIdError: any;
  responseApprovalRequestInProgress: boolean;
  responseApprovalRequestError: any;

  fetchFoodDetailInProgress: boolean;
  fetchFoodDetailError: any;
  foodDetail: TListing | null;
};

const initialState: TFoodSliceState = {
  foods: [],
  queryFoodsError: null,
  queryFoodsInProgress: false,
  managePartnerFoodPagination: null,

  // Upload food's images
  uploadedImages: null,
  uploadedImagesOrder: [],
  removedImageIds: [],
  uploadImageError: null,
  uploadingImages: false,

  // Create food listing
  createFoodInProgress: false,
  createFoodError: null,

  // show food listing
  showFoodInProgress: false,
  showFoodError: null,
  currentFoodListing: null,

  // update food listing
  updateFoodInProgress: false,
  updateFoodError: null,

  // remove food
  removeFoodInProgress: false,
  removeFoodError: null,

  createPartnerFoodFromCsvInProgress: false,
  createPartnerFoodFromCsvError: null,

  // query food for menu picked food
  menuPickedFoods: [],
  queryMenuPickedFoodsInProgress: false,
  queryMenuPickedFoodsError: null,

  // active food
  publishOrCloseFoodId: null,
  publishOrCloseFoodIdError: null,
  responseApprovalRequestInProgress: false,
  responseApprovalRequestError: null,

  // fetch food detail
  fetchFoodDetailInProgress: false,
  fetchFoodDetailError: null,
  foodDetail: null,
};

// ================ Thunk types ================ //
const QUERY_PARTNER_FOODS = 'app/ManageFoodsPage/QUERY_PARTNER_FOODS';
const REQUEST_UPLOAD_IMAGE_FOOD =
  'app/ManageFoodsPage/REQUEST_UPLOAD_IMAGE_FOOD';

const CREATE_PARTNER_FOOD_LISTING =
  'app/ManageFoodsPage/CREATE_PARTNER_FOOD_LISTING';
const UPDATE_PARTNER_FOOD_LISTING =
  'app/ManageFoodsPage/UPDATE_PARTNER_FOOD_LISTING';

const UPDATE_PARTNER_FOOD_PRICES =
  'app/ManageFoodsPage/UPDATE_PARTNER_FOOD_PRICES';

const SHOW_PARTNER_FOOD_LISTING =
  'app/ManageFoodsPage/SHOW_PARTNER_FOOD_LISTING';
const REMOVE_PARTNER_FOOD_LISTING =
  'app/ManageFoodsPage/REMOVE_PARTNER_FOOD_LISTING';

const SHOW_DUPLICATE_FOOD = 'app/ManageFoodsPage/SHOW_DUPLICATE_FOOD';
const FETCH_FOOD_DETAIL = 'app/ManageFoodsPage/FETCH_FOOD_DETAIL';
const DUPLICATE_FOOD = 'app/ManageFoodsPage/DUPLICATE_FOOD';

const CREATE_FOOD_FROM_FILE = 'app/ManageFoodsPage/CREATE_FOOD_FROM_FILE';

const QUERY_MENU_PICKED_FOODS = 'app/ManageFoodsPage/QUERY_MENU_PICKED_FOODS';

const PUBLISH_OR_CLOSE_FOOD = 'app/ManageFoodsPage/PUBLISH_OR_CLOSE_FOOD';

const RESPONSE_APPROVAL_REQUEST =
  'app/ManageFoodsPage/RESPONSE_APPROVAL_REQUEST';
// ================ Async thunks ================ //

const queryMenuPickedFoods = createAsyncThunk(
  QUERY_MENU_PICKED_FOODS,
  async (payload: any, { extra: sdk }) => {
    const { restaurantId, ids } = payload;
    const response = await Promise.all(
      chunk(ids, 100).map(async (_ids) =>
        queryAllPages({
          sdkModel: sdk.listings,
          query: {
            ids: _ids,
            meta_listingType: EListingType.food,
            meta_restaurantId: restaurantId,
            meta_isDeleted: false,
            meta_isFoodEnable: true,
          },
        }),
      ),
    );

    const foods = flatten(response);

    return foods;
  },
  {
    serializeError: storableError,
  },
);

const queryPartnerFoods = createAsyncThunk(
  QUERY_PARTNER_FOODS,
  async (payload: any, { extra: sdk }) => {
    const { isMobileLayout = false, restaurantId, ...rest } = payload;

    const response = await sdk.listings.query({
      meta_listingType: EListingType.food,
      meta_restaurantId: restaurantId,
      meta_isDeleted: false,
      perPage: MANAGE_FOOD_PAGE_SIZE,
      include: ['images'],
      'fields.image': [`variants.${EImageVariants.squareSmall2x}`],
      ...rest,
    });
    const foods = denormalisedResponseEntities(response);

    return {
      isMobileLayout,
      foods,
      managePartnerFoodPagination: response.data.meta,
    };
  },
  {
    serializeError: storableError,
  },
);

const requestUploadFoodImages = createAsyncThunk(
  REQUEST_UPLOAD_IMAGE_FOOD,
  async (
    { id, file }: { id: string; file: File },
    { extra: sdk, rejectWithValue },
  ) => {
    try {
      const response = await sdk.images.upload(
        { image: file },
        {
          expand: true,
          'fields.image': [`variants.${EImageVariants.squareSmall2x}`],
        },
      );
      const img = response.data.data;

      return { ...img, id, imageId: img.id };
    } catch (error) {
      console.error(`${REQUEST_UPLOAD_IMAGE_FOOD} error: `, error);

      return rejectWithValue({ error, id });
    }
  },
);

const createPartnerFoodListing = createAsyncThunk(
  CREATE_PARTNER_FOOD_LISTING,
  async (payload: any, { rejectWithValue }) => {
    try {
      const { data } = await partnerFoodApi.createFood({
        dataParams: payload,
        queryParams: {},
      });

      return denormalisedResponseEntities(data)[0];
    } catch (error) {
      console.error(`${CREATE_PARTNER_FOOD_LISTING} error: `, error);

      return rejectWithValue(storableError(error));
    }
  },
);

const duplicateFood = createAsyncThunk(
  DUPLICATE_FOOD,
  async (payload: any, { extra: sdk, rejectWithValue }) => {
    try {
      const { images = [], title } = payload || {};
      // parse url to file
      const imageAsFiles = await Promise.all(
        images
          .map(async (image: TImage) => {
            try {
              const response = await fetch(
                image.attributes.variants[EImageVariants.squareSmall2x].url,
              );
              const data = await response.blob();
              const metadata = {
                type: 'image/jpeg',
              };
              const file = new File(
                [data],
                `${`${title}_${new Date().getTime()}`}.jpg`,
                metadata,
              );

              return file;
            } catch (error) {
              console.error(error);

              return null;
            }
          })
          .filter((file: File) => !!file),
      );
      // upload image to Flex
      const uploadRes = await Promise.all(
        imageAsFiles.map(async (file) =>
          sdk.images.upload({
            image: file,
          }),
        ),
      );

      const newImages = uploadRes.map((res) => res.data.data.id);
      const { data } = await partnerFoodApi.createFood({
        dataParams: { ...payload, images: newImages },
        queryParams: {},
      });

      return denormalisedResponseEntities(data)[0];
    } catch (error) {
      console.error(`${CREATE_PARTNER_FOOD_LISTING} error: `, error);

      return rejectWithValue(storableError(error));
    }
  },
);

const updatePartnerFoodListing = createAsyncThunk(
  UPDATE_PARTNER_FOOD_LISTING,
  async (payload: TObject, { rejectWithValue }) => {
    try {
      const dataParams = {
        ...payload,
      };
      const queryParams = {
        include: ['images'],
        'fields.image': [`variants.${EImageVariants.squareSmall2x}`],
        expand: true,
      };
      const { data } = await partnerFoodApi.updateFood(dataParams.id, {
        dataParams,
        queryParams,
      });
      const [food] = denormalisedResponseEntities(data);

      return food;
    } catch (error) {
      console.error(`${UPDATE_PARTNER_FOOD_LISTING} error: `, error);

      return rejectWithValue(storableError(error));
    }
  },
);

const updatePartnerFoodPrices = createAsyncThunk(
  UPDATE_PARTNER_FOOD_PRICES,
  async (foodPrices: { id: string; price: number }[], { rejectWithValue }) => {
    try {
      const { data } = await partnerFoodApi.updateFoodPrices(foodPrices);

      return data;
    } catch (error) {
      console.error(`${UPDATE_PARTNER_FOOD_PRICES} error: `, error);

      return rejectWithValue(storableAxiosError(error));
    }
  },
);

const createPartnerFoodFromCsv = createAsyncThunk(
  CREATE_FOOD_FROM_FILE,
  async (
    {
      file,
      googleSheetUrl,
      restaurantId,
    }: {
      file?: File;
      googleSheetUrl?: string;
      restaurantId: string;
    },
    { getState },
  ) => {
    if (file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          const data = e?.target?.result;

          const workbook = XLSX.read(data, { type: 'array' });
          // organize xlsx data into desired format
          workbook.SheetNames.forEach(async (sheet) => {
            if (sheet === 'Template') {
              try {
                const worksheet = workbook.Sheets[sheet];
                const data = XLSX.utils.sheet_to_json(worksheet, {
                  defval: '',
                });

                const response = [];
                const clonedData = data; // resolve ts error
                const dataLengthToImport = data.length;

                for (let i = 0; i < dataLengthToImport; i++) {
                  const foodData = clonedData[i] as any;
                  const dataParams = getImportDataFromCsv({
                    ...foodData,
                    restaurantId,
                  });

                  const queryParams = {
                    expand: true,
                  };

                  // eslint-disable-next-line no-await-in-loop
                  const { data } = await partnerFoodApi.createFood({
                    dataParams,
                    queryParams,
                  });

                  // Throttle the requests to avoid rate limiting
                  // eslint-disable-next-line no-await-in-loop
                  await sleep(500);

                  const [food] = denormalisedResponseEntities(data);

                  response.push(food);
                }

                resolve(response as any);
              } catch (error) {
                console.error('error', error);
                reject(error);
              }
            }
          });
        };
        reader.readAsArrayBuffer(file);
      });
    }

    return new Promise((resolve, reject) => {
      Papa.parse(googleSheetUrl!, {
        download: true,
        header: true,
        skipEmptyLines: true,
        async complete({ data = [] }: { data: any[] }) {
          const packagingOptions = getState().SystemAttributes.packaging;

          const response = [];
          const clonedData = data; // resolve ts error
          const dataLengthToImport = data.length;

          for (let i = 0; i < dataLengthToImport; i++) {
            const foodData = clonedData[i];
            const dataParams = getImportDataFromCsv(
              {
                ...foodData,
                restaurantId,
              },
              packagingOptions,
            );

            const queryParams = {
              expand: true,
            };

            // eslint-disable-next-line no-await-in-loop
            const { data } = await partnerFoodApi.createFood({
              dataParams,
              queryParams,
            });

            // Throttle the requests to avoid rate limiting
            // eslint-disable-next-line no-await-in-loop
            await sleep(500);

            const [food] = denormalisedResponseEntities(data);

            response.push(food);
          }

          resolve(response as any);
        },
        error(err: any) {
          reject(err);
        },
      });
    });
  },
);

const showPartnerFoodListing = createAsyncThunk(
  SHOW_PARTNER_FOOD_LISTING,
  async (id: any, { rejectWithValue, fulfillWithValue }) => {
    try {
      const { data } = await partnerFoodApi.showFood(id, {
        dataParams: {
          include: ['images'],
          'fields.image': [`variants.${EImageVariants.squareSmall2x}`],
        },
        queryParams: {
          expand: true,
        },
      });
      const [food] = denormalisedResponseEntities(data);

      return fulfillWithValue(food);
    } catch (error) {
      console.error(`${SHOW_PARTNER_FOOD_LISTING} error: `, error);

      return rejectWithValue(storableError(error));
    }
  },
);

const removePartnerFood = createAsyncThunk(
  REMOVE_PARTNER_FOOD_LISTING,
  async (payload: TObject, { rejectWithValue }) => {
    try {
      const { id = '', ids = [] } = payload;
      const isDeletingListIds = ids.length > 0;
      const { data } = isDeletingListIds
        ? await partnerFoodApi.deleteFoodByIds({
            dataParams: {
              ids,
            },
            queryParams: {},
          })
        : await partnerFoodApi.deleteFood(id, {
            dataParams: {
              ...payload,
            },
            queryParams: {},
          });

      return data;
    } catch (error) {
      console.error(`${REMOVE_PARTNER_FOOD_LISTING} error: `, error);

      return rejectWithValue(storableAxiosError(error));
    }
  },
);

const showDuplicateFood = createAsyncThunk(
  SHOW_DUPLICATE_FOOD,
  async (id: any, { rejectWithValue }) => {
    try {
      const { data } = await partnerFoodApi.showFood(id, {
        dataParams: {
          include: ['images'],
          'fields.image': [`variants.${EImageVariants.squareSmall2x}`],
        },
        queryParams: {
          expand: true,
        },
      });

      const [food] = denormalisedResponseEntities(data);

      return food;
    } catch (error) {
      return rejectWithValue(storableAxiosError(error));
    }
  },
);

const fetchFoodDetail = createAsyncThunk(
  FETCH_FOOD_DETAIL,
  async (id: any, { extra: sdk }) => {
    const response = await sdk.listings.show({
      id,
      include: ['images'],
      'fields.image': [`variants.${EImageVariants.default}`],
      expand: true,
    });

    const [food] = denormalisedResponseEntities(response);

    return food;
  },
);

export const publishOrCloseFood = createAsyncThunk(
  PUBLISH_OR_CLOSE_FOOD,
  async (payload: any) => {
    const { id, isPublish } = payload;
    const promise = isPublish
      ? partnerFoodApi.publishFoodApi
      : partnerFoodApi.closeFoodApi;

    const { data } = await promise(id, {
      dataParams: {},
      queryParams: {
        expand: true,
      },
    });

    const [food] = denormalisedResponseEntities(data);

    return food;
  },
  {
    serializeError: storableAxiosError,
  },
);

const responseApprovalRequest = createAsyncThunk(
  RESPONSE_APPROVAL_REQUEST,
  async (
    { foodId, response }: { foodId: string; response: EFoodApprovalState },
    { rejectWithValue },
  ) => {
    try {
      await responseApprovalRequestApi({ foodId, response });
    } catch (error) {
      console.error(`${RESPONSE_APPROVAL_REQUEST} error: `, error);

      return rejectWithValue(storableError(error));
    }
  },
);

export const foodSliceThunks = {
  queryPartnerFoods,
  requestUploadFoodImages,
  createPartnerFoodListing,
  updatePartnerFoodListing,
  updatePartnerFoodPrices,
  showPartnerFoodListing,
  removePartnerFood,
  showDuplicateFood,
  duplicateFood,
  createPartnerFoodFromCsv,
  queryMenuPickedFoods,
  publishOrCloseFood,
  responseApprovalRequest,
  fetchFoodDetail,
};

// ================ Slice ================ //
const foodSlice = createSlice({
  name: 'foodSlice',
  initialState,
  reducers: {
    removeImage: (state: any, { payload }) => {
      const id = payload;
      // Only mark the image removed if it hasn't been added to the
      // listing already
      const removedImageIds =
        id && state?.uploadedImages?.[id]
          ? state.removedImageIds
          : state.removedImageIds.concat(id);

      // Always remove from the draft since it might be a new image to
      // an existing listing.
      const uploadedImages = omit(state.uploadedImages, id);
      const uploadedImagesOrder = state.uploadedImagesOrder.filter(
        (i: any) => i !== id,
      );

      return {
        ...state,
        uploadedImages,
        uploadedImagesOrder,
        removedImageIds,
      };
    },
    setInitialStates: () => ({
      ...initialState,
    }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(queryPartnerFoods.pending, (state) => ({
        ...state,
        queryFoodsInProgress: true,
        queryFoodsError: null,
      }))
      .addCase(queryPartnerFoods.fulfilled, (state, { payload }) => {
        const { page = 1 } = payload.managePartnerFoodPagination || {};

        state.queryFoodsInProgress = false;
        state.foods =
          payload.isMobileLayout && page !== 1
            ? state.foods.concat(payload.foods)
            : payload.foods;
        state.managePartnerFoodPagination = payload.managePartnerFoodPagination;
      })
      .addCase(queryPartnerFoods.rejected, (state, { payload }) => ({
        ...state,
        queryFoodsInProgress: false,
        queryFoodsError: payload,
      }))
      .addCase(requestUploadFoodImages.pending, (state, action) => {
        const { id } = action.meta.arg;

        const uploadedImages = {
          ...state.uploadedImages,
          [id]: { ...action.meta.arg },
        };

        return {
          ...state,
          uploadedImages,
          uploadedImagesOrder: state.uploadedImagesOrder.concat([id]),
          uploadImageError: null,
          uploadingImages: true,
        };
      })
      .addCase(requestUploadFoodImages.fulfilled, (state, action) => {
        const { id, ...rest } = action.payload;
        const uploadedImages = {
          ...state.uploadedImages,
          [id]: { id, ...rest },
        };

        return { ...state, uploadedImages, uploadingImages: false };
      })
      .addCase(requestUploadFoodImages.rejected, (state, action: any) => {
        const { id, error } = action.payload;
        const uploadedImagesOrder = state.uploadedImagesOrder.filter(
          (i: any) => i !== id,
        );
        const uploadedImages = omit(state.uploadedImages, id);

        return {
          ...state,
          uploadedImagesOrder,
          uploadedImages,
          uploadImageError: error,
          uploadingImages: false,
        };
      })
      .addCase(createPartnerFoodListing.pending, (state) => ({
        ...state,
        createFoodError: null,
        createFoodInProgress: true,
      }))
      .addCase(createPartnerFoodListing.fulfilled, (state) => ({
        ...state,
        createFoodInProgress: false,
      }))
      .addCase(createPartnerFoodListing.rejected, (state, { payload }) => ({
        ...state,
        createFoodInProgress: false,
        createFoodError: payload,
      }))
      .addCase(showPartnerFoodListing.pending, (state) => ({
        ...state,
        showFoodInProgress: true,
        showFoodError: null,
      }))
      .addCase(showPartnerFoodListing.fulfilled, (state, { payload }) => ({
        ...state,
        showFoodInProgress: false,
        currentFoodListing: payload,
      }))
      .addCase(showPartnerFoodListing.rejected, (state, { payload }) => ({
        ...state,
        showFoodInProgress: false,
        showFoodError: payload,
      }))
      .addCase(updatePartnerFoodListing.pending, (state) => ({
        ...state,
        updateFoodInProgress: true,
        updateFoodError: null,
      }))
      .addCase(updatePartnerFoodListing.fulfilled, (state) => ({
        ...state,
        updateFoodInProgress: false,
      }))
      .addCase(updatePartnerFoodListing.rejected, (state, { payload }) => ({
        ...state,
        updateFoodInProgress: false,
        updateFoodError: payload,
      }))
      .addCase(updatePartnerFoodPrices.pending, (state) => ({
        ...state,
        updateFoodInProgress: true,
        updateFoodError: null,
      }))
      .addCase(updatePartnerFoodPrices.fulfilled, (state) => ({
        ...state,
        updateFoodInProgress: false,
      }))
      .addCase(updatePartnerFoodPrices.rejected, (state, { payload }) => ({
        ...state,
        updateFoodInProgress: false,
        updateFoodError: payload,
      }))
      .addCase(removePartnerFood.pending, (state, { meta }) => ({
        ...state,
        removeFoodInProgress: meta.arg.id || meta.arg.ids,
        removeFoodError: null,
      }))
      .addCase(removePartnerFood.fulfilled, (state) => ({
        ...state,
        removeFoodInProgress: false,
      }))
      .addCase(removePartnerFood.rejected, (state, { payload }) => ({
        ...state,
        removeFoodInProgress: false,
        removeFoodError: payload,
      }))
      .addCase(showDuplicateFood.pending, (state) => ({
        ...state,
        showFoodInProgress: true,
        showFoodError: null,
      }))
      .addCase(showDuplicateFood.fulfilled, (state, { payload }) => ({
        ...state,
        showFoodInProgress: false,
        currentFoodListing: payload,
      }))
      .addCase(showDuplicateFood.rejected, (state, { payload }) => ({
        ...state,
        showFoodInProgress: false,
        showFoodError: payload,
      }))
      .addCase(duplicateFood.pending, (state) => ({
        ...state,
        createFoodError: null,
        createFoodInProgress: true,
      }))
      .addCase(duplicateFood.fulfilled, (state) => ({
        ...state,
        createFoodInProgress: false,
      }))
      .addCase(duplicateFood.rejected, (state, { payload }) => ({
        ...state,
        createFoodInProgress: false,
        createFoodError: payload,
      }))
      .addCase(createPartnerFoodFromCsv.pending, (state) => ({
        ...state,
        createPartnerFoodFromCsvInProgress: true,
        createPartnerFoodFromCsvError: null,
      }))
      .addCase(
        createPartnerFoodFromCsv.fulfilled,
        (state, { payload = [] }) => ({
          ...state,
          createPartnerFoodFromCsvInProgress: false,
          createPartnerFoodFromCsvError: null,
          foods: [
            ...(payload as unknown as TIntegrationListing[]),
            ...state.foods,
          ],
        }),
      )
      .addCase(createPartnerFoodFromCsv.rejected, (state, { payload }) => ({
        ...state,
        createPartnerFoodFromCsvInProgress: false,
        createPartnerFoodFromCsvError: payload,
      }))
      .addCase(
        publishOrCloseFood.pending,
        (
          state,
          {
            meta: {
              arg: { id: foodId },
            },
          },
        ) => ({
          ...state,
          publishOrCloseFoodId: foodId,
          publishOrCloseFoodIdError: null,
        }),
      )
      .addCase(
        publishOrCloseFood.fulfilled,
        (
          state,
          {
            payload,
            meta: {
              arg: { id: foodId },
            },
          },
        ) => ({
          ...state,
          publishOrCloseFoodId: null,
          publishOrCloseFoodIdError: null,
          foods: state.foods.map((food: TListing) =>
            food.id.uuid === foodId ? payload : food,
          ),
        }),
      )
      .addCase(publishOrCloseFood.rejected, (state, { error }) => ({
        ...state,
        publishOrCloseFoodId: null,
        publishOrCloseFoodIdError: error,
      }))

      .addCase(responseApprovalRequest.pending, (state) => ({
        ...state,
        responseApprovalRequestInProgress: true,
        responseApprovalRequestError: null,
      }))
      .addCase(responseApprovalRequest.fulfilled, (state) => ({
        ...state,
        responseApprovalRequestInProgress: false,
      }))
      .addCase(responseApprovalRequest.rejected, (state, { payload }) => ({
        ...state,
        responseApprovalRequestInProgress: false,
        responseApprovalRequestError: payload,
      }))
      .addCase(fetchFoodDetail.pending, (state) => ({
        ...state,
        fetchFoodDetailInProgress: true,
        fetchFoodDetailError: null,
      }))
      .addCase(fetchFoodDetail.fulfilled, (state, { payload }) => ({
        ...state,
        fetchFoodDetailInProgress: false,
        foodDetail: payload,
      }))
      .addCase(fetchFoodDetail.rejected, (state, { payload }) => ({
        ...state,
        fetchFoodDetailInProgress: false,
        fetchFoodDetailError: payload,
      }));
  },
});

// ================ Actions ================ //
export const foodSliceAction = foodSlice.actions;
export default foodSlice.reducer;

// ================ Selectors ================ //
