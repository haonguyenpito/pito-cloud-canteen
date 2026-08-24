import React, { useEffect, useMemo } from 'react';
import { FormattedMessage } from 'react-intl';
import { shallowEqual } from 'react-redux';
import { useRouter } from 'next/router';

import ErrorMessage from '@components/ErrorMessage/ErrorMessage';
import LoadingContainer from '@components/LoadingContainer/LoadingContainer';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { foodSliceAction, foodSliceThunks } from '@redux/slices/foods.slice';
import { partnerThunks } from '@redux/slices/partners.slice';
import { IntegrationListing } from '@src/utils/data';
import type { TObject } from '@src/utils/types';
import { parsePrice } from '@src/utils/validators';
import { EFoodType, EMenuType } from '@utils/enums';
import { getInitialAddImages } from '@utils/images';

import EditPartnerFoodForm from '../components/EditPartnerFoodForm/EditPartnerFoodForm';
import type { TEditPartnerFoodFormValues } from '../utils';
import { getUpdateFoodData } from '../utils';

import css from './EditPartnerFood.module.scss';

const EditPartnerFoodPage = () => {
  const { foodId = '', restaurantId = '', mode = '' } = useRouter().query;
  const dispatch = useAppDispatch();

  const {
    currentFoodListing,
    showFoodInProgress,
    showFoodError,
    updateFoodInProgress,
    updateFoodError,
    uploadingImages,
    responseApprovalRequestInProgress,
  } = useAppSelector((state) => state.foods, shallowEqual);

  const {
    showPartnerListingInProgress,
    showPartnerListingError,
    partnerListingRef,
  } = useAppSelector((state) => state.partners, shallowEqual);

  const handleSubmit = (values: TEditPartnerFoodFormValues) =>
    dispatch(
      foodSliceThunks.updatePartnerFoodListing(
        getUpdateFoodData({ ...values, id: foodId as string }),
      ),
    );

  const {
    minQuantity: minQuantityFromPartner,
    maxQuantity: maxQuantityFromPartner,
  } = IntegrationListing(partnerListingRef).getPublicData();

  const initialValues = useMemo(() => {
    const attributes = currentFoodListing?.attributes || {};

    const {
      publicData = {},
      price,
      title,
      description,
    } = attributes || ({} as TObject);
    const {
      menuType,
      foodType,
      minQuantity,
      maxQuantity,
      minOrderHourInAdvance,
    } = publicData;

    return {
      images: getInitialAddImages(currentFoodListing?.images || []),
      title,
      description,
      price: parsePrice(price?.amount || 0),
      ...publicData,
      menuType: menuType || EMenuType.fixedMenu,
      foodType: foodType || EFoodType.savoryDish,
      minQuantity: minQuantity || minQuantityFromPartner,
      maxQuantity: maxQuantity || maxQuantityFromPartner,
      minOrderHourInAdvance: minOrderHourInAdvance || 24,
    };
  }, [
    currentFoodListing,
    maxQuantityFromPartner,
    minQuantityFromPartner,
  ]) as TEditPartnerFoodFormValues;

  useEffect(() => {
    if (restaurantId) {
      dispatch(partnerThunks.showPartnerRestaurantListing(restaurantId));
    }
  }, [restaurantId, dispatch]);

  useEffect(() => {
    dispatch(foodSliceAction.setInitialStates());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!foodId) return;
    dispatch(foodSliceThunks.showPartnerFoodListing(foodId));
  }, [dispatch, foodId]);

  if (showFoodInProgress || showPartnerListingInProgress) {
    return <LoadingContainer />;
  }

  const showError = showFoodError || showPartnerListingError;

  if (showError) {
    return <ErrorMessage message={showError.message} />;
  }

  return (
    <>
      <h3 className={css.title}>
        <FormattedMessage id="EditPartnerFood.title" />
      </h3>
      <EditPartnerFoodForm
        onSubmit={handleSubmit}
        inProgress={updateFoodInProgress || responseApprovalRequestInProgress}
        disabled={uploadingImages || updateFoodInProgress}
        formError={updateFoodError}
        initialValues={initialValues}
        isEditting
        viewModeOnly={mode === 'viewOnly'}
        foodId={foodId as string}
      />
    </>
  );
};

export default EditPartnerFoodPage;
