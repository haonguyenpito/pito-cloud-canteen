/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import classNames from 'classnames';
import isEmpty from 'lodash/isEmpty';

import RenderWhen from '@components/RenderWhen/RenderWhen';
import { addCommas } from '@helpers/format';
import {
  getPCCFeeByMemberAmount,
  getPCCFeeByTiers,
} from '@helpers/orderHelper';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import {
  orderAsyncActions,
  saveDraftEditOrder,
  setCanNotGoAfterFoodQuantity,
  setCanNotGoAfterOderDetail,
} from '@redux/slices/Order.slice';
import { Listing, User } from '@src/utils/data';
import type { TListing } from '@src/utils/types';

// eslint-disable-next-line import/no-cycle
import NavigateButtons, {
  EFlowType,
} from '../../components/NavigateButtons/NavigateButtons';
import PartnerFeeForm from '../../components/PartnerFeeForm/PartnerFeeForm';
import type { TPCCFormValues } from '../../components/PCCFeeForm/PCCForm';
import PCCForm from '../../components/PCCFeeForm/PCCForm';
import ServiceFeeAndNoteForm from '../../components/ServiceFeeAndNoteForm/ServiceFeeAndNoteForm';

import css from './ServiceFeesAndNotes.module.scss';

const INITIAL_NOTE = `- Đối tác vui lòng giao đúng giờ, vận chuyển và đựng thực phẩm đúng tiêu chuẩn, chuyên nghiệp và kín đáo.
- Chuẩn bị đầy đủ công cụ dụng cụ và định lượng phần ăn.
- Không để thực phẩm dưới đất.
- Thực hiện lưu mẫu theo quy định của Bộ VSATTP.
- Lưu ý các thông tin chi tiết trong đơn hàng.`;

type ServiceFeesAndNotesProps = {
  goBack: () => void;
  nextTab: () => void;
  nextToReviewTab?: () => void;
  flowType?: EFlowType;
};

const ServiceFeesAndNotes: React.FC<ServiceFeesAndNotesProps> = (props) => {
  const {
    goBack,
    nextTab,
    nextToReviewTab,
    flowType = EFlowType.createOrEditDraft,
  } = props;
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const formSubmitRef = useRef<any>();
  const PCCFeeFormSubmitRef = useRef<any>();
  const partnerFormSubmitRef = useRef<any>();
  const [partnerFormDisabled, setPartnerFormDisabled] = useState(false);

  const order = useAppSelector((state) => state.Order.order, shallowEqual);
  const orderDetail = useAppSelector(
    (state) => state.Order.orderDetail,
    shallowEqual,
  );
  const restaurantList = useAppSelector(
    (state) => state.Order.orderRestaurantList,
    shallowEqual,
  );
  const systemServiceFeePercentage = useAppSelector(
    (state) => state.SystemAttributes.systemServiceFeePercentage,
    shallowEqual,
  );
  const fetchOrderInProgress = useAppSelector(
    (state) => state.Order.fetchOrderInProgress,
  );
  const fetchOrderRestaurantListInProgress = useAppSelector(
    (state) => state.Order.fetchOrderRestaurantListInProgress,
  );
  const updateOrderInProgress = useAppSelector(
    (state) => state.Order.updateOrderInProgress,
  );

  const currentClient = useAppSelector(
    (state) => state.Order.selectedCompany,
    shallowEqual,
  );
  const draftEditOrderDetail = useAppSelector(
    (state) => state.Order.draftEditOrderData.orderDetail,
  );
  const draftEditOrderData = useAppSelector(
    (state) => state.Order.draftEditOrderData.generalInfo,
  );

  const {
    memberAmount: draftMemberAmount,
    specificPCCFee: draftSpecificPCCFee,
    serviceFees: draftServiceFees = {},
    notes: draftNotes = {},
  } = draftEditOrderData;
  const orderListing = Listing(order);
  const {
    notes,
    serviceFees,
    memberAmount = 0,
    plans = [],
    hasSpecificPCCFee: orderHasSpecificPCCFee = false,
    specificPCCFee: orderSpecificPCCFee,
    specificPCCFeeTiers: orderSpecificPCCFeeTiers,
  } = orderListing.getMetadata();

  const isEditFlow = flowType === EFlowType.edit;
  const isLoading = fetchOrderInProgress || fetchOrderRestaurantListInProgress;

  const {
    hasSpecificPCCFee = false,
    specificPCCFee = 0,
    specificPCCFeeTiers,
  } = User(currentClient).getMetadata();

  const numberOfOrderDays = Object.keys(
    isEditFlow
      ? isEmpty(draftEditOrderDetail)
        ? orderDetail
        : draftEditOrderDetail
      : orderDetail,
  ).length;
  const initPCCFee =
    typeof draftSpecificPCCFee !== 'undefined'
      ? addCommas(draftSpecificPCCFee)
      : undefined;
  const headcount = draftMemberAmount || memberAmount;
  const PITOFee = isEditFlow
    ? (() => {
        if (!orderHasSpecificPCCFee) {
          return getPCCFeeByMemberAmount(headcount);
        }
        if (typeof draftSpecificPCCFee !== 'undefined') {
          return draftSpecificPCCFee;
        }
        if (orderSpecificPCCFeeTiers?.length) {
          return getPCCFeeByTiers(headcount, orderSpecificPCCFeeTiers);
        }
        return orderSpecificPCCFee ?? 0;
      })() * numberOfOrderDays
    : (() => {
        if (!hasSpecificPCCFee) {
          return getPCCFeeByMemberAmount(memberAmount);
        }
        if (specificPCCFeeTiers?.length) {
          return getPCCFeeByTiers(memberAmount, specificPCCFeeTiers);
        }
        return specificPCCFee;
      })() * numberOfOrderDays;
  const formattedPCCFee = addCommas(PITOFee.toString());

  const restaurantOptions = restaurantList.map((restaurant: TListing) => ({
    label: Listing(restaurant).getAttributes().title,
    key: Listing(restaurant).getId(),
  }));

  useEffect(() => {
    if (isEmpty(orderDetail)) {
      dispatch(orderAsyncActions.fetchOrderDetail(plans));
    }
  }, [JSON.stringify(order), JSON.stringify(orderDetail)]);

  useEffect(() => {
    dispatch(orderAsyncActions.fetchOrderRestaurants({ isEditFlow: false }));
  }, [JSON.stringify(orderDetail)]);

  const handleNoteFormSubmit = async (values: any) => {
    const newNotes = Object.keys(values).reduce((result, note) => {
      if (note.startsWith('note-')) {
        return {
          ...result,
          [note.replace('note-', '')]: values[note],
        };
      }

      return result;
    }, {});

    if (isEditFlow) {
      dispatch(
        saveDraftEditOrder({
          generalInfo: {
            notes: newNotes,
          },
        }),
      );
    } else {
      await dispatch(
        orderAsyncActions.updateOrder({
          generalInfo: {
            notes: newNotes,
          },
        }),
      );
    }
  };

  const handlePartnerFeeFormSubmit = async (values: any) => {
    const newPartnerFees = Object.keys(values).reduce((result, fee) => {
      if (fee.startsWith('partnerFee-')) {
        return {
          ...result,
          [fee.replace('partnerFee-', '')]: +values[fee],
        };
      }

      return result;
    }, {});

    if (isEditFlow) {
      dispatch(
        saveDraftEditOrder({
          generalInfo: {
            serviceFees: newPartnerFees,
          },
        }),
      );
    } else {
      await dispatch(
        orderAsyncActions.updateOrder({
          generalInfo: {
            serviceFees: newPartnerFees,
          },
        }),
      );
    }
  };

  const handlePCCFeeSubmit = async (values: TPCCFormValues) => {
    if (!isEmpty(values.PCCFee)) {
      dispatch(
        saveDraftEditOrder({
          generalInfo: {
            specificPCCFee: parseInt(values.PCCFee.replace(/,/g, ''), 10),
            hasSpecificPCCFee: true,
          },
        }),
      );
    } else {
      dispatch(
        saveDraftEditOrder({
          generalInfo: {
            specificPCCFee: undefined,
          },
        }),
      );
    }
  };

  const handleSubmitAllForms = async () => {
    await formSubmitRef?.current();
    await partnerFormSubmitRef?.current();

    if (typeof PCCFeeFormSubmitRef?.current === 'function')
      await PCCFeeFormSubmitRef?.current();
  };

  const handleNextTabInEditMode = async () => {
    dispatch(setCanNotGoAfterOderDetail(false));
    dispatch(setCanNotGoAfterFoodQuantity(false));
    await handleSubmitAllForms();
    nextTab();
  };
  const handleNextToReviewTabInEditMode = async () => {
    await handleSubmitAllForms();
    if (nextToReviewTab) nextToReviewTab();
  };

  const partnerFormInitialValues = useMemo(() => {
    return restaurantList.reduce((result: any, restaurant: TListing | null) => {
      const restaurantListing = Listing(restaurant);
      const restaurantId = restaurantListing.getId();

      return {
        ...result,
        [`partnerFee-${restaurantId}`]:
          draftServiceFees?.[restaurantId] ||
          serviceFees?.[restaurantId] ||
          systemServiceFeePercentage * 100 ||
          0,
      };
    }, {});
  }, [
    JSON.stringify(restaurantList),
    JSON.stringify(serviceFees),
    JSON.stringify(draftServiceFees),
    systemServiceFeePercentage,
  ]);
  const noteInitialValues = useMemo(
    () =>
      restaurantList.reduce((result, restaurant) => {
        const restaurantId = Listing(restaurant).getId();

        return {
          ...result,
          [`note-${restaurantId}`]:
            draftNotes?.[restaurantId] || notes?.[restaurantId] || INITIAL_NOTE,
        };
      }, {}),
    [
      JSON.stringify(notes),
      JSON.stringify(restaurantList),
      JSON.stringify(draftNotes),
    ],
  );
  const initialValues = useMemo(
    () => ({
      restaurant: restaurantList?.[0]?.id?.uuid,
      ...noteInitialValues,
    }),
    [noteInitialValues, restaurantList],
  );

  return (
    <div className={css.container}>
      <RenderWhen condition={isLoading}>
        <div className={css.loading}>
          {intl.formatMessage({ id: 'ServiceFeesAndNotes.loading' })}
        </div>

        <RenderWhen.False>
          <div className={css.mainLayout}>
            <div className={css.leftCol}>
              <ServiceFeeAndNoteForm
                onSubmit={handleNoteFormSubmit}
                initialValues={initialValues}
                restaurantOptions={restaurantOptions}
                formSubmitRef={formSubmitRef}
              />
            </div>
            <div className={css.rightCol}>
              <div className={css.pccFee}>
                <h3>
                  {intl.formatMessage({ id: 'ServiceFeesAndNotes.PITOFee' })}
                </h3>
                <div className={css.feeRow}>
                  <div className={css.feeLabel}>PITO</div>
                  <RenderWhen condition={isEditFlow}>
                    <PCCForm
                      initialValues={{ PCCFee: initPCCFee }}
                      onSubmit={handlePCCFeeSubmit}
                      PCCFeePlaceholder={formattedPCCFee}
                      formSubmitRef={PCCFeeFormSubmitRef}
                    />

                    <RenderWhen.False>
                      <div className={classNames(css.price, css.vnd)}>
                        {formattedPCCFee}
                      </div>
                    </RenderWhen.False>
                  </RenderWhen>
                </div>
              </div>
              <div className={css.serviceFee}>
                <h3>
                  {intl.formatMessage({ id: 'ServiceFeesAndNotes.serviceFee' })}
                </h3>
                <PartnerFeeForm
                  onSubmit={handlePartnerFeeFormSubmit}
                  initialValues={partnerFormInitialValues}
                  restaurantList={restaurantList}
                  formSubmitRef={partnerFormSubmitRef}
                  setPartnerFormDisabled={setPartnerFormDisabled}
                />
              </div>
            </div>
          </div>

          <NavigateButtons
            goBack={goBack}
            onNextClick={handleNextTabInEditMode}
            onCompleteClick={handleNextToReviewTabInEditMode}
            flowType={flowType}
            submitDisabled={partnerFormDisabled}
            inProgress={updateOrderInProgress}
          />
        </RenderWhen.False>
      </RenderWhen>
    </div>
  );
};

export default ServiceFeesAndNotes;
