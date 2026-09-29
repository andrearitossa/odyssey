# Interaction decisions

The core loop is now **world → scene → choice or custom action → next scene**. Optional account settings stay outside that loop. The story engine makes one narrator call per turn, using the world, language preference, and recent conversation; it does not invoke separate planning or prediction agents.

## Research used

- **Make choices differ in consequence.** Cardona-Rivera et al. found higher reported agency when options produced different situational content. The narrator should offer distinct actions and acknowledge the selected action in its next scene. [AIIDE paper](https://ojs.aaai.org/index.php/AIIDE/article/view/12716)
- **Honor intent before introducing complications.** Emily Short’s discussion of narrative choices supports outcomes that follow the player’s intent, with a cost or complication, rather than unrelated results. This informs the narrator prompt. [Author’s analysis](https://emshort.blog/2019/02/05/story-robert-mckee/)
- **Let people try the app first.** Registration should not block discovering the experience. Odyssey starts as a guest and offers account creation in the profile area. [NNGroup mobile first-use research](https://www.nngroup.com/articles/mobile-apps-initial-use/)
- **Show real feedback, not invented progress.** A pending turn immediately shows a writing state and blocks duplicate submission. No fake percentage or artificial typing delay is added. [NNGroup response-time guidance](https://www.nngroup.com/articles/response-times-3-important-limits/)
- **Make correction cheap.** The failed action remains available for retry, and custom drafts survive failed requests. [Microsoft human–AI interaction guidelines](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf)
- **Keep secondary controls secondary.** Restart is a small confirmed action; account setup lives outside the story. Two or three story choices is a practical default, not an empirically universal optimum. [NNGroup progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)

## Deliberately omitted

Predictive chapters, plot-planning screens, optimizer passes, mandatory sign-in, microphone permissions on arrival, separate creation modals, ornamental onboarding, and artificial typewriter effects. These add work before the next meaningful story action.

## Limits

Recent history is bounded to keep latency/cost predictable. This is not a full long-term narrative memory system: very long adventures can lose older details. Password reset, cross-device live synchronization, and voice interaction are outside this simplified version.
