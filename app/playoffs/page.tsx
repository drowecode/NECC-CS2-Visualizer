import { Suspense } from "react";
import { BracketsView } from "@/components/BracketsView";
import { DataError, Loading, MockBanner, PageTitle } from "@/components/ui";
import { dataMode, getPlayoffs } from "@/lib/data";

export const metadata = { title: "Playoffs | NECC CS2" };

async function Brackets() {
  const result = await getPlayoffs();
  if (!result.ok) return <DataError message={result.error} />;
  return (
    <>
      <MockBanner mode={dataMode()} />
      <BracketsView brackets={result.brackets} />
    </>
  );
}

export default function BracketsPage() {
  return (
    <>
      <PageTitle title="Playoffs">
        Divisions 1 and 2 are double elimination. Divisions 3 and 4 are single elimination with a 3rd place match.
        Brackets appear here once they are drawn on FACEIT.
      </PageTitle>
      <Suspense fallback={<Loading label="brackets" />}>
        <Brackets />
      </Suspense>
    </>
  );
}
