import { LoaderFunctionArgs } from "@remix-run/node";
import { NavLink, Outlet } from "@remix-run/react";
import verifyParty from "~/util/verifyParty.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const { grantKey } = params;
  return verifyParty(grantKey);
}

export default function Party() {
  return (
    <>
      <nav>
        <ul>
          <li>
            <NavLink to="item">Items</NavLink>
          </li>
          <li>
            <NavLink to="bearer">Bearers</NavLink>
          </li>
        </ul>
      </nav>
      <Outlet />
    </>
  );
}
