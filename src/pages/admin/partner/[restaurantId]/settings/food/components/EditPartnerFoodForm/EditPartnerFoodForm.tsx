/* eslint-disable react-hooks/exhaustive-deps */
import { useMemo, useState } from 'react';
import type { FormProps, FormRenderProps } from 'react-final-form';
import { Form as FinalForm } from 'react-final-form';
import { useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import { toast } from 'react-toastify';
import classNames from 'classnames';
import type { FormApi } from 'final-form';
import arrayMutators from 'final-form-arrays';
import isEqual from 'lodash/isEqual';

import Button from '@components/Button/Button';
import ErrorMessage from '@components/ErrorMessage/ErrorMessage';
import Form from '@components/Form/Form';
import FieldCheckboxGroup from '@components/FormFields/FieldCheckboxGroup/FieldCheckboxGroup';
import FieldDropdownSelect from '@components/FormFields/FieldDropdownSelect/FieldDropdownSelect';
import FieldMutiplePhotos from '@components/FormFields/FieldMultiplePhotos/FieldMultiplePhotos';
import FieldRadioButton from '@components/FormFields/FieldRadioButton/FieldRadioButton';
import FieldTextArea from '@components/FormFields/FieldTextArea/FieldTextArea';
import FieldTextInput from '@components/FormFields/FieldTextInput/FieldTextInput';
import FieldTextInputWithBottomBox from '@components/FormFields/FieldTextInputWithBottomBox/FieldTextInputWithBottomBox';
import PopupModal from '@components/PopupModal/PopupModal';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import FileHelpers from '@helpers/fileHelpers';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import useBoolean from '@hooks/useBoolean';
import { foodSliceAction, foodSliceThunks } from '@redux/slices/foods.slice';
import { EFoodApprovalState, EImageVariants } from '@src/utils/enums';
import {
  FOOD_SIDE_DISH_OPTIONS,
  FOOD_TYPE_OPTIONS,
  MENU_TYPE_OPTIONS,
  OTHER_OPTION,
} from '@src/utils/options';
import type { TKeyValue } from '@src/utils/types';
import { pickRenderableImages } from '@utils/images';
import {
  composeValidators,
  composeValidatorsWithAllValues,
  maxLength,
  minPriceLength,
  numberMinLength,
  parsePrice,
  required,
  upperCaseFirstLetter,
  validateNonEnterInputField,
  // validFoodTitle,
} from '@utils/validators';

import type { TEditPartnerFoodFormValues } from '../../utils';

import css from './EditPartnerFoodForm.module.scss';

type TExtraProps = {
  submittedValues?: TEditPartnerFoodFormValues;
  inProgress: boolean;
  formError?: any;
  isEditting?: boolean;
  disabled?: boolean;
  viewModeOnly?: boolean;
  foodId?: string;
  handleSubmitOnClick?: (values: TEditPartnerFoodFormValues) => any;
};
type TEditPartnerFoodFormComponentProps =
  FormRenderProps<TEditPartnerFoodFormValues> & Partial<TExtraProps>;
type TEditPartnerFoodFormProps = FormProps<TEditPartnerFoodFormValues> &
  TExtraProps;

const EditPartnerFoodFormComponent: React.FC<
  TEditPartnerFoodFormComponentProps
> = (props) => {
  const {
    values,
    submittedValues,
    inProgress,
    formError,
    isEditting,
    disabled,
    form,
    handleSubmitOnClick,
    invalid,
    viewModeOnly,
    foodId,
  } = props;
  const dispatch = useAppDispatch();
  const ready = isEqual(submittedValues, values);
  const {
    nutritions: nutritionsOptions = [],
    categories: categoriesOptions = [],
    packaging: packagingOptions = [],
  } = useAppSelector((state) => state.SystemAttributes, shallowEqual);
  const {
    uploadedImages,
    uploadedImagesOrder,
    removedImageIds,
    uploadImageError,
    currentFoodListing = {},
  } = useAppSelector((state) => state.foods, shallowEqual);
  const [responseApprovalRequest, setResponseApprovalRequest] =
    useState<string>('');

  const approvalModalController = useBoolean();
  const images = pickRenderableImages(
    currentFoodListing,
    uploadedImages,
    uploadedImagesOrder,
    removedImageIds,
  );

  const onImageUpload = async (params: { id: string; file: File }) => {
    try {
      const { file } = params;
      const compressedFile = (await FileHelpers.compressImage(file)) as File;
      params.file = compressedFile;

      return await (dispatch(
        foodSliceThunks.requestUploadFoodImages(params),
      ) as Promise<{
        payload: any;
      }>);
    } catch (error) {
      toast.error('Có lỗi xảy ra khi tải ảnh lên');
    }
  };

  const onRemoveImage = (id: string) => {
    return dispatch(foodSliceAction.removeImage(id));
  };

  const intl = useIntl();

  const handleSubmitForm = () => {
    if (invalid) {
      // rerun validation
      return form.submit();
    }

    return handleSubmitOnClick && handleSubmitOnClick(values);
  };

  const parsedPackagingOptions = useMemo(
    () =>
      packagingOptions
        .filter((cate: TKeyValue) => cate.key !== OTHER_OPTION)
        .map((cat: TKeyValue) => ({
          label: cat.label,
          key: cat.key,
        })),
    [JSON.stringify(packagingOptions)],
  );

  const parsedCategoryOptions = useMemo(
    () =>
      categoriesOptions
        .filter((cate: TKeyValue) => cate.key !== OTHER_OPTION)
        .map((cat: TKeyValue) => ({ key: cat.key, label: cat.label })),
    [JSON.stringify(categoriesOptions)],
  );

  const fieldClasses = classNames(css.flexField, viewModeOnly && css.viewOnly);

  const declineFood = async () => {
    setResponseApprovalRequest(EFoodApprovalState.DECLINED);
    await dispatch(
      foodSliceThunks.responseApprovalRequest({
        foodId: foodId as string,
        response: EFoodApprovalState.DECLINED,
      }),
    );
    approvalModalController.setTrue();
  };

  const acceptFood = async () => {
    setResponseApprovalRequest(EFoodApprovalState.ACCEPTED);
    await dispatch(
      foodSliceThunks.responseApprovalRequest({
        foodId: foodId as string,
        response: EFoodApprovalState.ACCEPTED,
      }),
    );
    approvalModalController.setTrue();
  };

  return (
    <Form className={css.root}>
      <div
        className={classNames(css.fieldPhotos, viewModeOnly && css.viewOnly)}>
        <FieldMutiplePhotos
          name="images"
          id="images"
          onImageUpload={onImageUpload}
          onRemoveImage={onRemoveImage}
          images={images}
          variants={[EImageVariants.squareSmall2x]}
          className={css.imageInputWrapper}
          inputClassName={css.imageInput}
          uploadImageError={uploadImageError}
        />
      </div>
      <div
        className={classNames(css.radioFields, viewModeOnly && css.viewOnly)}>
        <label className={css.label}>
          {intl.formatMessage({ id: 'EditPartnerFoodForm.menuLabel' })}
        </label>
        {MENU_TYPE_OPTIONS.map((option) => (
          <FieldRadioButton
            key={option.key}
            name="menuType"
            id={option.key}
            value={option.key}
            label={option.label}
          />
        ))}
      </div>
      <div className={fieldClasses}>
        <div className={classNames(css.field, css.minOrderFieldWrapper)}>
          <label className={css.label}>
            {intl.formatMessage({
              id: 'EditPartnerFoodForm.minQuantityPerOrderLabel',
            })}
          </label>
          <div className={css.minOrderFields}>
            <FieldTextInput
              className={css.minOrderField}
              type="number"
              inputClassName={css.inputWithSuffix}
              name="minOrderHourInAdvance"
              id="minOrderHourInAdvance"
              placeholder={intl.formatMessage({
                id: 'EditPartnerFoodForm.orderHourInAdvancePlaceholder',
              })}
              rightIcon={<div>h</div>}
              rightIconContainerClassName={css.inputSuffixed}
              validate={composeValidators(
                required(
                  intl.formatMessage({
                    id: 'EditPartnerFoodForm.minOrderHourInAdvanceRequired',
                  }),
                ),
                numberMinLength(
                  intl.formatMessage({
                    id: 'EditPartnerFoodForm.minOrderHourInAdvanceInvalid',
                  }),
                  1,
                ),
              )}
            />
            <FieldTextInput
              className={css.minOrderField}
              name="minQuantity"
              type="number"
              id="minQuantity"
              placeholder={intl.formatMessage({
                id: 'EditPartnerFoodForm.minQuantityPerOrderPlaceholder',
              })}
              rightIcon={<div>phần</div>}
              inputClassName={css.inputWithSuffix}
              rightIconContainerClassName={css.inputSuffixed}
              validate={composeValidators(
                required(
                  intl.formatMessage({
                    id: 'EditPartnerFoodForm.minQuantityRequired',
                  }),
                ),
                numberMinLength(
                  intl.formatMessage({
                    id: 'EditPartnerFoodForm.minQuantityInvalid',
                  }),
                  1,
                ),
              )}
            />
          </div>
        </div>
        <FieldTextInput
          className={classNames(
            css.field,
            css.maxQuantityField,
            viewModeOnly && css.viewOnly,
          )}
          name="maxQuantity"
          type="number"
          id="maxQuantity"
          placeholder={intl.formatMessage({
            id: 'EditPartnerFoodForm.maxMemberPlaceholder',
          })}
          label={intl.formatMessage({
            id: 'EditPartnerFoodForm.maxMemberLabel',
          })}
          inputClassName={css.inputWithSuffix}
          rightIcon={<div>người</div>}
          rightIconContainerClassName={css.inputSuffixed}
          validate={composeValidators(
            required(
              intl.formatMessage({
                id: 'EditPartnerFoodForm.maxMemberRequired',
              }),
            ),
            numberMinLength(
              intl.formatMessage({
                id: 'EditPartnerFoodForm.maxMemberInvalid',
              }),
              1,
            ),
          )}
        />
      </div>
      <div className={fieldClasses}>
        <div className={classNames(css.field, css.titleFields)}>
          <FieldTextInput
            name="title"
            className={css.field}
            id="title"
            placeholder={intl.formatMessage({
              id: 'EditPartnerFoodForm.foodTitlePlaceholder',
            })}
            label={intl.formatMessage({
              id: 'EditPartnerFoodForm.foodTitleLabel',
            })}
            parse={upperCaseFirstLetter}
            validate={composeValidators(
              required(
                intl.formatMessage({ id: 'EditPartnerFoodForm.titleRequired' }),
              ),
              // maxLength(
              //   intl.formatMessage({
              //     id: 'EditPartnerFoodForm.titleMaxLength',
              //   }),
              //   150,
              // ),
              // validFoodTitle(
              //   intl.formatMessage({
              //     id: 'EditPartnerFoodForm.titleInValid',
              //   }),
              // ),
            )}
          />
          <FieldTextInput
            className={css.unitField}
            name="unit"
            id="unit"
            placeholder={intl.formatMessage({
              id: 'EditPartnerFoodForm.unitPlaceholder',
            })}
            label={intl.formatMessage({
              id: 'EditPartnerFoodForm.unitLabel',
            })}
          />
        </div>
        <div
          className={classNames(
            css.flexField,
            css.innerFlexfield,
            viewModeOnly && css.viewOnly,
          )}>
          <FieldTextInput
            className={classNames(css.field, css.priceField)}
            name="price"
            id="price"
            label={intl.formatMessage({ id: 'EditPartnerFoodForm.priceLabel' })}
            placeholder={intl.formatMessage({
              id: 'EditPartnerFoodForm.pricePlaceholder',
            })}
            inputClassName={css.inputWithSuffix}
            rightIcon={<div className={css.inputSuffixed}>đ</div>}
            validate={composeValidators(
              required(
                intl.formatMessage({ id: 'EditPartnerFoodForm.priceRequired' }),
              ),
              minPriceLength(
                intl.formatMessage({
                  id: 'EditPartnerFoodForm.priceMinLength',
                }),
                1000,
              ),
            )}
            parse={parsePrice}
          />
          <FieldDropdownSelect
            className={css.field}
            name="packaging"
            id="packaging"
            options={parsedPackagingOptions}
            label={intl.formatMessage({
              id: 'EditPartnerFoodForm.packagingLabel',
            })}
            placeholder={intl.formatMessage({
              id: 'EditPartnerFoodForm.packagingPlaceholder',
            })}
          />
        </div>
      </div>
      <div className={fieldClasses}>
        <FieldCheckboxGroup
          className={css.field}
          options={nutritionsOptions || []}
          name="specialDiets"
          id="specialDiets"
          label={intl.formatMessage({
            id: 'EditPartnerFoodForm.specialDietsLabel',
          })}
          listClassName={css.specialDietsList}
          checkboxClassName={css.specialDietsCheckbox}
          labelClassName={css.specialDietsLabel}
          itemClassName={css.specialDietsItem}
        />
        <div className={classNames(css.flexField, css.flexColumn)}>
          <div className={css.field}>
            <label className={css.label}>
              {intl.formatMessage({ id: 'EditPartnerFoodForm.foodTypeLabel' })}
            </label>
            {FOOD_TYPE_OPTIONS.map((option) => (
              <FieldRadioButton
                key={option.key}
                name="foodType"
                id={option.key}
                value={option.key}
                label={option.label}
              />
            ))}
          </div>
          <FieldDropdownSelect
            className={css.field}
            name="category"
            options={parsedCategoryOptions}
            id="category"
            label={intl.formatMessage({
              id: 'EditPartnerFoodForm.foodCategoryLabel',
            })}
            placeholder={intl.formatMessage({
              id: 'EditPartnerFoodForm.categoryPlaceholder',
            })}
          />
        </div>
      </div>
      <div className={fieldClasses}>
        <FieldTextInputWithBottomBox
          className={css.field}
          name="allergicIngredients"
          id="allergicIngredients"
          placeholder={intl.formatMessage({
            id: 'EditPartnerFoodForm.allergicIngredientPlaceholder',
          })}
          label={intl.formatMessage({
            id: 'EditPartnerFoodForm.allergicIngredientLabel',
          })}
          form={form as unknown as FormApi}
          validate={composeValidatorsWithAllValues(
            validateNonEnterInputField(
              intl.formatMessage({
                id: 'EditPartnerFoodForm.allergicIngredientValid',
              }),
            ),
          )}
        />
        <FieldTextInput
          className={css.field}
          name="numberOfMainDishes"
          type="number"
          id="numberOfMainDishes"
          placeholder={intl.formatMessage({
            id: 'EditPartnerFoodForm.numberOfMainDishesPlaceholder',
          })}
          label={intl.formatMessage({
            id: 'EditPartnerFoodForm.numberOfMainDishesLabel',
          })}
          inputClassName={css.inputWithSuffix}
          rightIconContainerClassName={css.inputSuffixed}
          rightIcon={<div>món</div>}
        />
      </div>
      <div className={fieldClasses}>
        <FieldCheckboxGroup
          className={css.field}
          listClassName={css.sideDishesList}
          name="sideDishes"
          id="sideDishes"
          placeholder={intl.formatMessage({
            id: 'EditPartnerFoodForm.sideDishPlaceholder',
          })}
          label={intl.formatMessage({
            id: 'EditPartnerFoodForm.sideDishLabel',
          })}
          options={FOOD_SIDE_DISH_OPTIONS}
        />
        <div className={css.field}></div>
      </div>
      <div className={fieldClasses}>
        <FieldTextArea
          className={css.field}
          name="description"
          id="description"
          placeholder={intl.formatMessage({
            id: 'EditPartnerFoodForm.descriptionPlaceholder',
          })}
          label={intl.formatMessage({
            id: 'EditPartnerFoodForm.descriptionLabel',
          })}
          // validate={maxLength(
          //   intl.formatMessage({
          //     id: 'EditPartnerFoodForm.descriptionMaxLength',
          //   }),
          //   200,
          // )}
        />
        <div className={css.field}>
          <FieldTextArea
            name="notes"
            id="notes"
            placeholder={intl.formatMessage({
              id: 'EditPartnerFoodForm.notesPlaceholder',
            })}
            label={intl.formatMessage({
              id: 'EditPartnerFoodForm.notesLabel',
            })}
            validate={maxLength(
              intl.formatMessage({
                id: 'EditPartnerFoodForm.notesMaxLength',
              }),
              200,
            )}
          />
        </div>
      </div>
      <div className={css.submitButtons}>
        <ErrorMessage message={formError?.message} />
        <Button
          onClick={viewModeOnly ? acceptFood : handleSubmitForm}
          type="button"
          ready={ready}
          inProgress={
            (!viewModeOnly && inProgress) ||
            (viewModeOnly &&
              inProgress &&
              responseApprovalRequest === EFoodApprovalState.ACCEPTED)
          }
          disabled={disabled}
          className={css.submitBtn}>
          {viewModeOnly
            ? 'Duyệt'
            : isEditting
            ? intl.formatMessage({
                id: 'EditPartnerFoodForm.updateBtn',
              })
            : intl.formatMessage({
                id: 'EditPartnerFoodForm.submitBtn',
              })}
        </Button>
        <RenderWhen condition={viewModeOnly}>
          <Button
            onClick={declineFood}
            type="button"
            ready={ready}
            variant="secondary"
            inProgress={
              inProgress &&
              responseApprovalRequest === EFoodApprovalState.DECLINED
            }
            disabled={disabled}
            className={css.submitBtn}>
            Từ chối
          </Button>
        </RenderWhen>
        <PopupModal
          id="ApprovalModal"
          isOpen={approvalModalController.value}
          handleClose={approvalModalController.setFalse}
          title="Thông báo">
          <div>
            {responseApprovalRequest === EFoodApprovalState.ACCEPTED
              ? 'Duyệt món ăn thành công'
              : 'Từ chối món ăn thành công'}
          </div>
        </PopupModal>
      </div>
    </Form>
  );
};

const EditPartnerFoodForm: React.FC<TEditPartnerFoodFormProps> = (props) => {
  const [submittedValues, setSubmittedValues] =
    useState<TEditPartnerFoodFormValues>();
  const handleSubmit = async (values: TEditPartnerFoodFormValues) => {
    const { error } = (await props.onSubmit(values, {} as any)) as any;
    if (!error) {
      setSubmittedValues(values);
    }
  };

  return (
    <FinalForm
      mutators={{ ...arrayMutators }}
      {...props}
      handleSubmitOnClick={handleSubmit}
      submittedValues={submittedValues}
      component={EditPartnerFoodFormComponent}
    />
  );
};

export default EditPartnerFoodForm;
