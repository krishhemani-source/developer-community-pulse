"use client";
// Settings editor. All config lives in the database, so every change here takes effect on the
// next run with no code change or redeploy.
import { ArrowDown, ArrowUp, Lock, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import {
  type ActionResult,
  addKeywordAction,
  createObjectionAction,
  createTopicAction,
  lockAction,
  moveTopicAction,
  removeKeywordAction,
  saveGeneralSettingsAction,
  setObjectionActiveAction,
  setTopicActiveAction,
  unlockAction,
  updateObjectionAction,
  updateTopicAction,
} from "@/app/settings/actions";
import type { Keyword, Objection, Settings, Topic } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useToast } from "./toast";
import { Button } from "./ui/button";
import { Input, Textarea } from "./ui/input";

/** Runs a server action, shows its message as a toast, and returns whether it worked. */
function useAction() {
  const toast = useToast();
  const [pending, start] = useTransition();
  function run(action: () => Promise<ActionResult>, onOk?: () => void) {
    start(async () => {
      const result = await action();
      toast(result.message, result.ok ? "info" : "error");
      if (result.ok) onOk?.();
    });
  }
  return { pending, run };
}

function Field({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
      {error && <span className="text-xs text-rising">{error}</span>}
    </label>
  );
}

// ---------- Passcode ----------

export function UnlockForm() {
  const [passcode, setPasscode] = useState("");
  const { pending, run } = useAction();
  return (
    <form
      className="flex flex-col gap-3 border-l-2 border-ink pl-4 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => unlockAction(passcode), () => setPasscode(""));
      }}
    >
      <Field label="Settings are read-only. Enter the admin passcode to edit.">
        <Input type="password" autoComplete="current-password" value={passcode} onChange={(e) => setPasscode(e.target.value)} className="sm:w-64" />
      </Field>
      <Button type="submit" disabled={pending || passcode.length === 0}>
        Unlock settings
      </Button>
    </form>
  );
}

export function LockButton() {
  const { pending, run } = useAction();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(lockAction)}>
      <Lock />
      Lock settings
    </Button>
  );
}

// ---------- Topics ----------

export function TopicsEditor({ topics, keywords, editable }: { topics: Topic[]; keywords: Keyword[]; editable: boolean }) {
  return (
    <div className="flex flex-col">
      <ul className="divide-y divide-rule border-y border-rule">
        {topics.map((t, i) => (
          <TopicRow
            key={t.id}
            topic={t}
            keywords={keywords.filter((k) => k.topic_id === t.id)}
            allKeywords={keywords}
            editable={editable}
            isFirst={i === 0}
            isLast={i === topics.length - 1}
          />
        ))}
      </ul>
      {editable && <NewTopicForm />}
    </div>
  );
}

function TopicRow({
  topic,
  keywords,
  allKeywords,
  editable,
  isFirst,
  isLast,
}: {
  topic: Topic;
  keywords: Keyword[];
  allKeywords: Keyword[];
  editable: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [name, setName] = useState(topic.name);
  const [description, setDescription] = useState(topic.description);
  const [color, setColor] = useState(topic.color);
  const [phrase, setPhrase] = useState("");
  const { pending, run } = useAction();
  const dirty = name !== topic.name || description !== topic.description || color.toLowerCase() !== topic.color.toLowerCase();
  const nameError = name.trim() === "" ? "Topic name cannot be empty." : null;
  const phraseTrim = phrase.trim();
  const duplicate = phraseTrim !== "" && allKeywords.some((k) => k.phrase.toLowerCase() === phraseTrim.toLowerCase());

  return (
    <li className={cn("py-5", !topic.is_active && "opacity-60")}>
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="grid gap-3 sm:grid-cols-[3rem_1fr]">
          <Field label="Colour">
            <input
              type="color"
              value={color}
              disabled={!editable}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-rule bg-surface p-1 disabled:cursor-default"
              aria-label={`Colour for ${topic.name}`}
            />
          </Field>
          <Field label="Topic name" error={nameError}>
            <Input value={name} disabled={!editable} onChange={(e) => setName(e.target.value)} aria-invalid={nameError ? true : undefined} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description (helps Gemini assign posts to this topic)">
              <Textarea value={description} disabled={!editable} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </Field>
          </div>
        </div>
        {editable && (
          <div className="flex flex-row flex-wrap items-start gap-2 md:flex-col md:items-end">
            <Button
              size="sm"
              disabled={!dirty || pending || nameError !== null}
              onClick={() => run(() => updateTopicAction(topic.id, { name, description, color }))}
            >
              Save changes
            </Button>
            <Button size="sm" variant={topic.is_active ? "danger" : "outline"} disabled={pending} onClick={() => run(() => setTopicActiveAction(topic.id, !topic.is_active))}>
              {topic.is_active ? "Deactivate" : "Activate"}
            </Button>
            <div className="flex gap-1">
              <Button size="icon" variant="outline" disabled={pending || isFirst} onClick={() => run(() => moveTopicAction(topic.id, "up"))} aria-label={`Move ${topic.name} up`}>
                <ArrowUp />
              </Button>
              <Button size="icon" variant="outline" disabled={pending || isLast} onClick={() => run(() => moveTopicAction(topic.id, "down"))} aria-label={`Move ${topic.name} down`}>
                <ArrowDown />
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm text-muted">Keywords ({keywords.length})</p>
        <ul className="flex flex-wrap gap-2">
          {keywords.map((k) => (
            <li key={k.id} className="inline-flex items-center gap-1 rounded border border-rule bg-surface py-0.5 pl-2 pr-1 text-sm">
              {k.phrase}
              {editable && (
                <button
                  type="button"
                  className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-50"
                  disabled={pending}
                  onClick={() => run(() => removeKeywordAction(k.id))}
                  aria-label={`Remove keyword ${k.phrase}`}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
          {keywords.length === 0 && <li className="text-sm text-muted">No keywords: this topic will not collect posts.</li>}
        </ul>
        {editable && topic.is_active && (
          <form
            className="mt-3 flex flex-col gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (phraseTrim.length < 2 || duplicate) return;
              run(() => addKeywordAction(topic.id, phraseTrim), () => setPhrase(""));
            }}
          >
            <div className="flex gap-2">
              <Input
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder="Add a keyword, e.g. merge queue"
                className="max-w-xs"
                aria-label={`New keyword for ${topic.name}`}
                aria-invalid={duplicate ? true : undefined}
              />
              <Button type="submit" variant="outline" size="md" className="h-9" disabled={pending || phraseTrim.length < 2 || duplicate}>
                <Plus />
                Add keyword
              </Button>
            </div>
            {duplicate && <span className="text-xs text-rising">That keyword already exists.</span>}
          </form>
        )}
      </div>
    </li>
  );
}

function NewTopicForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#5B6478");
  const { pending, run } = useAction();
  return (
    <form
      className="mt-6 grid gap-3 sm:grid-cols-[3rem_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createTopicAction({ name, description, color }), () => {
          setName("");
          setDescription("");
        });
      }}
    >
      <Field label="Colour">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded border border-rule bg-surface p-1" aria-label="Colour for new topic" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="New topic name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Merge queues" />
        </Field>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What belongs in this topic" />
        </Field>
      </div>
      <Button type="submit" disabled={pending || name.trim() === ""}>
        <Plus />
        Add topic
      </Button>
    </form>
  );
}

// ---------- Objections ----------

export function ObjectionsEditor({ objections, editable }: { objections: Objection[]; editable: boolean }) {
  const [label, setLabel] = useState("");
  const { pending, run } = useAction();
  return (
    <div>
      <ul className="divide-y divide-rule border-y border-rule">
        {objections.map((o) => (
          <ObjectionRow key={o.id} objection={o} editable={editable} />
        ))}
      </ul>
      {editable && (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createObjectionAction({ label, description: "" }), () => setLabel(""));
          }}
        >
          <Field label="New objection your sales team hears">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Setup takes too long" className="sm:w-96" />
          </Field>
          <Button type="submit" disabled={pending || label.trim() === ""}>
            <Plus />
            Add objection
          </Button>
        </form>
      )}
    </div>
  );
}

function ObjectionRow({ objection, editable }: { objection: Objection; editable: boolean }) {
  const [label, setLabel] = useState(objection.label);
  const { pending, run } = useAction();
  const dirty = label !== objection.label;
  const empty = label.trim() === "";
  return (
    <li className={cn("flex flex-col gap-2 py-3 sm:flex-row sm:items-center", !objection.is_active && "opacity-60")}>
      <Input
        value={label}
        disabled={!editable}
        onChange={(e) => setLabel(e.target.value)}
        aria-label="Objection"
        aria-invalid={empty ? true : undefined}
        className="sm:flex-1"
      />
      {editable && (
        <div className="flex gap-2">
          <Button size="sm" disabled={!dirty || empty || pending} onClick={() => run(() => updateObjectionAction(objection.id, { label, description: objection.description }))}>
            Save changes
          </Button>
          <Button size="sm" variant={objection.is_active ? "danger" : "outline"} disabled={pending} onClick={() => run(() => setObjectionActiveAction(objection.id, !objection.is_active))}>
            {objection.is_active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      )}
    </li>
  );
}

// ---------- General ----------

export function GeneralSettingsEditor({ settings, editable, envRecipient }: { settings: Settings; editable: boolean; envRecipient: boolean }) {
  const [email, setEmail] = useState(settings.recipient_email);
  const [tags, setTags] = useState(settings.devto_tags);
  const [newTag, setNewTag] = useState("");
  const { pending, run } = useAction();
  const emailError = email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "Enter a valid email address, or leave it empty." : null;
  const tagClean = newTag.trim().toLowerCase();
  const tagError = tagClean !== "" && !/^[a-z0-9]+$/.test(tagClean) ? "Lowercase letters and numbers only." : tags.includes(tagClean) ? "Already added." : null;
  const dirty = email !== settings.recipient_email || tags.join(",") !== settings.devto_tags.join(",");

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveGeneralSettingsAction({ recipient_email: email, devto_tags: tags }));
      }}
    >
      <Field label="Weekly brief recipient" error={emailError}>
        <Input type="email" value={email} disabled={!editable} onChange={(e) => setEmail(e.target.value)} placeholder="sumit@company.com" className="max-w-sm" aria-invalid={emailError ? true : undefined} />
        {email.trim() === "" && <span className="text-xs text-muted">{envRecipient ? "Empty: the BRIEF_RECIPIENT_EMAIL fallback is used." : "Empty: no email is sent until you add one."}</span>}
      </Field>
      <div className="flex flex-col gap-2 text-sm">
        <span className="text-muted">Dev.to tags to scan</span>
        <ul className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <li key={t} className="inline-flex items-center gap-1 rounded border border-rule bg-surface py-0.5 pl-2 pr-1">
              {t}
              {editable && (
                <button type="button" className="rounded p-0.5 text-muted hover:text-ink" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`}>
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <div className="flex flex-col gap-1">
            <div className="flex gap-2">
              <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="e.g. git" className="max-w-40" aria-label="New Dev.to tag" aria-invalid={tagError ? true : undefined} />
              <Button
                type="button"
                variant="outline"
                className="h-9"
                disabled={tagClean === "" || tagError !== null}
                onClick={() => {
                  setTags([...tags, tagClean]);
                  setNewTag("");
                }}
              >
                <Plus />
                Add tag
              </Button>
            </div>
            {tagError && <span className="text-xs text-rising">{tagError}</span>}
          </div>
        )}
      </div>
      {editable && (
        <Button type="submit" className="self-start" disabled={!dirty || pending || emailError !== null || tags.length === 0}>
          Save changes
        </Button>
      )}
    </form>
  );
}
