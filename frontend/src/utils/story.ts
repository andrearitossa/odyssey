import { Message } from "../types";

/** Only the final numbered block is interactive; numbered prose stays in the story. */
export function parseNarratorResponse(
  response: string,
  timestamp = new Date(),
): Message[] {
  // New turns store explicit fields; older transcripts still use numbered text.
  if (response.trim().startsWith("{")) {
    try {
      const turn = JSON.parse(response);
      if (turn?.format === "story-v1" && typeof turn.scene === "string" &&
          Array.isArray(turn.choices) && turn.choices.length === 3 &&
          turn.choices.every((c: any) => typeof c.label === "string" && typeof c.action === "string" && typeof c.riskCue === "string")) {
        return [
          { type: "narrator", text: turn.scene, timestamp },
          ...turn.choices.map((c: { label: string; action: string; riskCue: string }, i: number): Message => ({
            type: "choice", text: `${c.label} — ${c.riskCue}`, action: c.action, choiceNumber: i + 1, timestamp,
          })),
        ];
      }
    } catch { /* Not a structured turn; preserve legacy prose. */ }
  }
  const lines = response.trim().split("\n");
  const choices: Message[] = [];
  let end = lines.length;
  while (end > 0) {
    const line = lines[end - 1].trim();
    if (!line) {
      end--;
      continue;
    }
    const match = line.match(/^(\d{1,2})(?:[.):]\s+|\s+[-–—]\s+|\s+)(.+)$/);
    if (!match) break;
    choices.unshift({
      type: "choice",
      text: match[2],
      choiceNumber: Number(match[1]),
      timestamp,
    });
    end--;
  }
  if (
    !choices.length ||
    !choices.every((choice, index) => choice.choiceNumber === index + 1)
  ) {
    return response.trim()
      ? [{ type: "narrator", text: response.trim(), timestamp }]
      : [];
  }
  const text = lines
    .slice(0, end)
    .join("\n")
    .trim()
    .replace(
      /\n?(?:\*\*)?(?:choices|what do you do|choose your (?:action|path))(?:\*\*)?[:?]?$/i,
      "",
    )
    .trim()
    // The choices are already visible as buttons. Remove a final sentence
    // that merely asks the reader to select among them.
    .replace(
      /(^|[.!?]\s+|\n)(?:Now you can|You can now|You must (?:now )?decide|Do you|What will you do)\b[^.!?]*[.!?]?\s*$/i,
      (_match, leading: string) => leading.trimEnd(),
    )
    .trim();
  return [
    ...(text ? [{ type: "narrator" as const, text, timestamp }] : []),
    ...choices,
  ];
}

export function currentChoices(messages: Message[]): Message[] {
  const lastNarrative = messages.reduce(
    (last, message, index) => (message.type !== "choice" ? index : last),
    -1,
  );
  return messages
    .slice(lastNarrative + 1)
    .filter((message) => message.type === "choice");
}
