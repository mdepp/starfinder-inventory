import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Inventory" },
    { name: "description", content: "Starfinder inventory system" },
  ];
};

export default function Index() {
  return (
    <section>
      <h1>Starfinder Inventory</h1>
    </section>
  );
}
