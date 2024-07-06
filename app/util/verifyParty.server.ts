import { prisma } from "./prisma.server";

export default async function verifyParty(grantKey: string | undefined) {
  const party = await prisma.party.findFirst({
    where: { accessGrants: { some: { grantKey } } },
  });
  if (party === null) {
    throw new Response("Access grant not found", { status: 404 });
  }
  return party;
}
