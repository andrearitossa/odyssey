import { Message } from "../types";

/** Only the final numbered block is interactive; numbered prose stays in the story. */
export function parseNarratorResponse(
  response: string,
  timestamp = new Date(),
): Message[] {
  const lines = response.trim().split("\n");
  const choices: Message[] = [];
  let end = lines.length;
  while (end > 0) {
    const line = lines[end - 1].trim();
    if (!line) {
      end--;
      continue;
    }
    const match = line.match(/^(\d{1,2})[.)]\s+(.+)$/);
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
