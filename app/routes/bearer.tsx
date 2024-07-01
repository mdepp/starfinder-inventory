import { ActionFunctionArgs } from "@remix-run/node";
import { Outlet, useFetcher, useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { prisma } from "~/util/prisma.server";

const ACTION_SCHEMA = z.discriminatedUnion("action", [
  z.object({ action: z.literal("deleteBearer"), bearerId: z.coerce.number() }),
]);

export async function loader() {
  return prisma.inventoryItemBearer.findMany({ orderBy: { name: "asc" } });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const parsedObject = ACTION_SCHEMA.parse(
    Object.fromEntries(formData.entries()),
  );

  if (parsedObject.action === "deleteBearer") {
    return prisma.inventoryItemBearer.delete({
      where: { id: parsedObject.bearerId },
    });
  }
}

export default function Bearers() {
  const bearers = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const parsedFormData = fetcher.formData
    ? ACTION_SCHEMA.parse(Object.fromEntries(fetcher.formData.entries()))
    : null;

  const deletedId =
    parsedFormData?.action === "deleteBearer" ? parsedFormData.bearerId : null;

  const optimisticBearers = bearers.filter((bearer) => bearer.id !== deletedId);

  return (
    <>
      <section>
        <h1>Bearers</h1>
        <ul>
          {optimisticBearers.map((bearer) => (
            <li key={bearer.id}>
              {bearer.name}
              <fetcher.Form method="POST">
                <input type="hidden" name="bearerId" value={bearer.id}></input>
                <button type="submit" name="action" value="deleteBearer">
                  Delete
                </button>
              </fetcher.Form>
            </li>
          ))}
        </ul>
      </section>
      <Outlet />
    </>
  );
}
