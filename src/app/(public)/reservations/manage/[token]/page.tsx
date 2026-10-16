import { notFound } from "next/navigation";
import { getReservationByTokenAction } from "../actions";
import { ManageReservationView } from "./manage-view";

export default async function ManageReservationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const reservation = await getReservationByTokenAction(token);
  if (!reservation) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <ManageReservationView token={token} reservation={reservation} />
    </div>
  );
}
