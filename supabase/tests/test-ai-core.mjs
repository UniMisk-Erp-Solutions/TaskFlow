// Unit tests for the assistant's pure logic (assignee safety, drafts, memory filtering).
// Run: node supabase/tests/test-ai-core.mjs   (Node 22.6+ / 24; no dependencies)
// The code under test lives in supabase/functions/api/index.ts between the AI-CORE markers.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(process.env.AI_INDEX || path.join(here, "../functions/api/index.ts"), "utf8");
const a = src.indexOf("// AI-CORE-BEGIN"), b = src.indexOf("// AI-CORE-END");
assert.ok(a > 0 && b > a, "AI-CORE markers not found");
const names = ["aiResolvePerson", "aiGrounded", "aiResolveAssigneeText", "aiNewItem", "aiResolveItem", "aiAskAssignee",
  "aiApplyDraftEdit", "aiDraftPreview", "aiIsConfirm", "aiIsCancel", "aiStripAssignPhrase", "aiSelfRef", "aiCleanMemory",
  "aiTrimHistory", "aiExtractJson", "aiNormDate", "aiParseDate", "aiWalkApply", "aiWalkPrompt", "aiWalkIndex", "aiItemComplete", "aiTasksFromText"];
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "aicore-")), "core.mts");
fs.writeFileSync(tmp, src.slice(a, b) + `\nexport { ${names.join(", ")} };\n`);
const C = await import(pathToFileURL(tmp).href);

const members = [
  { id: "u1", full_name: "Naveena Shah", email: "naveena@x.com" },
  { id: "u2", full_name: "Ravi Kumar", email: "ravi.k@x.com" },
  { id: "u3", full_name: "Ravi Patel", email: "ravi.p@x.com" },
  { id: "u4", full_name: "Preet Mehta", email: "preet@x.com" },
  { id: "u5", full_name: "Anita Rao", email: "anita@x.com" },
  { id: "u6", full_name: "Anita Rao", email: "anita2@x.com" },
];
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const G = (user, memory = "") => ({ user, selfText: user, memory });
const SELF = ["u1", "Naveena Shah"];

t("resolve: unique first name", () => assert.deepEqual(C.aiResolvePerson(members, "preet"), { status: "ok", id: "u4", label: "Preet Mehta" }));
t("resolve: ambiguous first name lists candidates", () => {
  const r = C.aiResolvePerson(members, "Ravi");
  assert.equal(r.status, "ambiguous");
  assert.equal(r.candidates.length, 2);
});
t("resolve: full name disambiguates", () => assert.equal(C.aiResolvePerson(members, "Ravi Patel").id, "u3"));
t("resolve: duplicate full names are ambiguous", () => assert.equal(C.aiResolvePerson(members, "Anita Rao").status, "ambiguous"));
t("resolve: unknown / typo is none (no fuzzy guessing)", () => {
  assert.equal(C.aiResolvePerson(members, "Rav1").status, "none");
  assert.equal(C.aiResolvePerson(members, "Zed").status, "none");
  assert.equal(C.aiResolvePerson(members, "").status, "none");
});
t("resolve: partial token does not match", () => assert.equal(C.aiResolvePerson(members, "Pre").status, "none"));

t("assignee: name the user typed resolves", () =>
  assert.equal(C.aiResolveAssigneeText("Preet", members, ...SELF, G("assign to Preet")).id, "u4"));
t("assignee: name the model invented (not typed) is treated as missing", () =>
  assert.equal(C.aiResolveAssigneeText("Preet", members, ...SELF, G("call the vendor tomorrow")).status, "empty"));
t("assignee: 'me' ok only if the user said me/my/I", () => {
  assert.equal(C.aiResolveAssigneeText("me", members, ...SELF, G("remind me to pay rent")).id, "u1");
  assert.equal(C.aiResolveAssigneeText("me", members, ...SELF, G("pay rent tomorrow")).status, "empty");
});
t("assignee: model echoing the user's own name needs 'me' words from the user", () => {
  assert.equal(C.aiResolveAssigneeText("Naveena Shah", members, ...SELF, G("pay rent")).status, "empty");
  assert.equal(C.aiResolveAssigneeText("Naveena Shah", members, ...SELF, G("pay rent for me")).id, "u1");
});
t("assignee: ambiguous typed name asks, never picks", () =>
  assert.equal(C.aiResolveAssigneeText("Ravi", members, ...SELF, G("assign to Ravi")).status, "ambiguous"));
t("assignee: unregistered typed name -> none", () =>
  assert.equal(C.aiResolveAssigneeText("Zed", members, ...SELF, G("assign to Zed")).status, "none"));
t("assignee: only saved memory grounds -> flagged fromMemory", () => {
  const r = C.aiResolveAssigneeText("Preet", members, ...SELF, G("send the report", "Default assignee for reports is Preet Mehta"));
  assert.equal(r.status, "ok");
  assert.equal(r.fromMemory, true);
});
t("assignee: a name the user never typed stays missing even if it is a real teammate", () =>
  assert.equal(C.aiResolveAssigneeText("Preet", members, ...SELF, G("who can do it?")).status, "empty"));

t("draft: item without assignee asks who", () => {
  const it = C.aiNewItem({ title: "Call vendor", due_date: "2026-10-20" }, null);
  C.aiResolveItem(it, members, ...SELF, G("call vendor"));
  assert.equal(it.issue, "missing");
  const q = C.aiAskAssignee({ source: "text", needsConfirm: false, items: [it], at: 0 }, ["A", "B"]);
  assert.match(q, /Who should I assign \*Call vendor\*/);
});
t("draft: multi-item ask lists only unresolved items", () => {
  const items = [C.aiNewItem({ title: "A", assignee: "Preet" }, null), C.aiNewItem({ title: "B", assignee: "Ravi" }, null), C.aiNewItem({ title: "C" }, null)];
  items.forEach((i) => C.aiResolveItem(i, members, ...SELF, G("Preet Ravi")));
  assert.equal(items[0].issue, null);
  assert.equal(items[1].issue, "ambiguous");
  assert.equal(items[2].issue, "missing");
  const q = C.aiAskAssignee({ source: "image", needsConfirm: true, items, at: 0 }, []);
  assert.match(q, /2 of 3/);
  assert.doesNotMatch(q, /\*A\*/);
});
t("draft: image default assignee grounded in OCR text; duplicate Anita must be asked", () => {
  const it = C.aiNewItem({ title: "Order paper" }, "Anita Rao");
  C.aiResolveItem(it, members, ...SELF, G("Tasks for Anita Rao\n- Order paper"));
  assert.equal(it.issue, "ambiguous");
});
t("draft: edit assigns, removes, edits fields", () => {
  const d = { source: "image", needsConfirm: true, at: 0, items: ["A", "B", "C"].map((x) => C.aiNewItem({ title: x }, null)) };
  const notes = C.aiApplyDraftEdit(d, { assign: [{ items: [1, 3], assignee: "Preet" }], remove: [2], set: [{ item: 1, fields: { due_date: "2026-11-02", priority: "high" } }] },
    members, ...SELF, G("assign 1 and 3 to Preet"));
  assert.deepEqual(notes, []);
  assert.equal(d.items.length, 2);
  assert.equal(d.items[0].assignee_id, "u4");
  assert.equal(d.items[0].due_date, "2026-11-02");
  assert.equal(d.items[0].priority, "high");
  assert.equal(d.items[1].title, "C");
  assert.equal(d.items[1].assignee_id, "u4");
});
t("draft: edit with bad item number reports it", () => {
  const d = { source: "text", needsConfirm: false, at: 0, items: [C.aiNewItem({ title: "A" }, null)] };
  assert.equal(C.aiApplyDraftEdit(d, { set: [{ item: 9, fields: { title: "x" } }] }, members, ...SELF, G("x")).length, 1);
});
t("draft: invalid dates are dropped", () => assert.equal(C.aiNewItem({ title: "x", due_date: "2026-13-45" }, null).due_date, null));
t("draft: preview marks missing assignee", () => {
  const it = C.aiNewItem({ title: "X" }, null);
  assert.match(C.aiDraftPreview({ items: [it] }), /needs an assignee/);
});

t("confirm/cancel detection", () => {
  for (const s of ["yes", "Confirm", "ok.", "go ahead", "create them", "Create all"]) assert.ok(C.aiIsConfirm(s), s);
  for (const s of ["cancel", "No", "never mind"]) assert.ok(C.aiIsCancel(s), s);
  for (const s of ["assign to Preet", "yes but make it high priority", "remove 2"]) {
    assert.ok(!C.aiIsConfirm(s), s);
    assert.ok(!C.aiIsCancel(s), s);
  }
});
t("strip assign phrase", () => {
  assert.equal(C.aiStripAssignPhrase("assign them to Preet"), "Preet");
  assert.equal(C.aiStripAssignPhrase("Assign it to Ravi Patel."), "Ravi Patel");
  assert.equal(C.aiStripAssignPhrase("for Preet"), "Preet");
  assert.equal(C.aiStripAssignPhrase("Preet"), "Preet");
});
t("memory filter blocks secrets, accepts preferences", () => {
  assert.equal(C.aiCleanMemory({ content: "my password is hunter2" }), null);
  assert.equal(C.aiCleanMemory({ content: "api key: abc" }), null);
  assert.equal(C.aiCleanMemory({ content: "ok" }), null);
  assert.deepEqual(C.aiCleanMemory({ content: "Prefers high priority for client tasks", kind: "preference" }), { content: "Prefers high priority for client tasks", kind: "preference" });
  assert.equal(C.aiCleanMemory({ content: "Working on the Q4 launch", kind: "context" }).kind, "context");
});
t("history trimming", () => {
  const h = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "x".repeat(900) }));
  const r = C.aiTrimHistory(h);
  assert.equal(r.length, 16);
  assert.equal(r[0].content.length, 600);
});
t("json extraction tolerates fences and think tags", () =>
  assert.deepEqual(C.aiExtractJson("<think>hmm</think>```json\n{\"op\":\"answer\",\"message\":\"hi\"}\n```"), { op: "answer", message: "hi" }));

const TODAY = "2026-10-17"; // a Saturday
t("dates: common human formats", () => {
  const d = (x) => C.aiParseDate(x, TODAY).date;
  assert.equal(d("25 Nov"), "2026-11-25");
  assert.equal(d("Nov 25th 2027"), "2027-11-25");
  assert.equal(d("tomorrow"), "2026-10-18");
  assert.equal(d("day after tomorrow"), "2026-10-19");
  assert.equal(d("next friday"), "2026-10-23");
  assert.equal(d("05-11-2026"), "2026-11-05");
  assert.equal(d("5/11"), "2026-11-05");
  assert.equal(d("2026-12-01"), "2026-12-01");
  assert.equal(d("1 Jan"), "2027-01-01"); // already past this year -> next year
  assert.equal(d("31 Feb"), null);
  assert.equal(C.aiParseDate("Preet, 25 Nov", TODAY).rest, "Preet");
  assert.equal(C.aiParseDate("Preet, no due date", TODAY).none, true);
});
t("walk: asks one task at a time, assignee then due date", () => {
  const items = [C.aiNewItem({ title: "A", assignee: "L" }, null), C.aiNewItem({ title: "B" }, null), C.aiNewItem({ title: "C", assignee: "Preet", due_date: "2026-11-01" }, null)];
  const g = G("A - L\nB\nC - Preet");
  items.forEach((i) => C.aiResolveItem(i, members, ...SELF, g));
  const d = { source: "image", needsConfirm: true, walk: true, at: 0, items };
  assert.equal(C.aiWalkIndex(d), 0);
  assert.match(C.aiWalkPrompt(d, []), /Task 1 of 3: \*A\*[\s\S]*"L", who isn't a registered user/);
  assert.equal(C.aiWalkApply(d, "Preet, 25 Nov", members, ...SELF, TODAY, G("Preet, 25 Nov")), "applied");
  assert.equal(d.items[0].assignee_id, "u4");
  assert.equal(d.items[0].due_date, "2026-11-25");
  assert.equal(C.aiWalkIndex(d), 1);
  assert.equal(C.aiWalkApply(d, "Ravi", members, ...SELF, TODAY, G("Ravi")), "applied"); // ambiguous -> stays on item B
  assert.equal(C.aiWalkIndex(d), 1);
  assert.match(C.aiWalkPrompt(d, []), /Ravi Kumar[\s\S]*Ravi Patel/);
  assert.equal(C.aiWalkApply(d, "Ravi Patel, tomorrow", members, ...SELF, TODAY, G("Ravi Patel, tomorrow")), "applied");
  assert.equal(d.items[1].assignee_id, "u3");
  assert.equal(C.aiWalkIndex(d), -1); // C already had assignee + due date from the photo: never asked
});
t("walk: due-only question, no-due-date, skip, and non-answers fall through", () => {
  const items = [C.aiNewItem({ title: "A", assignee: "Preet" }, null), C.aiNewItem({ title: "B", assignee: "Preet" }, null)];
  items.forEach((i) => C.aiResolveItem(i, members, ...SELF, G("Preet")));
  const d = { source: "image", needsConfirm: true, walk: true, at: 0, items };
  assert.match(C.aiWalkPrompt(d, []), /Assigned to Preet Mehta\. What's the due date/);
  assert.equal(C.aiWalkApply(d, "no due date", members, ...SELF, TODAY, G("no due date")), "applied");
  assert.equal(d.items[0].due_set, true);
  assert.equal(C.aiWalkApply(d, "remove task 2 and rename it please", members, ...SELF, TODAY, G("x")), "unhandled");
  assert.equal(C.aiWalkApply(d, "skip", members, ...SELF, TODAY, G("skip")), "skipped");
  assert.equal(d.items.length, 1);
  assert.equal(C.aiWalkIndex(d), -1);
});
t("ocr text -> tasks: notebook-style list with wrapped lines, owners, Done", () => {
  const text = [
    "Sunday 01 November", "> RC to Fleet Direct -> L", "> History logs of every action", "for fleet and driver -> J",
    "> Back dated timestamp + logs -> N", "> Surepass configured -> P", "> Increment in bulk price not new price (bulk price) -> J",
    "> Restriction of command in AI -> Done", "> Scan RC in temporary vehicle add -> L", "> Razorpay in booking request",
    "> Create Destination Packages for fixed price trip",
  ].join("\n");
  const r = C.aiTasksFromText(text, TODAY);
  assert.equal(r.length, 9);
  assert.equal(r[0].title, "RC to Fleet Direct");
  assert.equal(r[0].assignee, "L");
  assert.equal(r[1].title, "History logs of every action for fleet and driver");
  assert.equal(r[1].assignee, "J");
  assert.equal(r.filter((x) => x.already_done).length, 1);
  assert.equal(r.find((x) => x.already_done).title, "Restriction of command in AI");
  assert.equal(r[7].assignee, null);
  assert.equal(r[8].title, "Create Destination Packages for fixed price trip");
});
t("ocr text -> tasks: dash owners, due dates, priority, numbered lists, noise", () => {
  const r = C.aiTasksFromText("1. Send invoice - Preet due 25 Nov\n2) Print handouts urgent - Anita Rao\n3. Update website banner - banner team\n~~ #$ ;;\n4. Book room by tomorrow", TODAY);
  assert.equal(r.length, 4);
  assert.equal(r[0].assignee, "Preet");
  assert.equal(r[0].due_date, "2026-11-25");
  assert.equal(r[1].priority, "high");
  assert.equal(r[1].assignee, "Anita Rao");
  assert.equal(r[3].due_date, "2026-10-18");
  assert.equal(C.aiTasksFromText("", TODAY).length, 0);
  assert.equal(C.aiTasksFromText("@@ ## $$ 12 ..", TODAY).length, 0);
});
t("ocr text -> tasks: plain lines without markers", () => {
  const r = C.aiTasksFromText("Call vendor\nOrder paper\nBook taxi", TODAY);
  assert.deepEqual(r.map((x) => x.title), ["Call vendor", "Order paper", "Book taxi"]);
});
console.log(`\n${n} tests passed`);
