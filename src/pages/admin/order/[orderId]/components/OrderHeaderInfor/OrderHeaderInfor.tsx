import { useMemo } from 'react';
import { useField, useForm } from 'react-final-form-hooks';
import classNames from 'classnames';

import Button from '@components/Button/Button';
import { FieldTextInputComponent } from '@components/FormFields/FieldTextInput/FieldTextInput';
import { cn } from '@components/lib/utils';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import { Listing, User } from '@src/utils/data';
import { buildFullName } from '@src/utils/emailTemplate/participantOrderPicking';
import { EOrderStates } from '@src/utils/enums';
import type { TListing, TUser } from '@src/utils/types';

import css from './OrderHeaderInfor.module.scss';

type FormStaffNameValues = {
  pitoStaff: string;
};

type OrderHeaderInforProps = {
  containerClassName?: string;
  order: TListing;
  company: TUser;
  booker: TUser;
  updateStaffName?: (staffName: string) => void;
  updateOrderStaffNameInProgress?: boolean;
  updateStaffNameDisabled?: boolean;
};
const OrderHeaderInfor: React.FC<OrderHeaderInforProps> = (props) => {
  const {
    containerClassName,
    order,
    company,
    booker,
    updateStaffName,
    updateOrderStaffNameInProgress,
    updateStaffNameDisabled = false,
  } = props;
  const orderListing = Listing(order);
  const companyUser = User(company);
  const bookerUser = User(booker);

  const {
    deliveryAddress,
    deliveryHour,
    staffName = '',
    orderState,
  } = orderListing.getMetadata();

  const { companyName } = companyUser.getPublicData();
  const {
    lastName = '',
    firstName = '',
    displayName,
  } = bookerUser.getProfile();
  const bookerName = buildFullName(firstName, lastName, {
    compareToGetLongerWith: displayName,
  });
  const { phoneNumber: protetedphoneNumber } = bookerUser.getProtectedData();
  const { phoneNumber: publicPhoneNumber } = bookerUser.getPublicData();
  const phoneNumber = protetedphoneNumber || publicPhoneNumber;
  const { email: bookerEmail } = bookerUser.getAttributes();

  const isCanceledOrder = [
    EOrderStates.canceled,
    EOrderStates.canceledByBooker,
  ].includes(orderState);

  const formInitialValues = useMemo(
    () => ({
      pitoStaff: staffName,
    }),
    [staffName],
  );

  const { form, handleSubmit, pristine } = useForm<FormStaffNameValues>({
    onSubmit: (values: FormStaffNameValues) => {
      updateStaffName?.(values.pitoStaff);
    },
    initialValues: formInitialValues,
  });

  const onSaveStaffName = () => {
    handleSubmit();
  };

  const pitoStaffInput = useField('pitoStaff', form);

  const containerClasses = classNames(
    css.orderInforWrapper,
    containerClassName,
  );

  return (
    <div className={cn(containerClasses, 'p-0')}>
      <div className={css.title}>THÔNG TIN ĐẶT HÀNG</div>
      <ol className={css.infor}>
        <li>
          <div className={css.inforRow}>
            <div className={css.inforTitle}>Công ty</div>
            <div className={css.inforValue}>{companyName}</div>
          </div>
        </li>
        <li>
          <div className={css.inforRow}>
            <div className={css.inforTitle}>Địa chỉ giao hàng</div>
            <div className={css.inforValue}>{deliveryAddress?.address}</div>
          </div>
        </li>
        <li>
          <div className={css.inforRow}>
            <div className={css.inforTitle}>Thời gian giao hàng</div>
            <div className={css.inforValue}>{deliveryHour}</div>
          </div>
        </li>
        <li>
          <div className={css.inforRow}>
            <div className={css.inforTitle}>Người liên hệ</div>
            <div className={css.inforValue}>{bookerName}</div>
          </div>
        </li>
        <li>
          <div className={css.inforRow}>
            <div className={css.inforTitle}>Email</div>
            <div className={css.inforValue}>{bookerEmail}</div>
          </div>
        </li>
        <li>
          <div className={css.inforRow}>
            <div className={css.inforTitle}>Số điện thoại liên hệ*</div>
            <div className={css.inforValue}>{phoneNumber}</div>
          </div>
        </li>
        <li>
          <div className={css.inforRow}>
            <div className={css.inforTitle}>Nhân viên phụ trách</div>
            <div className={css.inforValue}>
              <RenderWhen condition={updateStaffNameDisabled}>
                <>{staffName}</>
                <RenderWhen.False>
                  <>
                    <FieldTextInputComponent
                      id="pitoStaff"
                      name="pitoStaff"
                      input={pitoStaffInput.input}
                      meta={pitoStaffInput.meta}
                      className={css.pitoStaffInput}
                      disabled={isCanceledOrder}
                    />
                    <Button
                      onClick={onSaveStaffName}
                      variant="primary"
                      inProgress={updateOrderStaffNameInProgress}
                      disabled={pristine || isCanceledOrder}>
                      Lưu
                    </Button>
                  </>
                </RenderWhen.False>
              </RenderWhen>
            </div>
          </div>
        </li>
      </ol>
    </div>
  );
};

export default OrderHeaderInfor;
