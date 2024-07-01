import { InventoryItem, InventoryItemBearer } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  Form,
  useFetcher,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import { useEffect, useId, useRef } from "react";
import { promiseHash } from "remix-utils/promise";
import { z } from "zod";
import { prisma } from "~/util/prisma.server";

const CATEGORY_ORDER = [
  "WEAPON",
  "AMMO",
  "ARMOR",
  "CONSUMABLE",
  "MISC",
] as const;
const MAX_BULK = 10;

const ACTION_SCHEMA = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("newItem"),
    category: z.enum(CATEGORY_ORDER),
    description: z.string().min(1),
    bulk: z.coerce.number(),
    count: z.coerce.number().default(1),
    bearerId: z
      .string()
      .transform((value) => (value === "" ? null : Number(value)))
      .default(""),
  }),
  z.object({
    action: z.literal("updateItem"),
    itemId: z.coerce.number(),
    description: z.string().min(1),
    bulk: z.coerce.number(),
    count: z.coerce.number(),
    bearerId: z
      .string()
      .transform((value) => (value === "" ? null : Number(value)))
      .default(""),
  }),
  z.object({ action: z.literal("deleteItem"), itemId: z.coerce.number() }),
]);

export async function loader({ request }: LoaderFunctionArgs) {
  const { searchParams } = new URL(request.url);
  const filters = {
    bearerId: searchParams
      .getAll("bearerId")
      .map((bearerId) => Number(bearerId)),
  };

  const items = prisma.inventoryItem.findMany({
    include: { bearer: true },
    orderBy: { description: "asc" },
    ...(filters.bearerId.length > 0
      ? { where: { bearerId: { in: filters.bearerId } } }
      : {}),
  });
  const bearers = prisma.inventoryItemBearer.findMany();

  return { filters, ...(await promiseHash({ items, bearers })) };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const parsedObject = ACTION_SCHEMA.parse(
    Object.fromEntries(formData.entries()),
  );

  if (parsedObject.action === "newItem") {
    const { action, ...data } = parsedObject;
    return prisma.inventoryItem.create({ data });
  }
  if (parsedObject.action === "updateItem") {
    const { action, itemId: id, ...data } = parsedObject;
    return prisma.inventoryItem.update({ where: { id }, data });
  }
  if (parsedObject.action === "deleteItem") {
    const { itemId: id } = parsedObject;
    return prisma.inventoryItem.delete({ where: { id } });
  }
}

export default function Items() {
  const { items, bearers, filters } = useLoaderData<typeof loader>();
  return (
    <>
      <section>
        <h1>Filters</h1>
        <FilterForm filters={filters} bearers={bearers} />
      </section>
      <section>
        <h1>Items</h1>
        <ItemList items={items} bearers={bearers} filters={filters} />
      </section>
    </>
  );
}

function FilterForm(props: {
  filters: { bearerId: number[] };
  bearers: InventoryItemBearer[];
}) {
  const { filters, bearers } = props;
  const bearerInputId = useId();
  const submit = useSubmit();
  return (
    <Form method="GET" onChange={(event) => submit(event.currentTarget)}>
      <label htmlFor={bearerInputId}>Bearers</label>
      <select
        id={bearerInputId}
        name="bearerId"
        multiple
        defaultValue={filters.bearerId.map((bearerId) => String(bearerId))}
      >
        {bearers.map((bearer) => (
          <option key={bearer.id} value={bearer.id}>
            {bearer.name}
          </option>
        ))}
      </select>
      <button type="submit">Submit</button>
    </Form>
  );
}

function ItemList(props: {
  items: InventoryItem[];
  bearers: InventoryItemBearer[];
  filters: { bearerId: number[] };
}) {
  const { items, bearers, filters } = props;
  const navigation = useNavigation();

  const parsedFormData =
    navigation.formMethod !== "GET" && navigation.formData
      ? ACTION_SCHEMA.parse(Object.fromEntries(navigation.formData.entries()))
      : null;

  const newItem =
    parsedFormData?.action === "newItem" ? parsedFormData : undefined;

  const deletedId =
    parsedFormData?.action === "deleteItem" ? parsedFormData.itemId : null;

  const optimisticItems: (
    | (typeof items)[number]
    | NonNullable<typeof newItem>
  )[] = [...items, ...(newItem ? [newItem] : [])]
    .filter((item) => !("id" in item) || item.id !== deletedId)
    .sort((lhs, rhs) => lhs.description.localeCompare(rhs.description));

  return (
    <ul>
      {CATEGORY_ORDER.map((category) => (
        <li key={category}>
          {category}
          <ul>
            {optimisticItems
              .filter((item) => item.category === category)
              .map((item) => (
                <li key={"id" in item ? item.id : "optimistic"}>
                  <EditableItem
                    id={"id" in item ? item.id : undefined}
                    description={item.description}
                    bulk={item.bulk}
                    count={item.count}
                    bearerId={item.bearerId}
                    bearers={bearers}
                  />
                </li>
              ))}
            <li>
              <NewItem
                category={category}
                bearers={
                  filters.bearerId.length > 0
                    ? bearers.filter((bearer) =>
                        filters.bearerId.includes(bearer.id),
                      )
                    : bearers
                }
              />
            </li>
          </ul>
        </li>
      ))}
    </ul>
  );
}

function EditableItem(props: {
  id?: number;
  description: string;
  bulk: number;
  count: number;
  bearerId: number | null;
  bearers: InventoryItemBearer[];
}) {
  const { id, description, bulk, count, bearerId, bearers } = props;
  const isOptimistic = typeof id !== "number";

  const updateButtonRef = useRef<HTMLButtonElement>(null);
  const submit = useSubmit();

  return (
    <>
      <Form
        method="POST"
        onChange={() => {
          if (updateButtonRef.current?.form?.checkValidity()) {
            submit(updateButtonRef.current);
          }
        }}
      >
        <input type="hidden" name="itemId" value={id} />
        <input
          type="text"
          name="description"
          required
          defaultValue={description}
          disabled={isOptimistic}
        />
        <UncontrolledBulkSelect
          name="bulk"
          required
          defaultValue={bulk}
          disabled={isOptimistic}
        />
        <input
          type="number"
          name="count"
          required
          pattern="\d+"
          defaultValue={count}
        />
        <select name="bearerId" defaultValue={bearerId ?? ""}>
          <option value="">None</option>
          {bearers.map((bearer) => (
            <option key={bearer.id} value={bearer.id}>
              {bearer.name}
            </option>
          ))}
        </select>
        <button
          ref={updateButtonRef}
          type="submit"
          name="action"
          value="updateItem"
          disabled={isOptimistic}
        >
          Update
        </button>
        <button
          type="submit"
          name="action"
          value="deleteItem"
          disabled={isOptimistic}
        >
          Delete
        </button>
      </Form>
    </>
  );
}

function NewItem(props: { category: string; bearers: InventoryItemBearer[] }) {
  const { category, bearers } = props;
  const fetcher = useFetcher();
  const formRef = useRef<HTMLFormElement>(null);

  const parsedObject = fetcher.formData
    ? ACTION_SCHEMA.parse(Object.fromEntries(fetcher.formData.entries()))
    : undefined;

  const isSubmitting =
    parsedObject?.action === "newItem" && fetcher.state === "submitting";

  useEffect(() => {
    if (isSubmitting) {
      formRef.current?.reset();
    }
  }, [isSubmitting]);

  return (
    <fetcher.Form ref={formRef} method="POST">
      <input type="hidden" name="action" value="newItem" />
      <input type="hidden" name="category" value={category} />
      <input type="text" name="description" required />
      <UncontrolledBulkSelect name="bulk" />
      <select name="bearerId" defaultValue={bearers[0].id}>
        {bearers.map((bearer) => (
          <option key={bearer.id} value={bearer.id}>
            {bearer.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={fetcher.state === "submitting"}>
        Add
      </button>
    </fetcher.Form>
  );
}

function UncontrolledBulkSelect(props: JSX.IntrinsicElements["select"]) {
  return (
    <select {...props}>
      <option value="0">-</option>
      <option value="0.1">L</option>
      {[...Array(MAX_BULK).keys()].slice(1).map((bulk) => (
        <option key={bulk} value={bulk}>
          {bulk}
        </option>
      ))}
    </select>
  );
}
