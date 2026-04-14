import { Star } from 'lucide-react';

import { EUserRole } from '@src/utils/enums';

export const renderStars = (rating: number) => {
  return Array.from({ length: 5 }, (_, index) => (
    <Star
      key={index}
      // eslint-disable-next-line prettier/prettier
      className={`w-4 h-4 ${
        index < rating ? 'text-orange-400 fill-current' : 'text-gray-300'
      }`}
    />
  ));
};

export const renderReplyRole = (replyRole: EUserRole) => {
  switch (replyRole) {
    case EUserRole.admin:
      return (
        <span className="text-gray-500 font-medium text-[10px]">Admin</span>
      );
    case EUserRole.participant:
      return (
        <span className="text-gray-500 font-medium text-[10px]">
          Participant
        </span>
      );
    case EUserRole.booker:
      return (
        <span className="text-gray-500 font-medium text-[10px]">Booker</span>
      );
    case EUserRole.company:
      return (
        <span className="text-gray-500 font-medium text-[10px]">Company</span>
      );
    case EUserRole.partner:
      return (
        <span className="text-gray-500 font-medium text-[10px]">Partner</span>
      );
    default:
      return <span className="text-gray-500 font-medium text-[10px]">NA</span>;
  }
};
