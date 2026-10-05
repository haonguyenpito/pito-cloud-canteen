/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useField, useForm } from 'react-final-form-hooks';
import { useIntl } from 'react-intl';
import { debounce } from 'lodash';
import difference from 'lodash/difference';
import isEmpty from 'lodash/isEmpty';

import Button from '@components/Button/Button';
import { FieldDropdownSelectComponent } from '@components/FormFields/FieldDropdownSelect/FieldDropdownSelect';
import { FieldTextAreaComponent } from '@components/FormFields/FieldTextArea/FieldTextArea';
import IconAdd from '@components/Icons/IconAdd/IconAdd';
import SlideModal from '@components/SlideModal/SlideModal';
import { buildLineItem } from '@helpers/orderHelper';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import useBoolean from '@hooks/useBoolean';
import { saveDraftEditOrder } from '@redux/slices/Order.slice';
import {
  orderDetailsAnyActionsInProgress,
  OrderManagementsAction,
  orderManagementThunks,
} from '@redux/slices/OrderManagement.slice';
import { Listing } from '@src/utils/data';
import { EOrderStates } from '@src/utils/enums';
import type { TListing, TObject } from '@src/utils/types';

import { LineItemsTableComponent } from './LineItemsTableComponent';

import css from './LineItemsTable.module.scss';

const DEBOUNCE_TIME = 500;

type TLineItemsTableProps = {
  currentViewDate: number;
  isDraftEditing?: boolean;
  ableToUpdateOrder?: boolean;
  isAdminFlow?: boolean;
  errorSection?: React.ReactNode;
};

const LineItemsTable: React.FC<TLineItemsTableProps> = (props) => {
  const {
    currentViewDate,
    isDraftEditing = false,
    ableToUpdateOrder = true,
    isAdminFlow = false,
    errorSection,
  } = props;
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const addFoodModalControl = useBoolean();
  const inProgress = useAppSelector(orderDetailsAnyActionsInProgress);
  const planData = useAppSelector((state) => state.OrderManagement.planData);
  const draftOrderDetail = useAppSelector(
    (state) => state.OrderManagement.draftOrderDetail,
  );
  const draftEditOrderData = useAppSelector(
    (state) => state.Order.draftEditOrderData,
  );
  const order = useAppSelector((state) => state.Order.order);
  const [updateValues, setUpdateValues] = useState<any>();
  const { orderState } = Listing(order).getMetadata();
  const { orderDetail: draftOrderDetailFromOrder = {} } = draftEditOrderData;
  const isOrderInProgressState = orderState === EOrderStates.inProgress;

  const currentDraftOrderDetail = isOrderInProgressState
    ? draftOrderDetailFromOrder
    : draftOrderDetail;

  const planDataGetter = Listing(planData as TListing);
  const planId = planDataGetter.getId();
  const { orderId } = planDataGetter.getMetadata();
  const data = currentDraftOrderDetail[currentViewDate] || {};
  const { lineItems = [], restaurant = {} } = data as any;
  const { foodList = {} } = restaurant;

  const note = useMemo(() => data?.note || '', [currentViewDate]);
  const { form, handleSubmit } = useForm({
    initialValues: {
      note,
    },
    onSubmit: () => {},
  });
  const foodField = useField(`food`, form);
  const noteField = useField(`note`, form);

  const noteInput = {
    ...noteField.input,
    onBlur: () => {
      noteField.input.onBlur();
      const newValue = noteField.input.value;

      if (newValue === note) {
        return;
      }

      const currentViewData = {
        ...data,
        note: newValue,
      };

      const updateOrderDetail = {
        ...currentDraftOrderDetail,
        [currentViewDate]: currentViewData,
      };

      if (isOrderInProgressState) {
        dispatch(
          saveDraftEditOrder({
            orderDetail: updateOrderDetail,
          }),
        );
      }

      if (isDraftEditing) {
        dispatch(
          OrderManagementsAction.setDraftOrderDetails(updateOrderDetail),
        );
      } else {
        dispatch(
          orderManagementThunks.updatePlanOrderDetail({
            orderId,
            planId,
            orderDetail: updateOrderDetail,
          }),
        );
      }
    },
  };

  const foodOptions = useMemo(() => {
    return Object.entries<TObject>(foodList).reduce<
      { id: string; name: string }[]
    >((result, entry) => {
      const [foodId, foodData] = entry;

      const itemIndex = lineItems.findIndex((x: TObject) => x?.id === foodId);

      return itemIndex === -1
        ? result.concat({
            id: foodId as string,
            name: foodData?.foodName || '',
          })
        : result;
    }, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(foodList), JSON.stringify(lineItems)]);

  const parsedFoodOptions = foodOptions?.map((f) => ({
    label: f.name,
    key: f.id,
  }));

  const disabledSelectFood =
    inProgress || isEmpty(foodOptions) || !ableToUpdateOrder;
  const disabledAddLineItem =
    disabledSelectFood || isEmpty(foodField.input.value);

  const handleModifyQuantity =
    (foodId: string, quantity: number = 1) =>
    () => {
      const itemIndex = lineItems.findIndex((x: TObject) => x?.id === foodId);
      let newLineItems = lineItems;

      const food = foodList[foodId] || {};
      const { foodPrice, foodName } = food;

      if (itemIndex === -1) {
        newLineItems = newLineItems.concat(
          buildLineItem(foodId, food, quantity),
        );
      } else if (quantity === 0) {
        newLineItems = difference(lineItems, [lineItems[itemIndex]]);
      } else {
        const item = lineItems[itemIndex];
        const { unitPrice } = lineItems[itemIndex];
        const newLineItem = {
          ...item,
          price: unitPrice * quantity,
          quantity,
        };
        newLineItems = difference(lineItems, [lineItems[itemIndex]]);
        newLineItems = [
          ...newLineItems.slice(0, itemIndex),
          newLineItem,
          ...newLineItems.slice(itemIndex),
        ];
      }

      const updateOrderDetail = {
        ...currentDraftOrderDetail,
        [currentViewDate]: {
          ...data,
          lineItems: newLineItems,
        },
      };

      if (isOrderInProgressState) {
        dispatch(
          saveDraftEditOrder({
            orderDetail: updateOrderDetail,
          }),
        );
      }
      if (isDraftEditing) {
        setUpdateValues({
          newOrderDetail: updateOrderDetail,
          updateValues: {
            currentViewDate,
            foodName,
            foodPrice,
            quantity,
            foodId,
          },
          isAdminFlow,
        });
      } else {
        setUpdateValues({
          orderId,
          planId,
          orderDetail: updateOrderDetail,
        });
      }
    };

  const updateDataWithDebounce = useCallback(
    debounce((_updateValues: any) => {
      if (_updateValues) {
        if (isDraftEditing) {
          dispatch(
            OrderManagementsAction.setDraftOrderDetailsAndSubOrderChangeHistory(
              _updateValues,
            ),
          );
        } else {
          dispatch(orderManagementThunks.updatePlanOrderDetail(_updateValues));
        }

        setUpdateValues(undefined);
      }
    }, DEBOUNCE_TIME),
    [isDraftEditing],
  );

  const handleAddNewLineItem = () => {
    const foodId = foodField?.input?.value;

    if (foodId) {
      handleModifyQuantity(foodId)();

      if (foodField?.input?.onChange) {
        foodField.input.onChange('');
      }
    }
  };

  const addFoodField = (
    <div className={css.fieldRow}>
      <FieldDropdownSelectComponent
        id={`food`}
        name={`food`}
        className={css.fieldSelect}
        dropdownWrapperClassName={css.dropdownWrapper}
        options={parsedFoodOptions}
        disabled={disabledSelectFood}
        placeholder={intl.formatMessage({
          id: 'LineItemsTable.addFoodField.placeholder',
        })}
        meta={foodField.meta}
        input={foodField.input}
      />

      <Button onClick={handleAddNewLineItem} disabled={disabledAddLineItem}>
        {intl.formatMessage({
          id: 'LineItemsTable.addFoodField.buttonText',
        })}
      </Button>
    </div>
  );

  useEffect(() => {
    form.reset();
  }, [currentViewDate]);

  useEffect(() => {
    updateDataWithDebounce(updateValues);
  }, [JSON.stringify(updateValues)]);

  return (
    <div className={css.root}>
      <LineItemsTableComponent
        data={data}
        inputDisabled={isDraftEditing}
        onModifyQuantity={handleModifyQuantity}
        ableToUpdateOrder={ableToUpdateOrder}
        isAdminFlow={isAdminFlow}
      />
      <form onSubmit={handleSubmit}>
        <div className={css.fieldContainer}>
          <label className={css.fieldLabel}>
            {intl.formatMessage({ id: 'LineItemsTable.addFoodField.label' })}
          </label>
          {addFoodField}
        </div>

        {errorSection}

        <div className={css.fieldContainer}>
          <label className={css.fieldLabel} htmlFor="LineItemsTable.note">
            {intl.formatMessage({ id: 'LineItemsTable.addNoteField.label' })}
          </label>
          <FieldTextAreaComponent
            disabled={inProgress || !ableToUpdateOrder}
            id={`${currentViewDate}.note`}
            name={`note`}
            className={css.fieldNote}
            placeholder={intl.formatMessage({
              id: 'LineItemsTable.addNoteField.placeholder',
            })}
            meta={noteField.meta}
            input={noteInput}
          />
        </div>
        <SlideModal
          id="LineItemsTable.AddFoodSlideModal"
          modalTitle="Thêm món ăn"
          isOpen={addFoodModalControl.value}
          onClose={addFoodModalControl.setFalse}
          containerClassName={css.addFoodModalContainer}>
          {addFoodField}
        </SlideModal>
      </form>

      <Button
        className={css.addFoodButton}
        variant="inline"
        disabled={disabledSelectFood}
        onClick={addFoodModalControl.setTrue}>
        <IconAdd />
        <span>Thêm món ăn</span>
      </Button>
    </div>
  );
};

export default LineItemsTable;
