import { FormattedMessage, useIntl } from 'react-intl';
import { DateTime } from 'luxon';
import Image from 'next/image';
import { useRouter } from 'next/router';

import Button from '@components/Button/Button';
import useSelectDay from '@components/CalendarDashboard/hooks/useSelectDay';
import IconCheckWithBackground from '@components/Icons/IconCheckWithBackground/IconCheckWithBackground';
import Modal from '@components/Modal/Modal';
import { participantPaths } from '@src/paths';
import { VNTimezone } from '@src/utils/dates';

import css from './SectionOrderPanel.module.scss';

type TThankYouModal = {
  isOpen: boolean;
  handleClose: () => void;
};

const ThankYouModal: React.FC<TThankYouModal> = ({ isOpen, handleClose }) => {
  const intl = useIntl();
  const router = useRouter();
  const { handleSelectDay } = useSelectDay();
  const { orderDay } = router.query;

  const goToHomePage = () => {
    const orderDate = DateTime.fromMillis(Number(orderDay)).setZone(VNTimezone);
    handleSelectDay(orderDate.toJSDate());
    router.push(participantPaths.OrderList);
  };

  return (
    <Modal
      id="ParticipantThankYouModal"
      isOpen={isOpen}
      handleClose={handleClose}
      containerClassName={css.thankYouModalContainer}
      scrollLayerClassName={css.thankYouScrollLayer}
      shouldHideIconClose
      customHeader={
        <div className={css.thankYouHeader}>
          <div className={css.thankYouHeaderImageWrapper}>
            <Image
              src="/static/employee.png"
              alt="PITO Cloud Canteen team"
              width={800}
              height={363}
              className={css.thankYouHeaderImage}
            />
          </div>
          <IconCheckWithBackground className={css.thankYouCheckBadge} />
        </div>
      }
      shouldFullScreenInMobile={false}>
      <div className={css.thankYouBody}>
        <Image
          src="/static/decorator-green.png"
          alt="decorator"
          width={220}
          height={220}
          className={css.thankYouDecoratorGreen}
        />
        <div className={css.thankYouTitle}>
          {intl.formatMessage({ id: 'SectionOrderPanel.thankYouModal.title' })}
        </div>
        <p className={css.thankYouDescription}>
          <FormattedMessage
            id="SectionOrderPanel.thankYouModal.description"
            values={{
              b: (chunks: React.ReactNode) => <b>{chunks}</b>,
              br: () => <br />,
            }}
          />
        </p>
        <div className={css.thankYouLogoRow}>
          <Image
            src="/static/from-pcc-with-love.png"
            alt="from PITO Cloud Canteen with love"
            width={100}
            height={22}
            className={css.thankYouFooterLogo}
          />
        </div>
        <div className={css.thankYouActionsRow}>
          <Button className={css.thankYouGoToHomePage} onClick={goToHomePage}>
            {intl.formatMessage({
              id: 'SectionOrderPanel.successModal.goToHomePage',
            })}
          </Button>
        </div>
        <Image
          src="/static/loading-asset-2.png"
          alt="healthier"
          width={64}
          height={64}
          className={css.thankYouBadgeLeft}
        />
        <Image
          src="/static/loading-asset-3.png"
          alt="happier"
          width={64}
          height={64}
          className={css.thankYouBadgeRight}
        />
      </div>
    </Modal>
  );
};

export default ThankYouModal;
