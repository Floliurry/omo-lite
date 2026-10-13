# Reframing a Stalled Investigation

Use this reference when repeated checks produce no new evidence. It offers alternative questions, not a timed escalation, fixed agent count, or mandatory review.

| Perspective | Questions to test |
| --- | --- |
| Overlooked basics | Wrong executable, cached build, working directory, input, port, or process? Is the edited source actually running? |
| System boundaries | Does a wrapper, SDK, proxy, loader, or serializer change the value? Which side of the boundary has been observed? |
| Assumed invariants | Which assumption is carrying the explanation? What is the smallest observation that would falsify it? |

Choose the perspective that opens a testable path. Do not manufacture multiple candidate causes when one decisive check is available.

If a second investigator would add useful expertise or an independent evidence source, delegate under the current runtime's rules. Provide the symptom, observations, rejected explanations, and the specific unresolved question. No particular role name, tool schema, team, or review panel is required.

Treat agreement between investigators as a reason to test a hypothesis, not proof of the cause. Resolve disagreement with an observation where possible.

If the missing piece is user intent, access, hardware, or an unavailable service, describe that blocker directly. A user question does not require prior consultation. See [decision escalation](05-escalate.md) or [partial runtime evidence](partial-runtime-evidence.md).
