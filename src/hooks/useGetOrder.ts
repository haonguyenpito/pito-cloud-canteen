import { getOrderApi } from '@apis/orderApi';

/**
 * Get order data for participant
 * @param orderId - Order ID
 * @returns Order data
 */
const useGetOrder = async (orderId: string) => {
  const { data } = await getOrderApi(orderId);

  return data;
};

export default useGetOrder;
