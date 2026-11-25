import { Lobby } from "./lobby";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const { invite } = await searchParams;
  const initialInvite = Array.isArray(invite) ? "" : invite ?? null;
  return <Lobby key={initialInvite ?? "home"} initialInvite={initialInvite} />;
}
