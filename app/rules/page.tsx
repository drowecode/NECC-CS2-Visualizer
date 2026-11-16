import { PageTitle } from "@/components/ui";

export const metadata = { title: "Rules | NECC CS2" };

const RULEBOOK = "/necc-cs2-rulebook.pdf";

export default function RulesPage() {
  return (
    <>
      <PageTitle title="Rules">The NECC Counter-Strike 2 rulebook for Fall 2026 and Spring 2027.</PageTitle>

      <p className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
        <a href={RULEBOOK} target="_blank" rel="noreferrer" className="font-medium text-accent underline">
          Open the rulebook in a new tab
        </a>
        <a href={RULEBOOK} download="NECC-CS2-Rulebook.pdf" className="font-medium text-muted underline hover:text-accent">
          Download the PDF
        </a>
      </p>

      <object
        data={`${RULEBOOK}#view=FitH`}
        type="application/pdf"
        aria-label="NECC Counter-Strike 2 rulebook"
        className="h-[80vh] w-full border border-line bg-surface"
      >
        <p className="p-4 text-muted">
          This browser cannot show the PDF inside the page. Use the links above to open or download it.
        </p>
      </object>
    </>
  );
}
