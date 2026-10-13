# Independent acceptance

Use this procedure for direct ULW HEAVY work or explicitly requested independent
review. An execution owner with an existing required acceptance gate uses that
gate instead; do not stack equivalent reviews. Selected Visual QA and strict-plan
contracts retain their own required reviews.

Assign an independent reviewer the goal, scope/constraints, acceptance criteria,
delivered diff or artifacts, and relevant check results with their conditions and
limitations. References are preferable to copying material when the reviewer can
read them. Keep reviewer context independent of implementation conversation;
provide necessary facts without prescribing the verdict. Use an available reviewer
role or carry its requirements in a bounded read-only assignment.

Ask for a verdict grounded in concrete correctness, security, regression and
missing-evidence findings. The reviewer should inspect the actual changed surface,
not merely endorse a completion summary. The lead verifies concerns against the
requested outcome and applicable contract: fix genuine blockers, and explain why
an unsupported concern or optional improvement is deferred. Do not reject a real
missed risk merely because an initial checklist omitted it.

After a fix, rerun affected checks and return the delta and updated evidence to
the same reviewer. Retain valid approvals outside that delta. Notes and optional
polish do not prevent acceptance. If disagreement or a blocker persists without
a concrete path to resolution, surface it and the partial outcome instead of
cycling reviewers or continuing unproductive retries. Report approval only for
the scope and revision actually reviewed; no artifact directory or fixed report
schema is imposed by direct ULW.
