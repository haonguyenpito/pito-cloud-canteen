/**
 * A company member row is `{ ...sharetribeUser, ...company.metadata.members[email] }`,
 * so `id` is the plain user-id STRING from the members map — it overwrites the
 * Sharetribe entity's `{ uuid }` object. Never read `member.id.uuid` here.
 */
type TCompanyMemberLike = {
  id?: unknown;
  attributes?: unknown;
};

/**
 * Returns the Sharetribe user id of a company member, or undefined when the
 * member was only invited and never registered (`attributes` is then missing).
 */
export const getCompanyMemberUserId = (
  member?: TCompanyMemberLike | null,
): string | undefined =>
  member?.attributes && typeof member.id === 'string' ? member.id : undefined;
