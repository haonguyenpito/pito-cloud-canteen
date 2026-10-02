import React, { useRef } from 'react';
import { PiCaretLeftLight, PiCaretRightLight } from 'react-icons/pi';
import { useIntl } from 'react-intl';
// @ts-expect-error ignore
import type { SplideRef } from '@splidejs/react-splide';
import { Splide, SplideSlide } from '@splidejs/react-splide';
import type { StaticImageData } from 'next/image';
import Image from 'next/image';

import avatar1 from '../assets/pfps/avatar1.png';
import avatar2 from '../assets/pfps/avatar2.png';
import avatar3 from '../assets/pfps/avatar3.png';
import avatar4 from '../assets/pfps/avatar4.png';
// import avatar5 from '../assets/pfps/avatar5.png';
import avatarKhanhDuy from '../assets/pfps/khanh-duy-workplace-manager.webp';
import company2 from '../assets/testimonialCompanyLogos/company2.svg';
import company3 from '../assets/testimonialCompanyLogos/company3.svg';
// import company5 from '../assets/testimonialCompanyLogos/company5.svg';
import company6 from '../assets/testimonialCompanyLogos/company6.svg';
import company7 from '../assets/testimonialCompanyLogos/company7.svg';

// Resolved via package.json "exports", which eslint-plugin-import cannot follow.
// eslint-disable-next-line import/no-unresolved
import '@splidejs/react-splide/css';

interface Testimonial {
  name: string;
  role: string;
  review: string;
  pfp: StaticImageData;
  companyLogo?: StaticImageData;
}

const Testimonials: React.FC = () => {
  const splideRef = useRef<SplideRef>(null);
  const intl = useIntl();

  const goNext = () => splideRef.current?.splide.go('+');
  const goPrev = () => splideRef.current?.splide.go('-');

  const testimonials: Testimonial[] = [
    {
      name: 'Mr. Duc Thang',
      role: intl.formatMessage({ id: 'team-leader' }),
      review: intl.formatMessage({
        id: 'thanks-to-pito-cloud-canteen-i-no-longer-have-to-overthink-lunch-planning-for-our-team-i-receive-helpful-meal-suggestions-and-ordering-support-along-with-clear-and-transparent-billing-for-every-order',
      }),
      pfp: avatar1,
      companyLogo: company6,
    },
    {
      name: 'Ms. Minh Trang',
      role: 'Administrator',
      review: intl.formatMessage({
        id: 'pito-cloud-canteen-recommends-restaurants-and-kitchens-that-perfectly-match-our-teams-taste-preferences-after-using-the-service-for-a-while-everyone-has-given-positive-feedback-and-is-very-satisfied-with-the-lunch-quality',
      }),
      pfp: avatar2,
      companyLogo: company2,
    },
    {
      name: 'Nhi Rubi',
      role: intl.formatMessage({ id: 'admin-officer' }),
      review: intl.formatMessage({
        id: 'pito-cloud-canteen-meals-are-neatly-and-hygienically-prepared-the-support-team-is-enthusiastic-and-always-provides-timely-assistance-to-customers',
      }),
      pfp: avatar3,
      companyLogo: company3,
    },
    {
      name: 'Ms. Diem Phuc',
      role: intl.formatMessage({ id: 'office-manager' }),
      review: intl.formatMessage({
        id: 'pito-cloud-canteen-meets-all-our-requirements-for-payment-invoicing-and-delivery-the-staff-are-professional-and-enthusiastic-deliveries-are-always-on-time-and-the-reusable-lunchboxes-are-neat-clean-and-free-from-plastic-waste',
      }),
      pfp: avatar4,
      companyLogo: company7,
    },
    {
      name: 'Mr. Khanh Duy',
      role: 'Workplace Manager',
      review: intl.formatMessage({
        id: 'pito-cloud-canteen-dashboard-helps-collect-orders-and-track-costs-without-manual-reporting',
      }),
      pfp: avatarKhanhDuy,
    },
  ];

  return (
    <div className="pt-16 pb-0 md:py-16">
      <div className="flex flex-col gap-10 md:gap-12 w-full">
        <div className="flex items-center justify-center relative md:px-0 px-5">
          <h2 className="relative font-semibold font-[unbounded] font-alt text-2xl md:text-[40px] md:text-start text-center">
            {intl.formatMessage({ id: 'what-hr-professionals-are-saying' })}

            <div className="md:flex gap-2 absolute top-1 -right-32 hidden text-lg">
              <button
                onClick={goPrev}
                className="bg-white border border-solid border-black/10 rounded-lg p-2 hover:bg-black hover:text-white transition-all duration-300 ease-in-out cursor-pointer"
                aria-label="Previous slide">
                <PiCaretLeftLight />
              </button>
              <button
                onClick={goNext}
                className="bg-white border border-solid border-black/10 rounded-lg p-2 hover:bg-black hover:text-white transition-all duration-300 ease-in-out cursor-pointer"
                aria-label="Next slide">
                <PiCaretRightLight />
              </button>
            </div>
          </h2>
        </div>
        <Splide
          ref={splideRef}
          options={{
            type: 'loop', // enables autoplay to loop properly
            perPage: 3,
            gap: '1.5rem',
            arrows: false,
            autoplay: true,
            padding: '5rem',
            updateOnMove: true,
            focus: 'center',
            pagination: false,
            breakpoints: {
              1024: {
                perPage: 1,
                padding: '2rem',
                gap: '0.8rem',
              },
              640: {
                perPage: 1,
                padding: '2rem',
                gap: '0.8rem',
              },
            },
          }}>
          {testimonials.map((testimonial, index) => {
            const colorHolders = [
              '#CDEBFA',
              '#FCE9B6',
              '#E9EDCD',
              '#F7E1EB',
              '#E9EDCD',
            ];
            const currentcOlor = colorHolders[index % colorHolders.length];

            return (
              <SplideSlide
                key={index}
                className="group w-[400px] max-w-[400px]">
                <div
                  className="rounded-2xl p-6 flex flex-col justify-between gap-4 h-full"
                  style={{ backgroundColor: currentcOlor }}>
                  <p className="flex-1 font-normal">{testimonial.review}</p>
                  <div className="w-full h-[1px] bg-[#D7D7D7] " />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative w-12 aspect-square">
                        <Image
                          src={testimonial.pfp}
                          alt={testimonial.name}
                          className="rounded-full object-cover"
                          sizes="60px"
                          fill
                          quality={100}
                        />
                      </div>

                      <div>
                        <div className="font-semibold">{testimonial.name}</div>
                        <div className="text-sm  group-[.is-active]:">
                          {testimonial.role}
                        </div>
                      </div>
                    </div>
                    {testimonial.companyLogo && (
                      <div className="relative aspect-square w-[100px]">
                        <Image
                          src={testimonial.companyLogo}
                          alt="company"
                          fill
                          sizes="150px"
                          quality={100}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </SplideSlide>
            );
          })}
        </Splide>
        <div className="flex gap-2 items-center justify-center md:hidden">
          <button
            onClick={goPrev}
            className="bg-white border border-solid border-black/10 rounded-lg p-2 hover:bg-black hover:text-white transition-all duration-300 ease-in-out cursor-pointer"
            aria-label="Previous slide">
            <PiCaretLeftLight />
          </button>
          <button
            onClick={goNext}
            className="bg-white border border-solid border-black/10 rounded-lg p-2 hover:bg-black hover:text-white transition-all duration-300 ease-in-out cursor-pointer"
            aria-label="Next slide">
            <PiCaretRightLight />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Testimonials;
