import { useEffect, useState } from 'react';
import type { TBookerQuizData } from '@apiServices/user/quizData.service';
import classNames from 'classnames';

import {
  adminGetUserQuizDataApi,
  adminUpdateUserQuizDataApi,
} from '@apis/userApi';
import LoadingContainer from '@components/LoadingContainer/LoadingContainer';
import { buildFullName } from '@src/utils/emailTemplate/participantOrderPicking';
import { ECompanyPermission } from '@src/utils/enums';
import type { TCompanyMemberWithDetails } from '@utils/types';

import type { TBookerQuizFormValues } from './BookerQuizForm';
import BookerQuizForm from './BookerQuizForm';

import css from './EditBookerQuizTab.module.scss';

type TEditBookerQuizTabProps = {
  companyMembers: TCompanyMemberWithDetails[];
};

const toFormValues = (quizData: TBookerQuizData): TBookerQuizFormValues => ({
  packagePerMember:
    quizData.packagePerMember === undefined
      ? undefined
      : String(quizData.packagePerMember),
  memberAmount:
    quizData.memberAmount === undefined
      ? undefined
      : String(quizData.memberAmount),
  daySession: quizData.daySession,
  deliveryHour: quizData.deliveryHour,
  mealStyles: quizData.mealStyles || [],
  nutritions: quizData.nutritions || [],
  mealType: quizData.mealType || [],
});

const toPatch = (values: TBookerQuizFormValues): TBookerQuizData => ({
  packagePerMember: values.packagePerMember
    ? Number(values.packagePerMember)
    : undefined,
  memberAmount: values.memberAmount ? Number(values.memberAmount) : undefined,
  daySession: values.daySession || undefined,
  deliveryHour: values.deliveryHour || undefined,
  mealStyles: values.mealStyles,
  nutritions: values.nutritions,
  mealType: values.mealType,
});

const EditBookerQuizTab: React.FC<TEditBookerQuizTabProps> = ({
  companyMembers,
}) => {
  const bookers = companyMembers.filter(
    (member) =>
      !!member?.id?.uuid &&
      (member.permission === ECompanyPermission.booker ||
        member.permission === ECompanyPermission.owner),
  );

  const [selectedBookerId, setSelectedBookerId] = useState<string | null>(null);
  const [quizData, setQuizData] = useState<TBookerQuizData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedBookerId) return undefined;

    let cancelled = false;
    setFetching(true);
    adminGetUserQuizDataApi(selectedBookerId)
      .then(({ data }) => {
        if (!cancelled) setQuizData(data?.quizData || {});
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBookerId]);

  const handleSubmit = async (values: TBookerQuizFormValues) => {
    if (!selectedBookerId) return;

    setSubmitting(true);
    try {
      const { data } = await adminUpdateUserQuizDataApi(
        selectedBookerId,
        toPatch(values),
      );
      setQuizData(data?.quizData || {});
    } finally {
      setSubmitting(false);
    }
  };

  if (bookers.length === 0) {
    return (
      <div className={css.empty}>Công ty chưa có booker nào có tài khoản.</div>
    );
  }

  return (
    <div className={css.container}>
      <div className={css.bookerList}>
        {bookers.map((booker) => {
          const bookerId = booker.id!.uuid;

          return (
            <div
              key={bookerId}
              className={classNames(css.bookerItem, {
                [css.bookerItemActive]: bookerId === selectedBookerId,
              })}
              onClick={() => setSelectedBookerId(bookerId)}>
              {buildFullName(
                booker?.attributes?.profile?.firstName,
                booker?.attributes?.profile?.lastName,
                {
                  compareToGetLongerWith:
                    booker?.attributes?.profile?.displayName,
                },
              ) || booker.email}
            </div>
          );
        })}
      </div>

      {!selectedBookerId && (
        <div className={css.empty}>Chọn một booker để xem thông tin quiz.</div>
      )}

      {selectedBookerId && fetching && <LoadingContainer />}

      {selectedBookerId && !fetching && quizData && (
        <BookerQuizForm
          key={selectedBookerId}
          onSubmit={handleSubmit}
          initialValues={toFormValues(quizData)}
          inProgress={submitting}
        />
      )}
    </div>
  );
};

export default EditBookerQuizTab;
