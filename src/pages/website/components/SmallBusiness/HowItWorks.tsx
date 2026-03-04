import { useIntl } from 'react-intl';
import Image from 'next/image';

import blueTriangle from '../../assets/decorations/blueTriangle.svg';
import lemon from '../../assets/decorations/lemon.svg';
import pink from '../../assets/decorations/pink.svg';
import pinkAlt from '../../assets/decorations/pinkAlt.svg';
import yellow from '../../assets/decorations/yellow.svg';
import yellowTriangle from '../../assets/decorations/yellowTriangle.svg';

export const HowItWorksSteps = ({
  step1Title = '',
  step2Title = '',
  step3Title = '',
  step1Description = '',
  step2Description = '',
  step3Description = '',
}: {
  step1Title?: string;
  step2Title?: string;
  step3Title?: string;
  step1Description?: string;
  step2Description?: string;
  step3Description?: string;
}) => {
  return (
    <div className="flex flex-col items-center md:gap-40 gap-20 w-full md:mt-20 mt-10">
      {/* step 1 */}
      <div className="flex md:flex-row flex-col md:gap-32 gap-10 justify-between">
        {/* lhs */}
        <div className="flex pt-12 flex-col md:items-start md:text-start items-center text-center md:gap-5 gap-2 md:w-1/2">
          <div
            className="
      md:size-16 size-12 flex items-center justify-center rounded-full bg-[#6CCFF6]/80 md:text-xl text-base text-white font-semibold">
            01
          </div>
          <h3 className="font-bold md:text-4xl text-xl font-alt">
            {step1Title}
          </h3>
          <span className="text-lg">{step1Description}</span>
        </div>
        {/* rhs */}
        <div className="md:w-1/2 relative flex md:justify-end md:items-end justify-center items-center">
          <Image
            src={yellowTriangle}
            alt="yellow"
            className="absolute -z-10 md:size-40 size-25 md:-top-10 -top-20 md:left-10 left-auto md:right-auto -right-8 md:transform-none scale-50 translate-x-[60px] translate-y-[20px]"
          />
          <Image
            src={pink}
            alt="pink"
            className="absolute -z-10 md:size-64 size-45 -rotate-90 bottom-0 md:-bottom-20 md:-right-20 right-auto md:left-auto -left-20 md:transform-none scale-50 translate-x-[0] translate-y-[160px]"
          />
          <div className="mt-0 relative w-full aspect-video rounded-md overflow-hidden border border-neutral-200">
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
      {/* step 2 */}
      <div className="flex  md:flex-row flex-col-reverse md:gap-32 gap-10 justify-between md:translate-x-10">
        {/* lhs */}
        <div className="md:w-1/2 relative flex md:justify-end md:items-end justify-center items-center">
          <Image
            src={blueTriangle}
            alt="blue"
            className="absolute -z-10 size-40 top-20 -left-20"
          />
          <Image
            src={yellow}
            alt="yellow"
            className="absolute -z-10 size-12 -top-6 md:left-8 left-auto md:right-auto right-0"
          />
          <div className="mt-0 relative w-full aspect-video rounded-md overflow-hidden border border-neutral-200">
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
        {/* rhs */}
        <div className="flex pt-12 flex-col md:items-start md:text-start items-center text-center md:gap-5 gap-2 md:w-1/2">
          <div
            className="
      md:size-16 size-12 flex items-center justify-center rounded-full bg-[#C5D475] md:text-xl text-base text-white font-semibold">
            02
          </div>
          <h3 className="font-bold md:text-4xl text-xl font-alt">
            {step2Title}
          </h3>
          <span className="text-lg">{step2Description}</span>
        </div>
      </div>
      {/* step 3 */}
      <div className="flex md:flex-row flex-col md:gap-32 gap-10 justify-between">
        {/* lhs */}
        <div className="flex pt-12 flex-col md:items-start md:text-start items-center text-center md:gap-5 gap-2 md:w-1/2">
          <div
            className="
      md:size-16 size-12 flex items-center justify-center rounded-full bg-[#F6AFCE] md:text-xl text-base text-white font-semibold">
            03
          </div>
          <h3 className="font-bold md:text-4xl text-xl font-alt">
            {step3Title}
          </h3>
          <span className="text-lg">{step3Description}</span>
        </div>
        {/* rhs */}
        <div className="md:w-1/2 relative flex md:justify-end md:items-end justify-center items-center">
          <Image
            src={lemon}
            alt="lemon decor"
            className="absolute -z-10 size-40 md:-bottom-15 bottom-auto md:top-auto -top-20 -left-32 rotate-60"
          />
          <Image
            src={pinkAlt}
            alt="pink decor"
            className="absolute -z-10 size-50 -top-20 -right-20 md:flex hidden"
          />
          <div className="mt-0 relative w-full aspect-video rounded-md overflow-hidden border border-neutral-200">
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
  );
};

const HowItWorks = () => {
  const intl = useIntl();

  return (
    <div className="flex flex-col items-center md:gap-12 md:px-0 px-5 md:pb-16 md:pt-16 gap-0 relative max-w-[1024px] mx-auto">
      <div className="flex flex-col gap-2 items-center">
        <h2 className="font-[unbounded] text-3xl md:text-[40px] font-bold text-center md:leading-tight">
          {intl.formatMessage({ id: 'how-it-works-1' })} <br />
          <span className="text-[#D680A3]">
            {intl.formatMessage({ id: '3-easy-steps' })}
          </span>{' '}
        </h2>
        <span className="md:w-3/4 text-center font-medium md:text-lg">
          🎯{' '}
          {intl.formatMessage({
            id: 'ideal-for-teams-of-10-99-employees-especially-in-offices-without-a-built-in-kitchen',
          })}
        </span>
      </div>
      <HowItWorksSteps
        step1Title={intl.formatMessage({ id: 'plan-once-set-and-forget-0' })}
        step2Title={intl.formatMessage({ id: 'let-your-team-choose-0' })}
        step3Title={intl.formatMessage({
          id: 'meals-delivered-where-you-want-0',
        })}
        step1Description={intl.formatMessage({
          id: 'the-booker-your-teams-meal-coordinator-selects-the-vendors-and-weekly-menu-no-more-daily-decisions-or-zalo-messages-0',
        })}
        step2Description={intl.formatMessage({
          id: 'employees-receive-app-notifications-to-pre-select-their-meals-just-one-tap-and-the-whole-weeks-menu-is-set-0',
        })}
        step3Description={intl.formatMessage({
          id: 'no-calls-no-confusion-our-delivery-agents-team-sets-up-meals-at-the-designated-drop-off-point-all-fully-contactless-0',
        })}
      />
    </div>
  );
};

export default HowItWorks;
