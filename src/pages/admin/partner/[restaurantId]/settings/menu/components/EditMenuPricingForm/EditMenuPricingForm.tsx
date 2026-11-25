/* eslint-disable @typescript-eslint/default-param-last */
import { useImperativeHandle, useState } from 'react';
import type { FormProps, FormRenderProps } from 'react-final-form';
import { Field, Form as FinalForm } from 'react-final-form';
import { FormattedMessage } from 'react-intl';
import type { FormApi } from 'final-form';

import CalendarDashboard from '@components/CalendarDashboard/CalendarDashboard';
import Form from '@components/Form/Form';
import ValidationError from '@components/ValidationError/ValidationError';
import { sanitizeExtraFeeMap } from '@helpers/menuExtraFee';
import { foodByDatesAtLeastOneDayHasFood } from '@src/utils/validators';
import { IntegrationListing } from '@utils/data';
import type { TIntegrationListing } from '@utils/types';

import AddFoodModal from '../AddFoodModal/AddFoodModal';
import CalendarContentEnd from '../CalendarContentEnd/CalendarContentEnd';
import CalendarContentStart from '../CalendarContentStart/CalendarContentStart';
import { renderResourcesForCalendar } from '../EditPartnerMenuWizard/utils';
import FoodEventCard from '../FoodEventCard/FoodEventCard';

import css from './EditMenuPricingForm.module.scss';

export type TEditMenuPricingFormValues = {
  foodsByDate: any;
  checkAll: string[];
  rowCheckbox: string[];
  [id: string]: any;
};

type TExtraProps = {
  currentMenu: TIntegrationListing;
  formRef: any;
  restaurantId: string;
  anchorDate: Date;
  isReadOnly?: boolean;
  // Admin only: the card reveals the client price, i.e. PITO's extra fee.
  // PartnerMenuWizard reuses this form and must never turn it on.
  showPrice?: boolean;
};
type TEditMenuPricingFormComponentProps =
  FormRenderProps<TEditMenuPricingFormValues> & Partial<TExtraProps>;
type TEditMenuPricingFormProps = FormProps<TEditMenuPricingFormValues> &
  TExtraProps;

type TFoodResource = {
  title: string;
  sideDishes: string[];
  id: string;
  price: number;
  foodNote?: string;
};

const HiddenField = (hiddenProps: any) => {
  const { input, meta: fieldMeta } = hiddenProps;

  return (
    <div className={css.imageRequiredWrapper}>
      <input {...input} />
      <ValidationError fieldMeta={fieldMeta} />
    </div>
  );
};

const EditMenuPricingFormComponent: React.FC<
  TEditMenuPricingFormComponentProps
> = (props) => {
  const [currentDate, setCurrentDate] = useState<number | null>();
  const {
    handleSubmit,
    currentMenu,
    values,
    form,
    formRef,
    anchorDate,
    isReadOnly,
    showPrice = false,
  } = props;

  useImperativeHandle(formRef, () => form);

  const onRemovePickedFood = (removeId: string, date: Date) => {
    if (isReadOnly) return;
    const currentDateAsTimestamp = date.getTime();
    const pickedFoodsOnDate = { ...values.foodsByDate[currentDateAsTimestamp] };
    Object.keys(pickedFoodsOnDate).forEach((keyId: string) => {
      if (removeId === keyId) {
        delete pickedFoodsOnDate[removeId];
        const newFoodsByDate = {
          ...values.foodsByDate,
          [currentDateAsTimestamp]: {
            ...pickedFoodsOnDate,
          },
        };

        form.change('foodsByDate', newFoodsByDate);
      }
    });
  };

  const { daysOfWeek = [], foodExtraFees } =
    IntegrationListing(currentMenu).getPublicData();

  const resourcesForCalendar = renderResourcesForCalendar(values.foodsByDate, {
    onRemovePickedFood,
    daysOfWeek,
    hideRemoveButton: isReadOnly,
    showPrice,
    extraFeeByFoodId: showPrice ? sanitizeExtraFeeMap(foodExtraFees) : {},
  });

  const onSetCurrentDate = (params: any) => () => {
    const { date, events } = params;
    if (isReadOnly) return;
    const dateAsTimeStaimp = new Date(date).getTime();
    setCurrentDate(dateAsTimeStaimp);
    const currentDayEvents = events.filter(
      (e: any) => new Date(e.start).getTime() === new Date(date).getTime(),
    );
    const listIds = currentDayEvents.map((e: any) => e.resource.id);
    const listIdsWithSideDishes = currentDayEvents.map((e: any) => e.resource);
    form.change('rowCheckbox', listIds);
    listIdsWithSideDishes.forEach(
      ({ id, sideDishes = [], foodNote }: TFoodResource) => {
        form.change(`${id}.foodNote`, foodNote);

        return form.change(`${id}.sideDishes`, sideDishes);
      },
    );
  };

  const onCloseModal = () => {
    setCurrentDate(null);
  };

  return (
    <>
      <Form onSubmit={handleSubmit}>
        <h2 className={css.title}>
          <FormattedMessage id="EditMenuPricingForm.pricingTitle" />
        </h2>
        {currentMenu && (
          <CalendarDashboard
            renderEvent={FoodEventCard}
            events={resourcesForCalendar}
            anchorDate={anchorDate}
            components={{
              toolbar: () => <></>,
              contentStart: (contentProps: any) => (
                <CalendarContentStart
                  {...contentProps}
                  currentMenu={currentMenu}
                  onSetCurrentDate={onSetCurrentDate}
                  isReadOnly={isReadOnly}
                />
              ),
              contentEnd: (contentProps: any) => (
                <CalendarContentEnd
                  {...contentProps}
                  currentMenu={currentMenu}
                />
              ),
            }}
          />
        )}
        <Field
          component={HiddenField}
          name="foodsByDate"
          type="hidden"
          validate={foodByDatesAtLeastOneDayHasFood(
            'Mỗi ngày cần có ít nhất 1 món ăn',
            daysOfWeek,
          )}
        />
      </Form>
      <AddFoodModal
        isOpen={!!currentDate}
        handleClose={onCloseModal}
        currentMenu={currentMenu as TIntegrationListing}
        values={values}
        form={form as unknown as FormApi}
        currentDate={currentDate}
        isReadOnly={isReadOnly}
      />
    </>
  );
};

const EditMenuPricingForm: React.FC<TEditMenuPricingFormProps> = (props) => {
  return <FinalForm {...props} component={EditMenuPricingFormComponent} />;
};

export default EditMenuPricingForm;
