import { InventoryItem, InventoryItemBearer } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  Form,
  useFetcher,
  useLoaderData,
  useNavigation,
  useRevalidator,
  useSubmit,
} from "@remix-run/react";
import { FC, useEffect, useId, useRef, useState } from "react";
import { promiseHash } from "remix-utils/promise";
import { io } from "socket.io-client";
import { z } from "zod";
import { useSocket } from "~/socket";
import { prisma } from "~/util/prisma.server";
import verifyParty from "~/util/verifyParty.server";

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
    id: z.coerce.number(),
    category: z.enum(CATEGORY_ORDER),
    description: z.string().min(1),
    bulk: z.coerce.number(),
    count: z.coerce.number(),
    bearerId: z
      .string()
      .transform((value) => (value === "" ? null : Number(value)))
      .default(""),
  }),
  z.object({ action: z.literal("deleteItem"), id: z.coerce.number() }),
]);

const socket = io("http://localhost:5173");

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { grantKey } = params;
  const party = await verifyParty(grantKey);

  const { searchParams } = new URL(request.url);

  const filters = {
    bearerId: searchParams
      .getAll("bearerId")
      .map((bearerId) => Number(bearerId)),
  };

  const items = prisma.inventoryItem.findMany({
    orderBy: { description: "asc" },
    ...(filters.bearerId.length > 0
      ? { where: { party, bearerId: { in: filters.bearerId } } }
      : {}),
  });
  const bearers = prisma.inventoryItemBearer.findMany();
  const timestamp = new Date().getTime();

  return {
    timestamp,
    room: grantKey ?? "",
    filters,
    ...(await promiseHash({ items, bearers })),
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { grantKey } = params;
  const party = await verifyParty(grantKey);
  const formData = await request.formData();

  const parsedObject = ACTION_SCHEMA.parse(
    Object.fromEntries(formData.entries()),
  );

  if (parsedObject.action === "newItem") {
    const { action, ...data } = parsedObject;
    const item = await prisma.inventoryItem.create({
      data: { ...data, partyId: party.id },
    });
    socket.emit("itemStream", grantKey, {
      action: "newItem",
      timestamp: new Date().getTime(),
      ...item,
    });
    return item;
  }
  if (parsedObject.action === "updateItem") {
    const { action, id, ...data } = parsedObject;
    const item = await prisma.inventoryItem.update({
      where: { id, party },
      data,
    });
    socket.emit("itemStream", grantKey, {
      action: "updateItem",
      timestamp: new Date().getTime(),
      ...item,
    });
    return item;
  }
  if (parsedObject.action === "deleteItem") {
    const { id } = parsedObject;
    const item = await prisma.inventoryItem.delete({ where: { id, party } });
    socket.emit("itemStream", grantKey, {
      action: "deleteItem",
      timestamp: new Date().getTime(),
      ...item,
    });
    return item;
  }
}

export default function Items() {
  const { timestamp, room, items, bearers, filters } =
    useLoaderData<typeof loader>();
  const updates = useSocketUpdates(room, timestamp);
  useRevalidate(updates.length >= 5);

  return (
    <>
      <section>
        <h1>Filters</h1>
        <FilterForm filters={filters} bearers={bearers} />
      </section>
      <section>
        <h1>Items</h1>
        <ItemList
          items={items}
          bearers={bearers}
          filters={filters}
          socketUpdates={updates}
        />
      </section>
    </>
  );
}

type ActionSchema = ReturnType<(typeof ACTION_SCHEMA)["parse"]>;
type SocketUpdate = ActionSchema & { timestamp: number };
function useSocketUpdates(room: string, dataTimestamp: number) {
  const socket = useSocket();
  const [updates, setUpdates] = useState<SocketUpdate[]>([]);

  useEffect(() => {
    socket?.emit("joinRoom", room);
  }, [room, socket]);

  useEffect(() => {
    socket?.on("itemStream", (event) => {
      console.log(event);
      setUpdates((prev) => [...prev, event]);
    });
    return () => {
      socket?.off("itemStream");
    };
  }, [socket]);

  useEffect(() => {
    setUpdates((prev) =>
      prev.filter((update) => update.timestamp >= dataTimestamp),
    );
  }, [dataTimestamp]);

  return updates;
}

function useRevalidate(shouldRevalidate: boolean) {
  const revalidator = useRevalidator();
  useEffect(() => {
    if (shouldRevalidate && revalidator.state === "idle") {
      revalidator.revalidate();
    }
  }, [revalidator, shouldRevalidate]);
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
  socketUpdates: SocketUpdate[];
}) {
  const { items, bearers, filters, socketUpdates } = props;
  const navigation = useNavigation();

  const parsedFormData =
    navigation.formMethod !== "GET" && navigation.formData
      ? ACTION_SCHEMA.parse(Object.fromEntries(navigation.formData.entries()))
      : null;

  const optimisticUpdates: Omit<SocketUpdate, "timestamp">[] = [];

  if (parsedFormData) {
    optimisticUpdates.push(parsedFormData);
  }

  const updates: (SocketUpdate | Omit<SocketUpdate, "timestamp">)[] = [
    ...socketUpdates,
    ...optimisticUpdates,
  ];

  const updatedItems = applyItemUpdates(items, updates).sort((lhs, rhs) =>
    lhs.description.localeCompare(rhs.description),
  );

  // After item updates are applied, it is possible that items exist locally
  // which should be filtered out. So, apply the filters once again.
  const filteredItems =
    filters.bearerId.length > 0
      ? updatedItems.filter((item) =>
          filters.bearerId.includes(item.bearerId ?? -1),
        )
      : updatedItems;

  return (
    <ul>
      {CATEGORY_ORDER.map((category) => (
        <li key={category}>
          {category}
          <ul>
            {filteredItems
              .filter((item) => item.category === category)
              .map((item) => (
                <li key={"id" in item ? item.id : "optimistic"}>
                  <EditableItem
                    id={"id" in item ? item.id : undefined}
                    category={item.category}
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

function extract<T extends object>(matcher: T) {
  return function <U>(item: U): item is Extract<U, T> {
    // @ts-expect-error 7053
    return Object.keys(matcher).every((key) => matcher[key] === item[key]);
  };
}

function nonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

function applyItemUpdates(
  items: InventoryItem[],
  updates: (SocketUpdate | Omit<SocketUpdate, "timestamp">)[],
): (
  | InventoryItem
  | Extract<ActionSchema, { action: "newItem" | "updateItem" }>
)[] {
  const itemsCreated = updates.filter(extract({ action: "newItem" as const }));
  const itemsUpdated = updates.filter(
    extract({ action: "updateItem" as const }),
  );
  const itemsDeletedIds = updates
    .filter(extract({ action: "deleteItem" as const }))
    .map((event) => event.id);

  const updatedItems: (
    | InventoryItem
    | Extract<ActionSchema, { action: "newItem" | "updateItem" }>
  )[] = [...items, ...itemsCreated, ...itemsUpdated].filter(
    (item) => !("id" in item) || !itemsDeletedIds.includes(item.id),
  );

  return Object.values(
    Object.groupBy(updatedItems, (item) =>
      "id" in item ? item.id : Math.random(),
    ),
  )
    .filter(nonNullable)
    .map((items) => items[items.length - 1]);
}

function EditableItem(props: {
  id?: number;
  category: string;
  description: string;
  bulk: number;
  count: number;
  bearerId: number | null;
  bearers: InventoryItemBearer[];
}) {
  const { id, category, description, bulk, count, bearerId, bearers } = props;
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
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="category" value={category} />
        <ResettingInput
          type="text"
          name="description"
          required
          defaultValue={description}
          disabled={isOptimistic}
        />
        <UncontrolledBulkSelect
          Element={ResettingSelect}
          name="bulk"
          required
          defaultValue={bulk}
          disabled={isOptimistic}
        />
        <ResettingInput
          type="number"
          name="count"
          required
          pattern="\d+"
          defaultValue={count}
        />
        <ResettingSelect name="bearerId" defaultValue={bearerId ?? ""}>
          <option value="">None</option>
          {bearers.map((bearer) => (
            <option key={bearer.id} value={bearer.id}>
              {bearer.name}
            </option>
          ))}
        </ResettingSelect>
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

function ResettingInput(props: JSX.IntrinsicElements["input"]) {
  const { defaultValue, ...rest } = props;

  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.value = String(defaultValue);
    }
  }, [defaultValue]);

  return <input ref={ref} defaultValue={defaultValue} {...rest} />;
}

function ResettingSelect(props: JSX.IntrinsicElements["select"]) {
  const { defaultValue, ...rest } = props;

  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.value = String(defaultValue);
    }
  }, [defaultValue]);
  return <select ref={ref} defaultValue={defaultValue} {...rest} />;
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
      <select name="bearerId" defaultValue={bearers[0]?.id}>
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

function UncontrolledBulkSelect(
  props: JSX.IntrinsicElements["select"] & {
    Element?: FC<JSX.IntrinsicElements["select"]>;
  },
) {
  const { Element = "select", ...rest } = props;
  return (
    <Element {...rest}>
      <option value="0">-</option>
      <option value="0.1">L</option>
      {[...Array(MAX_BULK).keys()].slice(1).map((bulk) => (
        <option key={bulk} value={bulk}>
          {bulk}
        </option>
      ))}
    </Element>
  );
}
