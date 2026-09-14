import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import { useRouter } from 'next/router';

import Dropdown from '@components/CompanyLayout/Dropdown/Dropdown';
import FeatureIcons from '@components/FeatureIcons/FeatureIcons';
import IconArrowHead from '@components/Icons/IconArrowHead/IconArrowHead';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import Tracker from '@helpers/tracker';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { useViewport } from '@hooks/useViewport';
import QuizFlow from '@pages/company/booker/orders/new/quiz/QuizFlow';
import { BookerCompaniesThunks } from '@redux/slices/BookerCompanies.slice';
import { companyPaths } from '@src/paths';
import { User } from '@utils/data';
import type { TUser } from '@utils/types';

import CompanyFooter from './CompanyFooter/CompanyFooter';
import CompanyHeaderWrapper from './CompanyHeaderWrapper/CompanyHeaderWrapper';
import CompanyMainContent from './CompanyMainContent/CompanyMainContent';
import CompanyNavBar from './CompanyNavBar/CompanyNavBar';
import CompanySidebar from './CompanySidebar/CompanySidebar';
import {
  shouldHideCompanyFooter,
  shouldHideHeaderPathnames,
  shouldShowCompanyNavBar,
  shouldShowFeatureHeader,
  shouldShowSidebar,
} from './companyLayout.helpers';

import css from './CompanyLayout.module.scss';

export const companySettingPaths = [
  companyPaths.Account,
  companyPaths.Members,
  companyPaths.GroupSetting,
  companyPaths.Logo,
  companyPaths.Nutrition,
];

const CompanyLayout: React.FC<PropsWithChildren> = (props) => {
  const intl = useIntl();
  const { children } = props;
  const router = useRouter();
  const dispatch = useAppDispatch();

  const companyList = useAppSelector(
    (state) => state.BookerCompanies.companies,
    shallowEqual,
  );
  const { isMobileLayout, isTabletLayout } = useViewport();
  const isDesktopLayout = !(isMobileLayout || isTabletLayout);
  const {
    query: { companyId },
    pathname,
  } = router;

  const showFeatureHeader = shouldShowFeatureHeader(pathname);
  const showSidebar = isDesktopLayout && shouldShowSidebar(pathname);
  const shouldHideFooter =
    isMobileLayout || isTabletLayout || shouldHideCompanyFooter(pathname);

  const assignedCompanies = companyList.reduce((result: any[], cur: TUser) => {
    return [
      ...result,
      {
        value: User(cur).getId(),
        label: intl.formatMessage({ id: 'CompanyLayout.company' }),
      },
    ];
  }, []);

  const [selectedAccount, setSelectedAccount] = useState<{
    value?: string;
    label?: string;
  }>({});
  const accountOptions = [
    {
      value: '',
      label: intl.formatMessage({ id: 'CompanyLayout.personalAccount' }),
    },
    ...assignedCompanies,
  ];

  // companyList loads async (fetchBookerCompanies) while `companyId` from the
  // route is already known — fall back to the route value so nav links don't
  // send `companyId: 'personal'` during that race.
  const routeCompanyId =
    typeof companyId === 'string' && companyId !== 'personal'
      ? companyId
      : undefined;
  const resolvedCompanyId = selectedAccount.value || routeCompanyId;

  const changePathnameByCompanyId = () => {
    if (companySettingPaths.includes(pathname)) {
      return pathname;
    }

    if (pathname === companyPaths.MembersDetail) {
      return companyPaths.Members;
    }

    if (pathname === companyPaths.GroupMemberDetail) {
      return companyPaths.GroupSetting;
    }

    return companyPaths.Account;
  };

  const featureHeaderData = [
    {
      key: 'cart',
      title: (
        <div className={css.headerTitle}>
          <FeatureIcons.Cart />
          <div className={css.title}>
            {intl.formatMessage({ id: 'CompanyLayout.order' })}
          </div>
        </div>
      ),
      query: { companyId: resolvedCompanyId || 'personal' },
      pathname: companyPaths.Home,
    },
    {
      key: 'order',
      title: (
        <div className={css.headerTitle}>
          <FeatureIcons.Box />
          <div className={css.title}>
            {intl.formatMessage({ id: 'CompanyLayout.orders' })}
          </div>
        </div>
      ),
      query: {
        ...(resolvedCompanyId
          ? { companyId: resolvedCompanyId }
          : { companyId: 'personal' }),
      },
      pathname: companyPaths.ManageOrders,
      shouldActivePathname: [companyPaths.OrderRating],
      onClick: () => {
        Tracker.track('booker:orders:view', {});
      },
    },
    {
      key: 'account',
      title: (
        <Dropdown
          customTitle={({ title, onMouseEnter, isDropdownOpen, isMobile }) => (
            <div onMouseEnter={onMouseEnter} className={css.headerTitleWrapper}>
              <div className={css.headerTitle}>
                <FeatureIcons.User />
                <div className={css.title} title={title}>
                  {intl.formatMessage({ id: 'CompanyLayout.account' })}
                </div>
              </div>
              {isMobile && (
                <IconArrowHead direction={isDropdownOpen ? 'right' : 'down'} />
              )}
            </div>
          )}
          options={accountOptions}
          selectedValue={selectedAccount}
          setSelectedValue={setSelectedAccount}
        />
      ),
      query: {
        ...(resolvedCompanyId
          ? { companyId: resolvedCompanyId }
          : { companyId: 'personal' }),
      },
      pathname: resolvedCompanyId ? changePathnameByCompanyId() : pathname,
    },
  ];

  const companyHeaderLinkData: any[] = [];

  useEffect(() => {
    dispatch(BookerCompaniesThunks.fetchBookerCompanies());
  }, [dispatch]);

  useEffect(() => {
    if (companyId && companyId !== 'personal') {
      const currentCompany = companyList.find(
        (_company) => User(_company).getId() === companyId,
      );
      setSelectedAccount({
        value: User(currentCompany!).getId(),
        label: User(currentCompany!).getPublicData().companyName,
      });
    }
  }, [companyId, companyList]);

  const companyName =
    companyId && companyId !== 'personal'
      ? User(
          companyList.find(
            (_company) => User(_company!).getId() === companyId,
          )!,
        ).getPublicData().companyName
      : intl.formatMessage({ id: 'CompanyLayout.personalAccount' });

  return (
    <>
      <RenderWhen condition={!shouldHideHeaderPathnames.includes(pathname)}>
        <CompanyHeaderWrapper
          companyId={resolvedCompanyId || 'personal'}
          showFeatureHeader={showFeatureHeader}
          featureHeaderData={featureHeaderData}
          companyHeaderLinkData={companyHeaderLinkData}
        />
      </RenderWhen>

      {showSidebar && <CompanySidebar companyName={companyName!} />}

      <CompanyMainContent
        hasHeader={showFeatureHeader}
        hasSideBar={showSidebar}>
        {children}
      </CompanyMainContent>

      {!shouldHideFooter && <CompanyFooter />}

      <QuizFlow />

      <RenderWhen condition={shouldShowCompanyNavBar.includes(pathname)}>
        <CompanyNavBar />
      </RenderWhen>
    </>
  );
};

export default CompanyLayout;
