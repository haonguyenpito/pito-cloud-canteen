/* eslint-disable react-hooks/exhaustive-deps */
import { useMemo, useState } from 'react';
import compact from 'lodash/compact';
import isEmpty from 'lodash/isEmpty';

import ReviewCartSection from '@components/OrderDetails/ReviewView/ReviewCartSection/ReviewCartSection';
import ReviewOrderDetailsSection from '@components/OrderDetails/ReviewView/ReviewOrderDetailsSection/ReviewOrderDetailsSection';
import ReviewOrderDetailWithSecondaryFood from '@components/OrderDetails/ReviewView/ReviewOrderDetailWithSecondaryFood/ReviewOrderDetailWithSecondaryFood';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import Tabs from '@components/Tabs/Tabs';
import { calculatePriceQuotationInfoFromQuotation } from '@helpers/order/cartInfoHelper';
import { groupFoodOrderByDateFromQuotation } from '@helpers/order/orderDetailHelper';
import {
  ensureVATSetting,
  vatPercentageBaseOnVatSetting,
} from '@helpers/order/prepareDataHelper';
import { getIsAllowAddSecondaryFood } from '@helpers/orderHelper';
import { useDownloadPriceQuotation } from '@hooks/useDownloadPriceQuotation';
import { Listing } from '@src/utils/data';
import type { TListing, TObject, TUser } from '@src/utils/types';

import {
  formatPriceQuotationData,
  formatPriceQuotationDataPartner,
  prepareSingleDateFoodTableDataFromQuotation,
} from '../../helpers/AdminOrderDetail';

import css from './OrderQuotationDetail.module.scss';

type OrderQuotationDetailProps = {
  quotation?: TListing;
  target: 'client' | 'partner';
  orderDetail?: TObject;
  order: TListing;
  company: TUser;
  booker: TUser;
};
const OrderQuotationDetail: React.FC<OrderQuotationDetailProps> = (props) => {
  const { quotation, target, orderDetail, order, company, booker } = props;

  const isPartner = target === 'partner';
  const quotationMetadata = Listing(quotation!).getMetadata();

  const clientQuotation = useMemo(
    () => quotationMetadata.client || {},
    [JSON.stringify(quotationMetadata.client)],
  );
  const partnerQuotation = useMemo(
    () => quotationMetadata.partner || {},
    [JSON.stringify(quotationMetadata.partner)],
  );
  const quotationDetail = useMemo(
    () => quotationMetadata[target] || {},
    [JSON.stringify(quotationMetadata), target],
  );

  const [currentSubOrderDate, setCrrSubOrderDate] = useState<string>(
    Object.keys(clientQuotation)[0],
  );

  const {
    serviceFees = {},
    vatSettings = {},
    packagePerMember = 0,
    hasSpecificPCCFee = false,
    specificPCCFee = 0,
    specificPCCFeeTiers,
    orderVATPercentage,
  } = Listing(order).getMetadata();
  const { title: orderTitle = '' } = Listing(order).getAttributes();

  const currentPartnerId = (Object.entries(partnerQuotation).find(
    ([, value]) => (value as TObject)?.quotation[currentSubOrderDate],
  ) || [])[0];
  const vatSettingFromOrder = vatSettings[currentPartnerId!];
  const partnerVATSetting = ensureVATSetting(vatSettingFromOrder);

  const partnerServiceFee = serviceFees[currentPartnerId!] || 0;
  const vatPercentage = vatPercentageBaseOnVatSetting({
    vatSetting: partnerVATSetting,
    vatPercentage: orderVATPercentage,
    isPartner,
  });

  const priceQuotation = useMemo(
    () =>
      calculatePriceQuotationInfoFromQuotation({
        quotation: quotation!,
        packagePerMember,
        orderVATPercentage,
        orderServiceFeePercentage: partnerServiceFee / 100,
        date: isPartner ? currentSubOrderDate : undefined,
        partnerId: currentPartnerId,
        vatSetting: partnerVATSetting,
        hasSpecificPCCFee,
        specificPCCFee,
        specificPCCFeeTiers,
        isPartner,
      }),
    [
      isPartner,
      hasSpecificPCCFee,
      specificPCCFee,
      JSON.stringify(specificPCCFeeTiers),
      partnerServiceFee,
      partnerVATSetting,
      orderVATPercentage,
      JSON.stringify(quotation),
      currentSubOrderDate,
      isPartner,
    ],
  );

  const handleTabChange = (tab: any) => {
    setCrrSubOrderDate(tab?.key);
  };

  const tabItems = useMemo(() => {
    if (isPartner) {
      const partnerQuotationEntries = Object.entries(quotationDetail);

      return compact(
        Object.keys(clientQuotation.quotation).reduce(
          (res: any[], subOrderDate: string) => {
            const partnerEntry = partnerQuotationEntries.find(
              ([_, value]) =>
                !isEmpty((value as TObject)?.quotation[subOrderDate]),
            );
            if (isEmpty(partnerEntry)) {
              return res;
            }

            const [partnerId] = partnerEntry!;
            const dayIndex = new Date(Number(subOrderDate)).getDay();

            return res.concat({
              key: subOrderDate,
              label: `${quotationDetail[partnerId].name} #${orderTitle}-${dayIndex}`,
              childrenFn: (childProps: any) => (
                <ReviewOrderDetailsSection {...childProps} />
              ),
              childrenProps: {
                foodOrderGroupedByDate:
                  prepareSingleDateFoodTableDataFromQuotation(
                    clientQuotation.quotation,
                    subOrderDate,
                  ),
                outsideCollapsible: true,
              },
            });
          },
          [],
        ),
      );
    }

    return [];
  }, [isPartner, quotationDetail]);

  const priceQuotationData = useMemo(() => {
    return isPartner
      ? formatPriceQuotationDataPartner({
          order,
          booker,
          company,
          priceQuotation,
          restaurantId: currentPartnerId!,
          quotationDetail,
          vatPercentage,
        })
      : formatPriceQuotationData({
          order,
          company,
          booker,
          priceQuotation,
          vatPercentage,
          quotation,
        });
  }, [
    currentPartnerId,
    JSON.stringify(order),
    JSON.stringify(booker),
    JSON.stringify(company),
    JSON.stringify(priceQuotation),
    JSON.stringify(quotationDetail),
    JSON.stringify(company),
    JSON.stringify(orderDetail),
  ]);

  const handleDownloadPriceQuotation = useDownloadPriceQuotation({
    orderTitle: Listing(order).getAttributes().title,
    priceQuotationData: priceQuotationData as any,
    isPartnerQuotation: isPartner,
    subOrderDate: isPartner ? currentSubOrderDate : undefined,
    vatSetting: partnerVATSetting,
  });

  const isSecondaryFoodAllowedOrder = getIsAllowAddSecondaryFood(order);

  return (
    <div className={css.container}>
      <div className={css.leftCol}>
        {isPartner ? (
          <Tabs
            items={tabItems as any}
            onChange={handleTabChange}
            defaultActiveKey="1"
            tabItemClassName={css.tabItem}
            tabActiveItemClassName={css.tabActiveItem}
          />
        ) : (
          <>
            <div className={css.clientTitle}>Báo giá khách hàng</div>
            <RenderWhen condition={isSecondaryFoodAllowedOrder}>
              <ReviewOrderDetailWithSecondaryFood
                foodOrderGroupedByDate={groupFoodOrderByDateFromQuotation({
                  quotation: quotation!,
                })}
              />
            </RenderWhen>
            <RenderWhen condition={!isSecondaryFoodAllowedOrder}>
              <ReviewOrderDetailsSection
                outsideCollapsible
                foodOrderGroupedByDate={groupFoodOrderByDateFromQuotation({
                  quotation: quotation!,
                })}
              />
            </RenderWhen>
          </>
        )}
      </div>
      <div className={css.rightCol}>
        <ReviewCartSection
          data={priceQuotation}
          onClickDownloadPriceQuotation={handleDownloadPriceQuotation}
          showStartPickingOrderButton={false}
          title="Thực đơn phục vụ"
          target={target}
          isAdminLayout
          vatSetting={isPartner ? partnerVATSetting : undefined}
        />
      </div>
    </div>
  );
};

export default OrderQuotationDetail;
