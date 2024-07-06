import { ActionFunctionArgs } from "@remix-run/node";
import { Form, redirect, useNavigation } from "@remix-run/react";
import { useId } from "react";
import invariant from "tiny-invariant";
import { prisma } from "~/util/prisma.server";
import verifyParty from "~/util/verifyParty.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const { grantKey } = params;
  const party = await verifyParty(grantKey);

  const data = await request.formData();
  const name = data.get("name");
  invariant(typeof name === "string");
  await prisma.inventoryItemBearer.create({
    data: { name, partyId: party.id },
  });
  return redirect("..");
}

export default function NewBearer() {
  const nameId = useId();
  const navigation = useNavigation();

  return (
    <>
      <h2>Add a bearer</h2>
      <Form method="post">
        <label htmlFor={nameId}>Name</label>
        <input id={nameId} name="name" type="text" />
        <button type="submit" disabled={navigation.state === "submitting"}>
          Submit
        </button>
      </Form>
    </>
  );
}
