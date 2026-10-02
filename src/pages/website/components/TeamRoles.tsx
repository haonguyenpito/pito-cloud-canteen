import { useState } from 'react';
import { useIntl } from 'react-intl';
import Image from 'next/image';

import employee from '../assets/bua-trua-danh-cho-nhan-vien.webp';
import lemon from '../assets/decorations/lemon.svg';
import pink from '../assets/decorations/pink.svg';
import yellow from '../assets/decorations/yellow.svg';
import hr from '../assets/hr.webp';

import GoogleCalendarModal from './GoogleCalendarModal';

const TeamRoles = () => {
  const intl = useIntl();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="pt-16 md:px-0 flex flex-col items-center gap-7 max-w-[1024px] mx-auto">
      <h2 className="font-alt font-semibold font-[unbounded] text-2xl w-full text-center md:text-[40px] md:leading-[3rem] md:whitespace-pre-line">
        {intl.formatMessage({ id: 'built-for-every-role-in-your-team' })}
      </h2>
      <a
        href=""
        onClick={(e) => {
          e.preventDefault();
          setIsModalOpen(true);
        }}
        className="btn border font-[unbounded] font-medium border-solid border-black text-black hover:bg-black hover:text-white md:w-fit w-full">
        {intl.formatMessage({ id: 'book-free-consultation' })}
      </a>
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex justify-center items-center bg-black/20">
          <GoogleCalendarModal
            isModalOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
          />
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-5 w-full">
        {/* lhs */}
        <div className="relative flex flex-col pt-40 h-full">
          <div className="w-full h-80 absolute top-0 flex items-center justify-center">
            <div className="relative flex items-center justify-center size-full">
              <div className="relative h-full w-3/5 md:w-1/2 md:min-w-[240px] rounded-2xl overflow-hidden">
                <Image
                  style={{ objectFit: 'cover' }}
                  src={hr}
                  alt="HR"
                  className=" rounded-2xl"
                  fill
                  sizes="(max-width: 768px) 70vw, (max-width: 1200px) 33vw, 20vw"
                />
              </div>
              {/* decorations */}
              <Image
                src={lemon}
                alt="lemon triangle decor"
                className="absolute top-6 md:right-16 right-6 size-52 rotate-60 -z-10"
              />
              <Image
                src={yellow}
                alt="yellow triangle decor"
                className="absolute bottom-6 md:left-24 left-7 size-10 -rotate-60 -z-10"
              />
            </div>
          </div>
          <div className="border border-solid border-black/10 rounded-3xl bg-white p-5 pt-48 flex flex-col gap-3 -z-20 h-full">
            <h3 className="font-semibold text-lg">
              {intl.formatMessage({ id: 'for-hr' })} /{' '}
              {intl.formatMessage({ id: 'admins' })} /{' '}
              {intl.formatMessage({ id: 'office-managers' })}
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex gap-2">
                <div className="size-3.5 shrink-0 mt-1 rounded-sm bg-[#C5D475]"></div>
                <span className="font-medium">
                  {intl.formatMessage({
                    id: 'free-yourself-from-daily-lunch-logistics',
                  })}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="size-3.5 shrink-0 mt-1 rounded-sm bg-[#C5D475]"></div>
                <span className="font-medium">
                  {intl.formatMessage({
                    id: 'set-price-caps-per-meal-and-track-real-time-spend',
                  })}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="size-3.5 shrink-0 mt-1 rounded-sm bg-[#C5D475]"></div>
                <span className="font-medium">
                  {intl.formatMessage({
                    id: 'one-invoice-full-visibility-no-surprises',
                  })}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="size-3.5 shrink-0 mt-1 rounded-sm bg-[#C5D475]"></div>
                <span className="font-medium">
                  {intl.formatMessage({
                    id: 'save-hours-every-week-with-smart-automation',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* rhs */}
        <div className="relative flex flex-col pt-40 h-full">
          <div className="w-full h-80 absolute top-0 flex items-center justify-center">
            <div className="relative flex items-center justify-center size-full">
              <div className="relative h-full w-3/5 md:w-1/2 md:min-w-[240px] rounded-2xl overflow-hidden">
                <Image
                  style={{ objectFit: 'cover' }}
                  src={employee}
                  alt="bua-trua-danh-cho-nhan-vien"
                  className="rounded-2xl"
                  fill
                  sizes="(max-width: 768px) 70vw, (max-width: 1200px) 33vw, 20vw"
                />
              </div>
              {/* decorations */}
              <Image
                src={pink}
                alt="pink decor"
                className="absolute md:top-6 top-0 md:right-16 right-8 md:size-52 size-80 -rotate-110 -z-10"
              />
            </div>
          </div>
          <div className="border border-black/10 rounded-3xl bg-white p-5 pt-48 flex flex-col gap-3 -z-20 h-full">
            <h3 className="font-semibold text-lg">
              {intl.formatMessage({ id: 'for-employees' })} /{' '}
              {intl.formatMessage({ id: 'participants' })}
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex gap-2">
                <div className="size-3.5 shrink-0 mt-1 rounded-sm bg-[#F6AFCE]"></div>
                <span className="font-medium">
                  {intl.formatMessage({
                    id: 'choose-your-meals-from-rotating-curated-menus',
                  })}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="size-3.5 shrink-0 mt-1 rounded-sm bg-[#F6AFCE]"></div>
                <span className="font-medium">
                  {intl.formatMessage({ id: 'order-from-mobile-or-desktop' })}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="size-3.5 shrink-0 mt-1 rounded-sm bg-[#F6AFCE]"></div>
                <span className="font-medium">
                  {intl.formatMessage({
                    id: 'switch-vendors-weekly-to-avoid-food-fatigue',
                  })}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="size-3.5 shrink-0 mt-1 rounded-sm bg-[#F6AFCE]"></div>
                <span className="font-medium">
                  {intl.formatMessage({
                    id: 'grab-and-go-contactless-pickup-no-confusion',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamRoles;
