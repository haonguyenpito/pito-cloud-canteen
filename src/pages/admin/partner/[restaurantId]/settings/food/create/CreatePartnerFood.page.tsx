import React, { useEffect, useMemo } from 'react';
import { FormattedMessage } from 'react-intl';
import { shallowEqual } from 'react-redux';
import { useRouter } from 'next/router';

import ErrorMessage from '@components/ErrorMessage/ErrorMessage';
import LoadingContainer from '@components/LoadingContainer/LoadingContainer';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { foodSliceAction, foodSliceThunks } from '@redux/slices/foods.slice';
import { partnerThunks } from '@redux/slices/partners.slice';
import { adminRoutes } from '@src/paths';
import { IntegrationListing } from '@utils/data';
import { EFoodApprovalState, EFoodType, EMenuType } from '@utils/enums';
import { getInitialAddImages } from '@utils/images';
import type { TIntegrationListing, TObject } from '@utils/types';

import EditPartnerFoodForm from '../components/EditPartnerFoodForm/EditPartnerFoodForm';
import type { TEditPartnerFoodFormValues } from '../utils';
import { getDuplicateData, getSubmitFoodData } from '../utils';

import css from './CreatePartnerFood.module.scss';

const CreatePartnerFoodPage = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { restaurantId = '', duplicateId } = router.query;
  const {
    createFoodInProgress,
    createFoodError,
    currentFoodListing,
    showFoodInProgress,
    showFoodError,
    uploadingImages,
  } = useAppSelector((state) => state.foods, shallowEqual);

  const {
    partnerListingRef,
    showPartnerListingInProgress,
    showPartnerListingError,
  } = useAppSelector((state) => state.partners, shallowEqual);

  const redirectToEditPage = (listing: TIntegrationListing) => {
    const foodId = listing?.id?.uuid;
    setTimeout(() => {
      if (foodId)
        return router.push({
          pathname: adminRoutes.ManagePartnerFoods.path,
          query: {
            restaurantId,
          },
        });
    }, 1000);
  };
  const handleSubmit = async (values: TEditPartnerFoodFormValues) => {
    if (duplicateId) {
      const response = await dispatch(
        foodSliceThunks.duplicateFood(
          getDuplicateData({
            ...values,
            restaurantId: restaurantId as string,
          }),
        ),
      );
      redirectToEditPage(response.payload);

      return response;
    }
    const response = await dispatch(
      foodSliceThunks.createPartnerFoodListing(
        getSubmitFoodData({
          ...values,
          restaurantId: restaurantId as string,
          adminApproval: EFoodApprovalState.ACCEPTED,
          isDraft: false,
        }),
      ),
    );
    redirectToEditPage(response.payload);

    return response;
  };

  const { minQuantity, maxQuantity } =
    IntegrationListing(partnerListingRef).getPublicData();

  const initialValues = useMemo(() => {
    const attributes = currentFoodListing?.attributes || {};
    const {
      publicData = {},
      price,
      title,
      description,
    } = attributes || ({} as TObject);
    const { foodType, menuType, allergicIngredients, ...rest } = publicData;

    return {
      images: getInitialAddImages(currentFoodListing?.images || []),
      title,
      description,
      price: price?.amount,
      menuType: menuType || EMenuType.cycleMenu,
      foodType: foodType || EFoodType.savoryDish,
      minOrderHourInAdvance: 24,
      minQuantity,
      maxQuantity,
      allergicIngredients: allergicIngredients || [],
      ...rest,
    };
  }, [
    currentFoodListing,
    minQuantity,
    maxQuantity,
  ]) as TEditPartnerFoodFormValues;

  useEffect(() => {
    if (!duplicateId) {
      dispatch(foodSliceAction.setInitialStates());
    }
  }, [duplicateId, dispatch]);

  useEffect(() => {
    if (!duplicateId) return;
    dispatch(foodSliceThunks.showDuplicateFood(duplicateId));
  }, [duplicateId, dispatch]);

  useEffect(() => {
    if (restaurantId) {
      dispatch(partnerThunks.showPartnerRestaurantListing(restaurantId));
    }
  }, [restaurantId, dispatch]);

  if (showFoodInProgress || showPartnerListingInProgress) {
    return <LoadingContainer />;
  }

  const showError = showPartnerListingError || showFoodError;

  if (showError) {
    return <ErrorMessage message={showError.message} />;
  }

  return (
    <>
      <h3 className={css.title}>
        <FormattedMessage id="CreatePartnerFood.title" />
      </h3>
      <EditPartnerFoodForm
        onSubmit={handleSubmit}
        initialValues={initialValues}
        inProgress={createFoodInProgress}
        disabled={uploadingImages || createFoodInProgress}
        formError={createFoodError}
      />
    </>
  );
};

export default CreatePartnerFoodPage;
