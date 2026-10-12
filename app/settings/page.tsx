// "/settings" Edit config with no code changes. Viewing is public; editing may need ADMIN_PASSCODE.
import { GeneralSettingsEditor, LockButton, ObjectionsEditor, TopicsEditor, UnlockForm } from "@/components/settings-editor";
import { LoadError, PageTitle } from "@/components/states";
import { canEdit, passcodeRequired } from "@/lib/auth";
import { loadAllConfig } from "@/lib/config";
import { load, recentConfigChanges } from "@/lib/queries";
import { formatDateTime } from "@/lib/weeks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

function describeChange(c: { entity: string; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; entity_id: string }) {
  const after = c.after ?? {};
  const before = c.before ?? {};
  const name = (after.name ?? after.label ?? after.phrase ?? before.phrase ?? before.name ?? `#${c.entity_id}`) as string;
  if (c.entity === "setting") return `Changed ${c.entity_id.replace("_", " ")}`;
  const verb = { create: "Added", update: "Edited", activate: "Activated", deactivate: "Deactivated", reorder: "Reordered" }[c.action] ?? c.action;
  return `${verb} ${c.entity} ${c.action === "reorder" ? "" : `"${name}"`}`.trim();
}

export default async function SettingsPage() {
  const result = await load(async () => {
    const [config, changes, editable] = await Promise.all([loadAllConfig(), recentConfigChanges(), canEdit()]);
    return { config, changes, editable };
  });
  if (!result.ok) return <LoadError result={result} />;
  const { config, changes, editable } = result.data;
  const locked = passcodeRequired();

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <PageTitle title="Settings">Topics, keywords and objections live in the database. Changes apply from the next run, with no code change.</PageTitle>
        {locked && editable && <LockButton />}
      </div>

      {!editable && <UnlockForm />}

      <section aria-labelledby="topics-heading">
        <h2 id="topics-heading" className="border-b border-ink pb-2 text-lg font-semibold">
          Topics and keywords
        </h2>
        <p className="mb-2 mt-2 text-sm text-muted">Deactivating keeps a topic&apos;s history. The order here breaks ties in the ranking.</p>
        <TopicsEditor topics={config.topics} keywords={config.keywords} editable={editable} />
      </section>

      <section aria-labelledby="objections-heading">
        <h2 id="objections-heading" className="border-b border-ink pb-2 text-lg font-semibold">
          Sales objections
        </h2>
        <p className="mb-2 mt-2 text-sm text-muted">What prospects say in demos. Each week, posts that echo one are counted and linked.</p>
        <ObjectionsEditor objections={config.objections} editable={editable} />
      </section>

      <div className="grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="general-heading">
          <h2 id="general-heading" className="mb-4 border-b border-ink pb-2 text-lg font-semibold">
            Delivery and sources
          </h2>
          <GeneralSettingsEditor settings={config.settings} editable={editable} envRecipient={Boolean(process.env.BRIEF_RECIPIENT_EMAIL)} />
          <dl className="tabular mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-muted">
            <dt>Timezone</dt>
            <dd className="text-ink">{config.settings.timezone}</dd>
            <dt>Low-signal threshold</dt>
            <dd className="text-ink">{config.settings.low_signal_threshold} mentions</dd>
            <dt>Too new to judge</dt>
            <dd className="text-ink">under {config.settings.unresolved_min_age_hours} hours old</dd>
          </dl>
        </section>

        <section aria-labelledby="changes-heading">
          <h2 id="changes-heading" className="mb-4 border-b border-ink pb-2 text-lg font-semibold">
            Recent changes
          </h2>
          {changes.length === 0 ? (
            <p className="text-sm text-muted">No changes yet. Every edit made here is recorded with its before and after values.</p>
          ) : (
            <ul className="divide-y divide-rule text-sm">
              {changes.map((c) => (
                <li key={c.id} className="flex justify-between gap-4 py-2">
                  <span>{describeChange(c)}</span>
                  <span className="tabular shrink-0 text-muted">{formatDateTime(c.changed_at, config.settings.timezone)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
