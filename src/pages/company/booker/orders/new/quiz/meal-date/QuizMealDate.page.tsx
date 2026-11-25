import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';

import type { TDaySession } from '@components/CalendarDashboard/helpers/types';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { useViewport } from '@hooks/useViewport';
import { QuizActions } from '@redux/slices/Quiz.slice';
import { CurrentUser, User } from '@src/utils/data';
import { EOrderType, QuizStep } from '@src/utils/enums';
import { INITIAL_DELIVERY_TIME_BASE_ON_DAY_SESSION } from '@src/utils/options';

import QuizModal from '../components/QuizModal/QuizModal';
import QuizCreateOrderLoadingModal from '../create-order-loading/QuizCreateOrderLoadingModal';
import { useQuizFlow } from '../hooks/useQuizFlow';
import { useQuizModalScrollControl } from '../hooks/useQuizModalScrollControl';

import type { TMealDateFormValues } from './MealDateForm/MealDateForm';
import MealDateForm from './MealDateForm/MealDateForm';

import css from './QuizMealDate.module.scss';

type TQuizMealDateProps = {
  stepInfo?: string;
  firstTimeOrder?: boolean;
};

const QuizMealDate: React.FC<TQuizMealDateProps> = ({
  stepInfo,
  firstTimeOrder,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [formValues, setFormValues] = useState<TMealDateFormValues>(null!);
  const [formInvalid, setFormInvalid] = useState<boolean>(false);
  const quizData = useAppSelector((state) => state.Quiz.quiz, shallowEqual);
  const selectedCompany = useAppSelector((state) => state.Quiz.selectedCompany);
  const currentUser = useAppSelector((state) => state.user.currentUser);
  const previousOrder = useAppSelector((state) => state.Quiz.previousOrder);

  const {
    backStep,
    submitCreateOrder,
    creatingOrderInProgress,
    creatingOrderError,
    handleCloseQuizFlow,
  } = useQuizFlow(QuizStep.MEAL_DATE);
  const {
    modalContentRef,
    onClickOrderDates,
    onClickDeliveryHour,
    onClickIsGroupOrder,
  } = useQuizModalScrollControl();
  const { isMobileLayout } = useViewport();

  const { hasOrderBefore = false } = CurrentUser(currentUser!).getPrivateData();
  const hasPreviousOrder = previousOrder !== null;

  const quizFlowOpen = useAppSelector((state) => state.Quiz.quizFlowOpen);
  const { startDate, endDate, deadlineDate, daySession } = quizData;

  const modalTitle = intl.formatMessage(
    { id: 'QuizMealDate.title' },
    { companyName: User(selectedCompany).getPublicData().companyName },
  );

  const initialValues = useMemo(
    () => ({
      usePreviousData: hasPreviousOrder,
      startDate: startDate ? new Date(startDate).getTime() : undefined,
      endDate: endDate ? new Date(endDate).getTime() : undefined,
      dayInWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      orderType: EOrderType.group,
      deadlineDate: deadlineDate ? new Date(deadlineDate).getTime() : undefined,
      deliveryHour:
        INITIAL_DELIVERY_TIME_BASE_ON_DAY_SESSION[daySession as TDaySession] ||
        '',
    }),
    [hasPreviousOrder, deadlineDate, endDate, startDate, daySession],
  );

  const handleSubmitClick = async () => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const { startDate, endDate } = formValues;
    const normalizedFormValues = {
      ...formValues,
      startDate: new Date(startDate).getTime(),
      endDate: new Date(endDate).getTime(),
    };
    dispatch(QuizActions.updateQuiz(normalizedFormValues));

    submitCreateOrder(normalizedFormValues);
  };

  if (!isMobileLayout && creatingOrderInProgress) {
    return (
      <QuizCreateOrderLoadingModal creatingOrderError={creatingOrderError} />
    );
  }

  return (
    <QuizModal
      id="QuizMealDateModal"
      isOpen={quizFlowOpen}
      modalTitle={modalTitle}
      submitText={intl.formatMessage({ id: 'tim-nha-hang' })}
      onSubmit={handleSubmitClick}
      submitDisabled={formInvalid}
      modalContainerClassName={css.modalContainer}
      modalContentRef={modalContentRef}
      stepInfo={stepInfo}
      onBack={hasOrderBefore ? handleCloseQuizFlow : backStep}
      firstTimeOrder={firstTimeOrder}>
      <MealDateForm
        onSubmit={() => {}}
        hasPreviousOrder={hasPreviousOrder}
        setFormValues={setFormValues}
        setFormInvalid={setFormInvalid}
        initialValues={initialValues}
        daySession={daySession}
        onClickOrderDates={onClickOrderDates}
        onClickDeliveryHour={onClickDeliveryHour}
        onClickIsGroupOrder={onClickIsGroupOrder}
      />
      <RenderWhen condition={creatingOrderInProgress}>
        <QuizCreateOrderLoadingModal creatingOrderError={creatingOrderError} />
      </RenderWhen>
    </QuizModal>
  );
};

export default QuizMealDate;
