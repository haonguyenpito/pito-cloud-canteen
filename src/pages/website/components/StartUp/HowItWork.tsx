import React from 'react';
import { useIntl } from 'react-intl';

const HowItWorks = () => {
  const intl = useIntl();

  return (
    <div className="flex flex-col w-full gap-8 md:gap-20 relative md:my-36 my-20 max-w-[1024px] mx-auto px-5 md:px-0">
      {/* main hero section */}
      <h2 className="font-alt font-semibold font-[unbounded] text-2xl md:text-[40px] leading-tight">
        {intl.formatMessage({ id: 'how-it-works-2' })}
      </h2>
      <div className="flex flex-col items-center w-full gap-8 md:gap-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-[60px]">
          <div className="col-span-1 flex flex-col gap-[10px] md:gap-5 justify-center">
            <div className="flex flex-col gap-2 md:gap-5 items-start">
              <div
                className="
            md:size-[80px] size-11 flex items-center justify-center rounded-full bg-[#6CCFF6] md:text-4xl text-base text-white font-semibold">
                01
              </div>
              <span className="text-[20px] md:text-[28px] text-left font-bold">
                {intl.formatMessage({
                  id: 'set-up-your-meal-schedule-and-automatically-select-menus-for-the-whole-week',
                })}
              </span>
            </div>
            <p className="text-base md:text-[22px] font-normal  ">
              {intl.formatMessage({
                id: 'admin-booker-chooses-from-100-partner-restaurants-on-the-system-one-restaurant-per-day',
              })}
            </p>
          </div>
          <div className="grid-cols-1 relative w-full aspect-[12/7] flex items-center">
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
          <div className="order-2 md:order-1 grid-cols-1 relative w-full aspect-[12/7] flex items-center">
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
          <div className="order-1 md:order-2 col-span-1 flex flex-col gap-3 md:gap-5 justify-center">
            <div className="flex flex-col gap-2 md:gap-5 items-start">
              <div
                className="
            md:size-[80px] size-11 flex items-center justify-center rounded-full bg-[#C5D475] md:text-4xl text-base text-white font-semibold">
                02
              </div>
              <span className="text-[20px] md:text-[28px] text-left font-bold">
                {intl.formatMessage({
                  id: 'employees-choose-their-favorite-dishes-with-just-a-few-clicks',
                })}
              </span>
            </div>
            <p className="text-base md:text-[22px] font-normal  ">
              {intl.formatMessage({
                id: 'employees-select-meals-via-app-web-dietary-preferences-and-allergies-are-automatically-suggested',
              })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-[60px]">
          <div className="col-span-1 flex flex-col gap-3 md:gap-5 justify-center">
            <div className="flex flex-col gap-2 md:gap-5 items-start">
              <div
                className="
            md:size-[80px] size-11 flex items-center justify-center rounded-full bg-[#F6AFCE] md:text-4xl text-base text-white font-semibold">
                03
              </div>
              <span className="text-[20px] md:text-[28px] text-left font-bold">
                {intl.formatMessage({
                  id: 'meals-delivered-where-you-want',
                })}
              </span>
            </div>
            <p className="text-base md:text-[22px] font-normal  ">
              {intl.formatMessage({
                id: 'no-calls-no-confusion-our-delivery-agents-team-sets-up-meals-at-the-designated-drop-off-point-fully-contactless',
              })}
            </p>
          </div>
          <div className="col-span-1 relative w-full aspect-[12/7] flex items-center">
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
