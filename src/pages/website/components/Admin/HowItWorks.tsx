import React from 'react';
import { PiCalendarCheck, PiUsersThree } from 'react-icons/pi';
import { useIntl } from 'react-intl';

const HowItWorks = () => {
  const intl = useIntl();

  return (
    <div className="flex flex-col w-full gap-6 md:gap-20 relative md:mb-36 mb-20 max-w-[1024px] mx-auto px-5 md:px-0">
      <h2 className="font-alt font-semibold font-[unbounded] text-2xl md:text-[40px] leading-tight">
        {intl.formatMessage({ id: 'how-it-works' })}
      </h2>
      <div className="flex flex-col items-center w-full gap-8 md:gap-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-[60px]">
          <div className="col-span-1 flex flex-col gap-[10px] md:gap-5 justify-center">
            <div className="flex flex-row gap-3 md:gap-5 items-center">
              <div className="size-8 md:size-11 text-xl md:text-2xl flex items-center justify-center shrink-0 rounded-full text-[#96A546] bg-[#C5D475]/50">
                <PiCalendarCheck />
              </div>
              <h3 className="text-[20px] md:text-[28px]text-left font-bold">
                {intl.formatMessage({ id: 'plan-once-set-and-forget-1' })}
              </h3>
            </div>
            <p className="text-base md:text-[22px] font-normal  ">
              {intl.formatMessage({
                id: 'the-booker-your-teams-meal-coordinator-selects-the-vendors-and-weekly-menu-no-more-daily-decisions-or-zalo-messages-1',
              })}
            </p>
          </div>
          <div className="col-span-1 relative w-full aspect-auto md:aspect-[12/7]">
            <div className="relative w-full aspect-video rounded-md overflow-hidden border border-neutral-200">
              <video
                src="https://pito-test-bucket.s3.ap-southeast-2.amazonaws.com/he-thong-tu-de-xuat-menu.mp4"
                autoPlay
                muted
                loop
                controls
                playsInline
                className="absolute top-0 left-0 w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-[60px]">
          <div className="order-2 md:order-1 col-span-1 relative w-full aspect-auto md:aspect-[12/7]">
            <div className="relative w-full aspect-video rounded-md overflow-hidden border border-neutral-200">
              <video
                src="https://pito-test-bucket.s3.ap-southeast-2.amazonaws.com/nhan-vien-tu-dong-chon-mon.mp4"
                autoPlay
                muted
                loop
                controls
                playsInline
                className="absolute top-0 left-0 w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="order-1 md:order-2 col-span-1 flex flex-col gap-[10px] md:gap-5 justify-center">
            <div className="flex flex-row gap-3 md:gap-5 items-center">
              <div className="size-8 md:size-11 text-xl md:text-2xl flex items-center justify-center shrink-0 rounded-full text-[#D680A3] bg-[#FBD7E7]/50">
                <PiUsersThree />
              </div>
              <span className="text-[20px] md:text-[28px] text-left font-bold">
                {intl.formatMessage({ id: 'let-your-team-choose-1' })}
              </span>
            </div>
            <p className="text-base md:text-[22px] font-normal  ">
              {intl.formatMessage({
                id: 'employees-receive-app-notifications-to-pre-select-their-meals-just-one-tap-and-the-whole-weeks-menu-is-set-1',
              })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-[60px]">
          <div className="col-span-1 flex flex-col gap-[10px] md:gap-5 justify-center">
            <div className="flex flex-row gap-3 md:gap-5 items-center">
              <div className="size-8 md:size-11 text-xl md:text-2xl flex items-center justify-center shrink-0 rounded-full text-[#3598BF] bg-[#C4ECFB]/50">
                <PiCalendarCheck />
              </div>
              <span className="text-[20px] md:text-[28px] text-left font-bold">
                {intl.formatMessage({ id: 'meals-delivered-where-you-want-1' })}
              </span>
            </div>
            <p className="text-base md:text-[22px] font-normal">
              {intl.formatMessage({
                id: 'no-calls-no-confusion-our-delivery-agents-team-sets-up-meals-at-the-designated-drop-off-point-all-fully-contactless-1',
              })}
            </p>
          </div>
          <div className="col-span-1 relative w-full aspect-auto md:aspect-[12/7]">
            <div className="relative w-full aspect-video rounded-md overflow-hidden border border-neutral-200">
              <video
                src="https://pito-test-bucket.s3.ap-southeast-2.amazonaws.com/giao-va-setup-tan-noi.mp4"
                autoPlay
                muted
                loop
                controls
                playsInline
                className="absolute top-0 left-0 w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
